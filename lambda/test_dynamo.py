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

    def put_item(self, Item, ConditionExpression):
        assert ConditionExpression == "attribute_not_exists(TOMADOR_ID_KEY)"
        key = Item["TOMADOR_ID_KEY"]
        if key in self.items:
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
            "expedienteCompletado": False, "intentosRealizados": 0, "maximoIntentos": 3,
            "_danaFields": {"NOMBRETOMADOR": "Maria"},
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
        self.assertEqual(item["INTENTOS_VALIDOC"], 1)
        self.assertEqual(item["NOMBRETOMADOR"], "Maria")

    def test_dynamo_read_failure_stops_flow(self):
        with patch.object(self.table, "get_item", side_effect=RuntimeError("unavailable")):
            with self.assertRaises(app.AppError) as error:
                app.get_completed_item("V-2457722")
        self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
