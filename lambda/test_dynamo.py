import base64
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("validoc_dynamo_lambda", pathlib.Path(__file__).with_name("index.py"))
app = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(app)


class ConditionalFailure(Exception):
    response = {"Error": {"Code": "ConditionalCheckFailedException"}}


class MemoryTable:
    def __init__(self):
        self.items = {}

    def get_item(self, Key, ConsistentRead):
        assert ConsistentRead
        item = self.items.get(Key["TOMADOR_ID_KEY"])
        return {"Item": item} if item else {}

    def put_item(self, Item, ConditionExpression, ExpressionAttributeNames=None, ExpressionAttributeValues=None):
        key = Item["TOMADOR_ID_KEY"]
        if ConditionExpression == "attribute_not_exists(TOMADOR_ID_KEY)":
            if key in self.items:
                raise ConditionalFailure()
        else:
            assert ConditionExpression == "#v = :previous"
            assert ExpressionAttributeNames == {"#v": "VERSION"}
            if self.items.get(key, {}).get("VERSION") != ExpressionAttributeValues[":previous"]:
                raise ConditionalFailure()
        self.items[key] = Item


class DynamoTests(unittest.TestCase):
    def setUp(self):
        self.table = MemoryTable()
        patches = [
            patch.object(app, "VALIDOC_TABLE_NAME", "ms-validoc-prod"),
            patch.object(app, "VALIDOC_STAGE", "TEST"),
            patch.object(app, "validoc_table", return_value=self.table),
            patch.object(app, "use_dana_basic_auth", return_value=True),
            patch.object(app, "dana_basic_headers", return_value={}),
            patch.object(app, "VALIDATION_PROOF_SECRET", "test-secret-not-for-production-at-least-32-bytes"),
        ]
        for current in patches:
            current.start()
            self.addCleanup(current.stop)

    def test_pending_duplicate_is_marked_complete_and_receives_original_file_reference(self):
        self.table.items["TEST#V2457722"] = {
            "TOMADOR_ID_KEY": "TEST#V2457722", "UID": "1", "ESTADO_VALIDOC": "COMPLETED",
            "ADJUNTADOC1": "s3://WS/original", "FECHAULTIMOVALIDOC": "2026-10-21T16:00:00Z",
        }
        data = {"TOMADOR_ID": "V-2457722", "UID": "17", "NOMBRETOMADOR": "Maria"}
        with patch.object(app, "get_json", return_value=data), patch.object(app, "update_dana_record") as update:
            result = app.lambda_handler({
                "requestContext": {"http": {"method": "GET"}}, "rawPath": "/expedientes/dana-new",
                "headers": {"authorization": "Bearer dana-new"},
            }, None)
        self.assertEqual(result["statusCode"], 200)
        expediente = json.loads(result["body"])["data"]
        self.assertTrue(expediente["expedienteCompletado"])
        self.assertNotIn("_danaFields", expediente)
        self.assertEqual(update.call_args.args[1]["ADJUNTADOC1"], "s3://WS/original")
        self.assertEqual(update.call_args.args[1]["ESTADO_VALIDOC"], "COMPLETED")

    def test_existing_dana_completion_backfills_table_on_open(self):
        data = {
            "TOMADOR_ID": "V-2457722", "UID": "1", "ESTADO_VALIDOC": "",
            "ADJUNTADOC1": "s3://WS/original", "NOMBRETOMADOR": "Maria",
        }
        with patch.object(app, "get_json", return_value=data), patch.object(app, "update_dana_record") as update:
            expediente = app.retrieve_tomador("dana-original", "dana-original")
        self.assertTrue(expediente["expedienteCompletado"])
        self.assertEqual(self.table.items["TEST#V2457722"]["UID"], "1")
        self.assertEqual(self.table.items["TEST#V2457722"]["ADJUNTADOC1"], "s3://WS/original")
        self.assertEqual(update.call_args.args[1]["ESTADO_VALIDOC"], "COMPLETED")

    def test_uid_at_response_root_is_saved_when_record_is_nested(self):
        body = {"UID": 7, "record": {
            "TOMADOR_ID": "V-2457722", "ESTADO_VALIDOC": "COMPLETED",
            "ADJUNTADOC1": "s3://WS/original",
        }}
        with patch.object(app, "get_json", return_value=body), patch.object(app, "update_dana_record"):
            expediente = app.retrieve_tomador("dana-original", "dana-original")
        self.assertEqual(expediente["recordUid"], "7")
        self.assertEqual(self.table.items["TEST#V2457722"]["UID"], "7")

    def test_uid_validoc_field_is_saved_as_original_uid(self):
        body = {"record": {
            "TOMADOR_ID": "V-2457722", "UID_VALIDOC": "7",
            "ESTADO_VALIDOC": "COMPLETED", "ADJUNTADOC1": "s3://WS/original",
        }}
        with patch.object(app, "get_json", return_value=body), patch.object(app, "update_dana_record"):
            expediente = app.retrieve_tomador("dana-original", "dana-original")
        self.assertEqual(expediente["recordUid"], "7")
        self.assertEqual(self.table.items["TEST#V2457722"]["UID"], "7")

    def test_missing_uid_is_not_inferred_from_request_id_or_dana_token(self):
        body = {"record": {
            "TOMADOR_ID": "V-2457722", "ESTADO_VALIDOC": "COMPLETED",
            "ADJUNTADOC1": "s3://WS/original",
        }, "requestID": "request-123"}
        with patch.object(app, "get_json", return_value=body), patch.object(app, "update_dana_record"):
            expediente = app.retrieve_tomador("dana-original", "dana-original")
        self.assertEqual(expediente["recordUid"], "")
        self.assertEqual(self.table.items["TEST#V2457722"]["UID"], "")

    def test_completed_item_cannot_replace_original(self):
        expediente = {"tomadorId": "V-2457722", "recordUid": "1", "intentosRealizados": 1}
        app.save_completed_item(expediente, "s3://WS/original", "2026-10-21T16:00:00Z")
        app.save_completed_item({**expediente, "recordUid": "17"}, "s3://WS/other", "2026-10-22T16:00:00Z")
        self.assertEqual(self.table.items["TEST#V2457722"]["UID"], "1")
        self.assertEqual(self.table.items["TEST#V2457722"]["ADJUNTADOC1"], "s3://WS/original")

    def test_registration_saves_completed_item_after_dana_upload(self):
        document = {
            "fileName": "cedula.pdf", "contentType": "application/pdf",
            "contentBase64": base64.b64encode(b"%PDF-1.4 test").decode(),
        }
        expediente = {
            "tomadorId": "V-2457722", "dataId": "dana-original", "recordUid": "1",
            "expedienteCompletado": False, "intentosRealizados": 1, "maximoIntentos": 3,
        }
        proof = app.make_validation_proof("dana-original", expediente, document, app.validation_result("VALID_DOCUMENT", "V-2457722"), {"used": 1})
        payload = {"dataId": "dana-original", "tomadorId": "V-2457722", "recordUid": "1", "document": document, "validationProof": proof}
        with patch.object(app, "retrieve_tomador", return_value=expediente), patch.object(
            app, "upload_document", return_value={"documentId": "s3://WS/original", "completedAt": "2026-10-22T16:00:00Z"}
        ):
            result = app.handle_register_document("dana-original", payload)
        self.assertEqual(result["statusCode"], 200)
        item = self.table.items["TEST#V2457722"]
        self.assertEqual(item["ESTADO_VALIDOC"], "COMPLETED")
        self.assertEqual(item, {
            "TOMADOR_ID_KEY": "TEST#V2457722",
            "UID": "1",
            "ESTADO_VALIDOC": "COMPLETED",
            "FECHAULTIMOVALIDOC": "2026-10-22T16:00:00Z",
            "ADJUNTADOC1": "s3://WS/original",
        })

    def test_dynamo_read_failure_stops_flow(self):
        with patch.object(self.table, "get_item", side_effect=RuntimeError("unavailable")):
            with self.assertRaises(app.AppError) as error:
                app.get_completed_item("V-2457722")
        self.assertEqual(error.exception.status_code, 503)

    def test_new_dana_token_alone_cannot_open_round(self):
        data = {"TOMADOR_ID": "V-2457722", "UID_VALIDOC": "7", "INTENTOS_VALIDOC": "3"}
        with patch.object(app, "get_json", return_value={"record": data}), patch.object(
            app, "update_dana_record", side_effect=lambda data_id, fields, record_uid=None: data.update(fields)
        ) as update:
            old = app.handle_get_expediente("/expedientes/old-link", "old-link")
            new = app.handle_get_expediente("/expedientes/reminder-link", "reminder-link")
        self.assertEqual(json.loads(old["body"])["data"]["intentosRealizados"], 3)
        self.assertEqual(json.loads(new["body"])["data"]["intentosRealizados"], 3)
        update.assert_not_called()

    def test_reminder_marker_opens_one_shared_round(self):
        data = {"TOMADOR_ID": "V-2457722", "UID_VALIDOC": "7", "INTENTOS_VALIDOC": "3"}
        with patch.object(app, "get_json", return_value={"record": data}), patch.object(
            app, "update_dana_record", side_effect=lambda data_id, fields, record_uid=None: data.update(fields)
        ) as update:
            app.handle_get_expediente("/expedientes/old-link", "old-link")
            data["REINTENTO_VALIDOC"] = "PENDIENTE"
            new = app.handle_get_expediente("/expedientes/reminder-link", "reminder-link")
            old = app.handle_get_expediente("/expedientes/old-link", "old-link")
        self.assertEqual(json.loads(new["body"])["data"]["intentosRealizados"], 0)
        self.assertEqual(json.loads(old["body"])["data"]["intentosRealizados"], 0)
        self.assertEqual(data["REINTENTO_VALIDOC"], "CONSUMIDO")
        self.assertEqual(data["INTENTOS_VALIDOC"], "0")
        self.assertEqual(update.call_count, 1)
        self.assertEqual(self.table.items["ATTEMPTS#TEST#7"]["RETRY_MARKER_STATE"], "CONSUMIDO")

    def test_reminder_round_waits_until_dana_confirms_reset(self):
        data = {"TOMADOR_ID": "V-2457722", "UID_VALIDOC": "7", "INTENTOS_VALIDOC": "3", "REINTENTO_VALIDOC": "PENDIENTE"}
        with patch.object(app, "get_json", return_value={"record": data}), patch.object(app, "update_dana_record"):
            with self.assertRaises(app.AppError) as error:
                app.retrieve_tomador("reminder-link", "reminder-link")
        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(self.table.items["ATTEMPTS#TEST#7"]["RETRY_MARKER_STATE"], "PENDIENTE")
        with patch.object(app, "get_json", return_value={"record": data}), patch.object(
            app, "update_dana_record", side_effect=lambda data_id, fields, record_uid=None: data.update(fields)
        ):
            expediente = app.retrieve_tomador("reminder-link", "reminder-link")
        self.assertEqual(expediente["intentosRealizados"], 0)
        self.assertEqual(self.table.items["ATTEMPTS#TEST#7"]["RETRY_MARKER_STATE"], "CONSUMIDO")

    def test_atomic_reservation_stops_at_three(self):
        app.ensure_attempt_round("7", 0, "")
        results = [app.reserve_attempt("7") for _ in range(4)]
        self.assertEqual([result["used"] for result in results], [1, 2, 3, 3])
        self.assertFalse(results[-1]["reserved"])
        self.assertEqual(self.table.items["ATTEMPTS#TEST#7"]["INTENTOS_VALIDOC"], 3)

    def test_three_validations_then_marked_reminder_starts_one_new_round(self):
        data = {"TOMADOR_ID": "V-2457722", "UID_VALIDOC": "7", "INTENTOS_VALIDOC": "0"}
        document = {
            "fileName": "cedula.pdf", "contentType": "application/pdf",
            "contentBase64": base64.b64encode(b"%PDF-1.4 test").decode(),
        }
        payload = {"dataId": "initial-link", "tomadorId": "V-2457722", "recordUid": "7", "document": document}
        validation = (app.validation_result("TOMADOR_MISMATCH", "V-0000000"), {})
        with patch.object(app, "get_json", return_value={"record": data}), patch.object(
            app, "update_dana_record", side_effect=lambda data_id, fields, record_uid=None: data.update(fields)
        ), patch.object(app, "validate_with_bedrock", return_value=validation) as bedrock, patch.object(
            app, "record_bedrock_token_usage"
        ):
            app.handle_get_expediente("/expedientes/initial-link", "initial-link")
            results = [app.handle_validate_document("initial-link", payload) for _ in range(4)]
            self.assertEqual([json.loads(result["body"])["attempts"]["used"] for result in results], [1, 2, 3, 3])
            self.assertEqual(results[-1]["statusCode"], 429)
            self.assertEqual(bedrock.call_count, 3)
            self.assertEqual(data["INTENTOS_VALIDOC"], "3")
            unmarked = app.handle_get_expediente("/expedientes/reminder-link", "reminder-link")
            self.assertEqual(json.loads(unmarked["body"])["data"]["intentosRealizados"], 3)
            data["REINTENTO_VALIDOC"] = "PENDIENTE"
            reminder = app.handle_get_expediente("/expedientes/reminder-link", "reminder-link")
            self.assertEqual(json.loads(reminder["body"])["data"]["intentosRealizados"], 0)
            self.assertEqual(data["INTENTOS_VALIDOC"], "0")
            old_link = app.handle_get_expediente("/expedientes/initial-link", "initial-link")
            self.assertEqual(json.loads(old_link["body"])["data"]["intentosRealizados"], 0)
            for _ in range(3):
                app.reserve_attempt("7")
            same_link = app.handle_get_expediente("/expedientes/initial-link", "initial-link")
            self.assertEqual(json.loads(same_link["body"])["data"]["intentosRealizados"], 3)

    def test_next_reminder_can_start_another_round(self):
        app.ensure_attempt_round("7", 3, "")
        state = app.ensure_attempt_round("7", 3, "PENDIENTE")
        self.assertEqual(state["INTENTOS_VALIDOC"], 0)
        app.ensure_attempt_round("7", 0, "CONSUMIDO")
        for _ in range(3):
            app.reserve_attempt("7")
        state = app.ensure_attempt_round("7", 3, "PENDIENTE")
        self.assertEqual(state["INTENTOS_VALIDOC"], 0)

    def test_legacy_token_hashes_are_removed_from_attempt_item(self):
        self.table.items["ATTEMPTS#TEST#7"] = {
            "TOMADOR_ID_KEY": "ATTEMPTS#TEST#7", "ACTIVE_LINK_HASH": "old-hash",
            "SEEN_LINK_HASHES": {"old-hash"}, "INTENTOS_VALIDOC": 2, "VERSION": 4,
        }
        state = app.ensure_attempt_round("7", 2, "")
        self.assertEqual(state["INTENTOS_VALIDOC"], 2)
        self.assertNotIn("ACTIVE_LINK_HASH", state)
        self.assertNotIn("SEEN_LINK_HASHES", state)

    def test_completed_tomador_does_not_create_attempt_round(self):
        self.table.items["TEST#V2457722"] = {
            "TOMADOR_ID_KEY": "TEST#V2457722", "ESTADO_VALIDOC": "COMPLETED",
            "ADJUNTADOC1": "s3://WS/original",
        }
        data = {
            "TOMADOR_ID": "V-2457722", "INTENTOS_VALIDOC": "3",
            "ADJUNTADOC1": "s3://WS/original",
            "ESTADO_VALIDOC": "COMPLETED",
        }
        with patch.object(app, "get_json", return_value={"record": data}), patch.object(
            app, "update_dana_record"
        ) as update:
            result = app.handle_get_expediente("/expedientes/reminder-link", "reminder-link")
        self.assertTrue(json.loads(result["body"])["data"]["expedienteCompletado"])
        update.assert_not_called()
        self.assertNotIn("ATTEMPTS#TEST#7", self.table.items)


if __name__ == "__main__":
    unittest.main()
