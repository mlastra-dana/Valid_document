import base64
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("validoc_lambda", pathlib.Path(__file__).with_name("index.py"))
app = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(app)

DOCUMENT = {
    "fileName": "cedula.pdf",
    "contentType": "application/pdf",
    "contentBase64": base64.b64encode(b"%PDF-1.4 test document").decode(),
}
EXPEDIENTE = {
    "tomadorId": "V-123456",
    "dataId": "dana-valid",
    "recordUid": "42",
    "expedienteCompletado": False,
    "intentosRealizados": 0,
    "maximoIntentos": 3,
}


def event(method, path, bearer, body=None):
    return {
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "headers": {"authorization": f"Bearer {bearer}"},
        "body": json.dumps(body or {}),
    }


class SecurityTests(unittest.TestCase):
    def setUp(self):
        app._ATTEMPTS_CACHE.clear()
        self.secret = patch.object(app, "VALIDATION_PROOF_SECRET", "test-secret-not-for-production-at-least-32-bytes")
        self.secret.start()
        self.addCleanup(self.secret.stop)

    def test_get_rejects_unrelated_bearer_before_data_retrieval(self):
        with patch.object(app, "retrieve_tomador") as retrieve:
            result = app.lambda_handler(event("GET", "/expedientes/dana-valid", "arbitrary"), None)
        self.assertEqual(result["statusCode"], 403)
        retrieve.assert_not_called()

    def test_get_accepts_matching_link(self):
        with patch.object(app, "retrieve_tomador", return_value=EXPEDIENTE):
            result = app.lambda_handler(event("GET", "/expedientes/dana-valid", "dana-valid"), None)
        self.assertEqual(result["statusCode"], 200)

    def test_registration_without_validation_proof_cannot_upload(self):
        payload = {"dataId": "dana-valid", "tomadorId": "V-123456", "recordUid": "42", "document": DOCUMENT}
        with patch.object(app, "retrieve_tomador", return_value=EXPEDIENTE), patch.object(app, "upload_document") as upload:
            result = app.lambda_handler(event("POST", "/documentos-identidad/registrar", "dana-valid", payload), None)
        self.assertEqual(result["statusCode"], 403)
        upload.assert_not_called()

    def test_validation_rejects_unrelated_bearer_before_bedrock(self):
        payload = {"dataId": "dana-valid", "tomadorId": "V-123456", "recordUid": "42", "document": DOCUMENT}
        with patch.object(app, "retrieve_tomador") as retrieve, patch.object(app, "validate_with_bedrock") as bedrock:
            result = app.lambda_handler(event("POST", "/documentos-identidad/validar", "arbitrary", payload), None)
        self.assertEqual(result["statusCode"], 403)
        retrieve.assert_not_called()
        bedrock.assert_not_called()

    def test_proof_is_bound_to_validated_file(self):
        proof = app.make_validation_proof(
            "dana-valid", EXPEDIENTE, DOCUMENT, app.validation_result("VALID_DOCUMENT", "V-123456"),
            {"used": 1, "remaining": 2, "maximum": 3},
        )
        payload = {
            "dataId": "dana-valid", "tomadorId": "V-123456", "recordUid": "42",
            "document": {**DOCUMENT, "contentBase64": base64.b64encode(b"different file").decode()},
            "validationProof": proof,
        }
        with patch.object(app, "retrieve_tomador", return_value=EXPEDIENTE), patch.object(app, "upload_document") as upload:
            result = app.lambda_handler(event("POST", "/documentos-identidad/registrar", "dana-valid", payload), None)
        self.assertEqual(result["statusCode"], 403)
        upload.assert_not_called()

    def test_valid_proof_allows_existing_registration_flow(self):
        proof = app.make_validation_proof(
            "dana-valid", EXPEDIENTE, DOCUMENT, app.validation_result("VALID_DOCUMENT", "V-123456"),
            {"used": 1, "remaining": 2, "maximum": 3},
        )
        payload = {
            "dataId": "dana-valid", "tomadorId": "V-123456", "recordUid": "42",
            "document": DOCUMENT, "validationProof": proof,
        }
        with patch.object(app, "retrieve_tomador", return_value=EXPEDIENTE), patch.object(
            app, "upload_document", return_value={"success": True, "documentId": "s3://WS/test"}
        ) as upload:
            result = app.lambda_handler(event("POST", "/documentos-identidad/registrar", "dana-valid", payload), None)
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(upload.call_args.args[0]["detectedDocumentNumber"], "V-123456")

    def test_failure_update_requires_signed_result(self):
        payload = {"dataId": "dana-valid", "tomadorId": "V-123456", "recordUid": "42", "status": "VALIDATION_FAILED"}
        with patch.object(app, "retrieve_tomador", return_value=EXPEDIENTE), patch.object(app, "register_result") as register:
            result = app.lambda_handler(event("POST", "/expedientes/dana-valid/resultado", "dana-valid", payload), None)
        self.assertEqual(result["statusCode"], 403)
        register.assert_not_called()

    def test_validation_and_failure_update_keep_existing_flow(self):
        payload = {"dataId": "dana-valid", "tomadorId": "V-123456", "recordUid": "42", "document": DOCUMENT}
        bedrock_result = (app.validation_result("TOMADOR_MISMATCH", "V-999999"), {})
        with patch.object(app, "retrieve_tomador", return_value=EXPEDIENTE), patch.object(
            app, "validate_with_bedrock", return_value=bedrock_result
        ), patch.object(app, "record_bedrock_token_usage"):
            validation_result = app.lambda_handler(event("POST", "/documentos-identidad/validar", "dana-valid", payload), None)
        self.assertEqual(validation_result["statusCode"], 200)
        validation_body = json.loads(validation_result["body"])
        self.assertEqual(validation_body["attempts"]["used"], 1)
        failure_payload = {
            "dataId": "dana-valid", "tomadorId": "V-123456", "recordUid": "42",
            "validationProof": validation_body["validationProof"], "status": "VALIDATION_FAILED",
        }
        with patch.object(app, "retrieve_tomador", return_value=EXPEDIENTE), patch.object(app, "register_result") as register:
            result = app.lambda_handler(event("POST", "/expedientes/dana-valid/resultado", "dana-valid", failure_payload), None)
        self.assertEqual(result["statusCode"], 204)
        self.assertEqual(register.call_args.args[2]["attemptsUsed"], 1)


if __name__ == "__main__":
    unittest.main()
