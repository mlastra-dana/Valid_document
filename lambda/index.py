import base64
import json
import mimetypes
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

try:
    import boto3
except ImportError:
    boto3 = None


CORS_HEADERS = {
    "Access-Control-Allow-Origin": os.environ.get("CORS_ORIGIN", "*"),
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
}

SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store",
}

DANA_BASE_URL = os.environ.get("DANA_BASE_URL", "https://appserv.danaconnect.com").rstrip("/")
DANA_TRIGGER_URL = os.environ.get("DANA_TRIGGER_URL", "https://appserv.danaconnect.com/event/Trigger")
DANA_TOKEN_URL = os.environ.get("DANA_TOKEN_URL", "https://auth.danaconnect.com/oauth2/token")
DANA_ACCESS_TOKEN = os.environ.get("DANA_ACCESS_TOKEN", "")
DANA_CLIENT_ID = os.environ.get("DANA_CLIENT_ID", "")
DANA_CLIENT_SECRET = os.environ.get("DANA_CLIENT_SECRET", "")
DANA_USERNAME = os.environ.get("DANA_USERNAME", "")
DANA_PASSWORD = os.environ.get("DANA_PASSWORD", "")
DANA_OAUTH_SCOPE = os.environ.get("DANA_OAUTH_SCOPE", "")
DANA_DATA_FIELDS = os.environ.get(
    "DANA_DATA_FIELDS",
    (
        "ADJUNTADOC1,CEDULA_TOMADOR,DOCUMENTO_DETECTADO,EMAIL_TOMADOR,ESTADO_VALIDOC,"
        "FECHAULTIMOVALIDOC,INTENTOS_VALIDOC,MOTIVOFALLO,NOMBRETOMADOR,"
        "NOMBRE_ARCHIVO_DOC,PRODUCTO,TELEFONO_TOMADOR,TOMADOR_ID,UID"
    ),
)
DANA_FIELDS_QUERY_PARAM = os.environ.get("DANA_FIELDS_QUERY_PARAM", "fieldList")
DANA_OAUTH_AUTH_METHOD = os.environ.get("DANA_OAUTH_AUTH_METHOD", "basic").lower()
VALIDOC_FILE_UPLOAD_PATH = "/dana/conversation/http/rest/file/upload"
DANA_CONVERSATION_DEBUG = os.environ.get("DANA_CONVERSATION_DEBUG", "0")
DANA_TIMEOUT_SECONDS = int(os.environ.get("DANA_TIMEOUT_SECONDS", "20"))

FIELD_TOMADOR_ID = "TOMADOR_ID"
FIELD_REASON_CODE = "MOTIVOFALLO"
FIELD_FILE_ID = "ADJUNTADOC1"
FIELD_UPDATED_AT = "FECHAULTIMOVALIDOC"
FIELD_STATUS = "ESTADO_VALIDOC"
FIELD_ATTEMPTS_USED = "INTENTOS_VALIDOC"
FIELD_DETECTED_DOCUMENT = "DOCUMENTO_DETECTADO"
FIELD_FILE_NAME = "NOMBRE_ARCHIVO_DOC"

BEDROCK_REGION = os.environ.get("BEDROCK_REGION") or os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0"
)
MAX_FILE_SIZE_BYTES = int(os.environ.get("MAX_FILE_SIZE_BYTES", str(10 * 1024 * 1024)))

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

_TOKEN_CACHE = {"access_token": "", "expires_at": 0}
_ATTEMPTS_CACHE = {}


def log_event(event_name, **fields):
    safe_fields = {"event": event_name}
    safe_fields.update(fields)
    print(json.dumps(safe_fields, ensure_ascii=False))


class AppError(Exception):
    def __init__(self, status_code, code, message):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def response(status_code, body=None):
    return {
        "statusCode": status_code,
        "headers": {
            **CORS_HEADERS,
            **SECURITY_HEADERS,
            "Content-Type": "application/json",
        },
        "body": "" if body is None else json.dumps(body, ensure_ascii=False),
    }


def empty_response(status_code=204):
    return {
        "statusCode": status_code,
        "headers": {**CORS_HEADERS, **SECURITY_HEADERS},
        "body": "",
    }


def parse_body(event):
    raw_body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")
    try:
        return json.loads(raw_body)
    except json.JSONDecodeError:
        raise AppError(400, "INVALID_JSON", "El cuerpo de la solicitud no es JSON válido.")


def get_method_and_path(event):
    request_context = event.get("requestContext") or {}
    http_context = request_context.get("http") or {}
    method = http_context.get("method") or event.get("httpMethod") or "GET"
    path = event.get("rawPath") or event.get("path") or "/"
    return method.upper(), path.rstrip("/") or "/"


def get_query_params(event):
    return event.get("queryStringParameters") or {}


def get_bearer_token(event):
    headers = event.get("headers") or {}
    authorization = headers.get("authorization") or headers.get("Authorization") or ""
    match = re.match(r"^Bearer\s+(.+)$", authorization, flags=re.IGNORECASE)
    if not match:
        raise AppError(401, "EXPIRED_LINK", "Falta el token de autorización.")
    return match.group(1)


def normalize_document_number(value):
    return re.sub(r"[^A-Za-z0-9]", "", str(value or "")).upper()


def mask_document_number(value):
    normalized = normalize_document_number(value)
    if not normalized:
        return ""
    return f"{normalized[:1]}{'*' * max(len(normalized) - 3, 3)}{normalized[-2:]}"


def preview_value(value):
    text = str(value or "")
    if not text:
        return ""
    if len(text) <= 10:
        return mask_document_number(text)
    return f"{text[:4]}...{text[-4:]}"


def summarize_data_shape(value):
    if isinstance(value, dict):
        return {"type": "dict", "keys": list(value.keys())[:20]}
    if isinstance(value, list):
        first = value[0] if value else None
        return {
            "type": "list",
            "length": len(value),
            "first": summarize_data_shape(first),
        }
    return {"type": type(value).__name__}


def get_case_insensitive(data, key):
    if not isinstance(data, dict):
        return None

    key_lower = str(key).lower()
    for current_key, value in data.items():
        if str(current_key).lower() == key_lower:
            return value
    return None


def extract_field(data, code):
    if not isinstance(data, dict):
        return ""

    candidates = [get_case_insensitive(data, code)]
    for container_key in ("record", "fields", "contact", "data", "tomador"):
        container = data.get(container_key)
        if isinstance(container, dict):
            candidates.append(get_case_insensitive(container, code))

    for value in candidates:
        if value not in (None, ""):
            return value
    return ""


def dana_error_message(data):
    if not isinstance(data, dict):
        return ""

    ws_error = data.get("wsError")
    if isinstance(ws_error, dict):
        return str(
            ws_error.get("errorDescription")
            or ws_error.get("message")
            or ws_error.get("errorCode")
            or ws_error
        )
    if ws_error:
        return str(ws_error)

    error = data.get("error")
    if isinstance(error, dict):
        return str(error.get("errorDescription") or error.get("message") or error)
    if error:
        return str(error)

    return ""


def get_extension(file_name):
    guessed = mimetypes.guess_type(file_name or "")[0]
    _, extension = os.path.splitext(file_name or "")
    return extension.lower(), guessed


def estimate_base64_bytes(content_base64):
    clean = re.sub(r"\s+", "", content_base64 or "")
    return (len(clean) * 3) // 4


def validate_document_payload(payload):
    document = payload.get("document") or {}
    if not payload.get("tomadorId") or not document.get("fileName"):
        raise AppError(400, "INVALID_REQUEST", "La solicitud no contiene los datos requeridos.")
    if not document.get("contentType") or not document.get("contentBase64"):
        raise AppError(400, "INVALID_REQUEST", "La solicitud no contiene el documento requerido.")

    extension, _ = get_extension(document["fileName"])
    if document["contentType"] not in ALLOWED_CONTENT_TYPES or extension not in ALLOWED_EXTENSIONS:
        return validation_response(
            "UNSUPPORTED_FILE",
            attempts={"used": 0, "remaining": 3, "maximum": 3},
            status_code=422,
        )

    if estimate_base64_bytes(document["contentBase64"]) > MAX_FILE_SIZE_BYTES:
        return validation_response(
            "FILE_TOO_LARGE",
            attempts={"used": 0, "remaining": 3, "maximum": 3},
            status_code=413,
        )

    return None


def validation_result(reason_code, detected_document_number=None):
    return {
        "isValid": reason_code == "VALID_DOCUMENT",
        "isReadable": reason_code != "UNREADABLE_DOCUMENT",
        "isIdentityDocument": reason_code != "NOT_IDENTITY_DOCUMENT",
        "matchesTomador": reason_code != "TOMADOR_MISMATCH",
        "detectedDocumentNumber": detected_document_number,
        "reasonCode": reason_code,
        "message": (
            "Documento validado correctamente"
            if reason_code == "VALID_DOCUMENT"
            else "Documento no validado"
        ),
    }


def validation_response(reason_code, detected_document_number=None, attempts=None, status_code=200):
    return response(
        status_code,
        {
            "success": True,
            "validation": validation_result(reason_code, detected_document_number),
            "attempts": attempts or {"used": 0, "remaining": 3, "maximum": 3},
        },
    )


def get_dana_access_token(portal_token):
    if DANA_ACCESS_TOKEN:
        return DANA_ACCESS_TOKEN

    if not DANA_TOKEN_URL:
        return portal_token

    now = int(time.time())
    if _TOKEN_CACHE["access_token"] and _TOKEN_CACHE["expires_at"] > now + 60:
        return _TOKEN_CACHE["access_token"]

    form_data = {"grant_type": "client_credentials"}
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    if DANA_CLIENT_ID:
        form_data["client_id"] = DANA_CLIENT_ID
    if DANA_CLIENT_SECRET:
        form_data["client_secret"] = DANA_CLIENT_SECRET
    if DANA_USERNAME and DANA_PASSWORD and not (DANA_CLIENT_ID and DANA_CLIENT_SECRET):
        form_data["grant_type"] = "password"
        form_data["username"] = DANA_USERNAME
        form_data["password"] = DANA_PASSWORD
    if DANA_OAUTH_SCOPE:
        form_data["scope"] = DANA_OAUTH_SCOPE

    if DANA_OAUTH_AUTH_METHOD == "basic" and DANA_CLIENT_ID and DANA_CLIENT_SECRET:
        credentials = f"{DANA_CLIENT_ID}:{DANA_CLIENT_SECRET}".encode("utf-8")
        headers["Authorization"] = f"Basic {base64.b64encode(credentials).decode('ascii')}"
        form_data.pop("client_id", None)
        form_data.pop("client_secret", None)

    encoded = urllib.parse.urlencode(form_data).encode("utf-8")
    request = urllib.request.Request(
        DANA_TOKEN_URL,
        data=encoded,
        method="POST",
        headers=headers,
    )
    token_response = send_request(request)
    access_token = token_response.get("access_token")
    if not access_token:
        raise AppError(502, "DANA_TOKEN_ERROR", "DANAconnect no retornó token de acceso.")

    _TOKEN_CACHE["access_token"] = access_token
    _TOKEN_CACHE["expires_at"] = now + int(token_response.get("expires_in", 300))
    return access_token


def send_request(request):
    try:
        with urllib.request.urlopen(request, timeout=DANA_TIMEOUT_SECONDS) as result:
            raw = result.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")[:500]
        log_event(
            "http_error",
            url=urllib.parse.urlsplit(request.full_url).path,
            statusCode=error.code,
            bodyPreview=error_body,
        )
        if error.code in (401, 403):
            raise AppError(401, "EXPIRED_LINK", "El enlace ha expirado.")
        if error.code == 404:
            raise AppError(404, "EXPEDIENTE_NOT_FOUND", "No encontramos el expediente.")
        if error.code == 409:
            raise AppError(409, "EXPEDIENTE_COMPLETED", "El expediente ya fue completado.")
        raise AppError(error.code, "DANA_SERVICE_ERROR", "DANAconnect no completó la solicitud.")
    except urllib.error.URLError:
        log_event("url_error", url=urllib.parse.urlsplit(request.full_url).path)
        raise AppError(502, "DANA_SERVICE_ERROR", "No fue posible conectar con DANAconnect.")


def use_dana_basic_auth():
    return bool(DANA_USERNAME and DANA_PASSWORD)


def dana_basic_headers():
    credentials = f"{DANA_USERNAME}:{DANA_PASSWORD}".encode("utf-8")
    return {
        "Accept": "application/json",
        "Authorization": f"Basic {base64.b64encode(credentials).decode('ascii')}",
    }


def dana_headers(portal_token):
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {get_dana_access_token(portal_token)}",
        "X-Portal-Token": portal_token,
    }


def post_json(url, payload, portal_token):
    if not url:
        raise AppError(500, "SERVER_ERROR", "Falta configurar un endpoint de DANAconnect.")
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers=dana_headers(portal_token),
    )
    return send_request(request)


def get_json(url, headers):
    request = urllib.request.Request(url, method="GET", headers=headers)
    return send_request(request)


def build_data_retrieval_url(dana_identifier):
    api_version = "1.0" if use_dana_basic_auth() else "2.0"
    query_param_name = "fields" if use_dana_basic_auth() else DANA_FIELDS_QUERY_PARAM
    query = urllib.parse.urlencode({query_param_name: DANA_DATA_FIELDS})
    encoded_dana = urllib.parse.quote(dana_identifier, safe="")
    return f"{DANA_BASE_URL}/api/{api_version}/rest/conversation/data/{encoded_dana}?{query}"


def build_upload_url():
    return f"{DANA_BASE_URL}{VALIDOC_FILE_UPLOAD_PATH}"


def get_first_value(data, *keys):
    for key in keys:
        value = extract_field(data, key)
        if value not in (None, ""):
            return value
    return None


def parse_bool(value):
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"true", "1", "si", "sí", "yes", "y"}


def retrieve_tomador(tomador_id, portal_token):
    data_url = build_data_retrieval_url(tomador_id)
    headers = dana_basic_headers() if use_dana_basic_auth() else dana_headers(portal_token)
    log_event(
        "data_retrieval_request",
        dataIdPreview=preview_value(tomador_id),
        authMode="basic" if use_dana_basic_auth() else "bearer",
        fieldsCount=len([field for field in DANA_DATA_FIELDS.split(",") if field.strip()]),
        hasTomadorIdField="TOMADOR_ID" in DANA_DATA_FIELDS,
    )
    body = get_json(data_url, headers)
    log_event("data_retrieval_response_shape", shape=summarize_data_shape(body))
    dana_error = dana_error_message(body)
    if dana_error:
        log_event(
            "data_retrieval_ws_error",
            dataIdPreview=preview_value(tomador_id),
            message=dana_error[:300],
        )
        raise AppError(
            404,
            "EXPEDIENTE_NOT_FOUND",
            "No encontramos el expediente asociado al enlace.",
        )

    data = body.get("data") or body.get("tomador") or body.get("record") or body
    if isinstance(data, list):
        data = data[0] if data else {}
    log_event("data_retrieval_data_shape", shape=summarize_data_shape(data))
    if "record" in body:
        log_event("data_retrieval_record_shape", shape=summarize_data_shape(body.get("record")))

    expected_tomador_id = get_first_value(data, "TOMADOR_ID", "tomadorId", "TOMADORID") or tomador_id
    cedula_tomador = get_first_value(
        data,
        "CEDULA_TOMADOR",
        "CEDULA",
        "DOCUMENTO",
        "IDENTIFICACION",
        "CI",
    )

    expediente = {
        "tomadorId": expected_tomador_id,
        "dataId": tomador_id,
        "nombreTomador": get_first_value(
            data,
            "nombreTomador",
            "NOMBRETOMADOR",
            "NOMBRE",
            "NOMBRECLIENTE",
            "CLIENTE",
        ),
        "tipoPersona": get_first_value(data, "tipoPersona", "TIPOPERSONA") or "natural",
        "numeroDocumentoEsperado": expected_tomador_id,
        "cedulaTomador": cedula_tomador,
        "expedienteCompletado": parse_bool(
            get_first_value(
                data,
                "expedienteCompletado",
                "EXPEDIENTECOMPLETADO",
                "ConsignaDoc",
                "CONSIGNADOC",
                "ADJUNTADOC1",
            )
        ),
        "fechaCompletado": get_first_value(
            data,
            "fechaCompletado",
            "FECHACOMPLETADO",
            "FECHAULTIMOVALIDOC",
        ),
        "intentosRealizados": int(
            get_first_value(
                data, "intentosRealizados", "INTENTOSREALIZADOS", "IntentosValidaDoc", "INTENTOSVALIDADOC"
            )
            or 0
        ),
        "maximoIntentos": int(get_first_value(data, "maximoIntentos", "MAXIMOINTENTOS") or 3),
    }
    log_event(
        "expediente_extracted",
        dataIdPreview=preview_value(tomador_id),
        tomadorIdPreview=preview_value(expediente.get("tomadorId")),
        hasNombreTomador=bool(expediente.get("nombreTomador")),
        hasCedulaTomador=bool(expediente.get("cedulaTomador")),
        expedienteCompletado=expediente.get("expedienteCompletado"),
    )
    return expediente


def build_result_fields(tomador_id, payload):
    return {
        FIELD_TOMADOR_ID: tomador_id,
        FIELD_REASON_CODE: payload.get("reasonCode", ""),
        FIELD_FILE_ID: payload.get("fileID", ""),
        FIELD_UPDATED_AT: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        FIELD_STATUS: payload.get("status", ""),
        FIELD_ATTEMPTS_USED: str(payload.get("attemptsUsed", "")),
        FIELD_DETECTED_DOCUMENT: payload.get("detectedDocumentNumber", ""),
        FIELD_FILE_NAME: payload.get("fileName", ""),
    }


def update_dana_record(data_id, fields):
    if not data_id:
        raise AppError(400, "INVALID_REQUEST", "Falta el identificador DANA del registro.")
    if not use_dana_basic_auth():
        raise AppError(
            500,
            "SERVER_ERROR",
            "DANA_USERNAME y DANA_PASSWORD son requeridos para actualizar el registro.",
        )

    query = {"dana": str(data_id)}
    query.update({key: "" if value is None else str(value) for key, value in fields.items()})
    url = f"{DANA_TRIGGER_URL}?{urllib.parse.urlencode(query)}"
    log_event(
        "dana_record_update_request",
        dataIdPreview=preview_value(data_id),
        fields=list(fields.keys()),
    )
    request = urllib.request.Request(
        url,
        data=b"",
        method="POST",
        headers={
            **dana_basic_headers(),
            "Content-Length": "0",
            "X-DEBUG": DANA_CONVERSATION_DEBUG,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=DANA_TIMEOUT_SECONDS) as result:
            raw_body = result.read().decode("utf-8", errors="replace")
            log_event(
                "dana_record_update_response",
                dataIdPreview=preview_value(data_id),
                statusCode=result.status,
                bodyPreview=raw_body[:300],
            )
            return {"statusCode": result.status, "body": raw_body}
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        log_event(
            "dana_record_update_error",
            dataIdPreview=preview_value(data_id),
            statusCode=error.code,
            bodyPreview=error_body[:300],
        )
        raise AppError(error.code, "DANA_SERVICE_ERROR", "DANAconnect no actualizó el registro.")
    except urllib.error.URLError:
        log_event("dana_record_update_url_error", dataIdPreview=preview_value(data_id))
        raise AppError(502, "DANA_SERVICE_ERROR", "No fue posible conectar con DANAconnect.")


def register_result(data_id, tomador_id, payload):
    update_dana_record(
        data_id,
        build_result_fields(tomador_id, payload),
    )


def build_multipart_body(field_name, file_name, content_type, file_bytes):
    boundary = f"----validoc{int(time.time() * 1000)}"
    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field_name}"; filename="{file_name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    footer = f"\r\n--{boundary}--\r\n".encode("utf-8")
    return boundary, header + file_bytes + footer


def upload_file_to_dana(document):
    if not use_dana_basic_auth():
        raise AppError(
            500,
            "SERVER_ERROR",
            "DANA_USERNAME y DANA_PASSWORD son requeridos para File Upload.",
        )

    file_bytes = base64.b64decode(document["contentBase64"])
    boundary, multipart_body = build_multipart_body(
        "file",
        document["fileName"],
        document["contentType"],
        file_bytes,
    )
    request = urllib.request.Request(
        build_upload_url(),
        data=multipart_body,
        method="POST",
        headers={
            **dana_basic_headers(),
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "X-DEBUG": DANA_CONVERSATION_DEBUG,
        },
    )
    return send_request(request)


def upload_document(payload):
    upload_result = upload_file_to_dana(payload["document"])
    file_id = upload_result.get("fileID")
    if not file_id:
        raise AppError(502, "DANA_UPLOAD_ERROR", "DANAconnect no retornó fileID.")

    update_dana_record(
        payload.get("dataId") or payload["tomadorId"],
        build_result_fields(
            payload["tomadorId"],
            {
                "status": "COMPLETED",
                "reasonCode": "",
                "fileID": file_id,
                "fileName": upload_result.get("fileName") or payload["document"]["fileName"],
                "detectedDocumentNumber": payload.get("detectedDocumentNumber"),
            },
        ),
    )

    return {
        "success": True,
        "documentId": file_id,
        "indexed": True,
        "expedienteStatus": "COMPLETED",
        "completedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def get_attempts(tomador_id, expediente, increment=False):
    current = _ATTEMPTS_CACHE.get(tomador_id, int(expediente.get("intentosRealizados") or 0))
    maximum = int(expediente.get("maximoIntentos") or 3)
    used = min(current + 1, maximum) if increment else current
    _ATTEMPTS_CACHE[tomador_id] = used
    return {"used": used, "remaining": max(maximum - used, 0), "maximum": maximum}


def bedrock_client():
    if boto3 is None:
        raise AppError(500, "SERVER_ERROR", "boto3 no está disponible en el runtime.")
    return boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)


def build_bedrock_content(document, expected_document_number):
    prompt = "\n".join(
        [
            "Analiza el archivo adjunto como documento de identidad.",
            "Determina si es legible, si es una cédula de identidad venezolana y extrae nacionalidad más número.",
            "No inventes datos. Si no puedes leer la nacionalidad o el número, usa null.",
            "Responde únicamente JSON con estas claves:",
            "isReadable, isIdentityDocument, detectedDocumentNumber, reasonCode, message.",
            "detectedDocumentNumber debe incluir nacionalidad y número cuando sean legibles, por ejemplo V-12345678 o E-1016824.",
            "reasonCode debe ser VALID_DOCUMENT, UNREADABLE_DOCUMENT, NOT_IDENTITY_DOCUMENT, TOMADOR_MISMATCH o VALIDATION_SERVICE_ERROR.",
            f"Identificador esperado exacto normalizado: {normalize_document_number(expected_document_number)}.",
            "La coincidencia solo es válida si nacionalidad y número coinciden exactamente con el identificador esperado.",
        ]
    )

    source = {
        "type": "base64",
        "media_type": document["contentType"],
        "data": document["contentBase64"],
    }

    if document["contentType"] == "application/pdf":
        media_block = {"type": "document", "source": source}
    else:
        media_block = {"type": "image", "source": source}

    return [media_block, {"type": "text", "text": prompt}]


def extract_model_json(text):
    candidate = text.strip()
    if candidate.startswith("{"):
        return json.loads(candidate)
    match = re.search(r"\{[\s\S]*\}", candidate)
    if not match:
        raise ValueError("La respuesta de Bedrock no contiene JSON.")
    return json.loads(match.group(0))


def validate_with_bedrock(document, expected_document_number):
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 700,
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": build_bedrock_content(document, expected_document_number),
            }
        ],
    }

    log_event(
        "bedrock_validation_request",
        contentType=document.get("contentType"),
        expectedPreview=preview_value(expected_document_number),
        modelId=BEDROCK_MODEL_ID,
    )
    result = bedrock_client().invoke_model(
        modelId=BEDROCK_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(payload),
    )
    decoded = json.loads(result["body"].read().decode("utf-8"))
    text = next((part.get("text") for part in decoded.get("content", []) if part.get("type") == "text"), "{}")
    model_result = extract_model_json(text)

    detected = normalize_document_number(model_result.get("detectedDocumentNumber"))
    expected = normalize_document_number(expected_document_number)

    if not model_result.get("isReadable"):
        reason_code = "UNREADABLE_DOCUMENT"
    elif not model_result.get("isIdentityDocument"):
        reason_code = "NOT_IDENTITY_DOCUMENT"
    elif not detected or detected != expected:
        reason_code = "TOMADOR_MISMATCH"
    else:
        reason_code = "VALID_DOCUMENT"

    log_event(
        "bedrock_validation_result",
        reasonCode=reason_code,
        detectedPreview=preview_value(detected),
    )
    return validation_result(reason_code, detected or None)


def handle_get_expediente(path, portal_token):
    match = re.match(r"^/expedientes/([^/]+)$", path)
    if not match:
        return None
    tomador_id = urllib.parse.unquote(match.group(1))
    expediente = retrieve_tomador(tomador_id, portal_token)
    return response(200, {"success": True, "data": expediente})


def handle_validate_document(portal_token, payload):
    invalid_response = validate_document_payload(payload)
    if invalid_response:
        return invalid_response

    tomador_id = payload["tomadorId"]
    data_id = payload.get("dataId") or tomador_id
    expediente = retrieve_tomador(data_id, portal_token)
    attempts_before = get_attempts(data_id, expediente)
    if attempts_before["remaining"] <= 0:
        return validation_response("MAX_ATTEMPTS_REACHED", attempts=attempts_before, status_code=429)

    try:
        validation = validate_with_bedrock(payload["document"], expediente.get("numeroDocumentoEsperado"))
    except Exception as error:
        log_event(
            "bedrock_validation_failed",
            errorType=type(error).__name__,
            message=str(error)[:500],
        )
        raise AppError(
            502,
            "VALIDATION_SERVICE_ERROR",
            "No pudimos completar la validación en este momento.",
        )

    attempts = get_attempts(data_id, expediente, increment=True)
    return response(200, {"success": True, "validation": validation, "attempts": attempts})


def handle_register_document(portal_token, payload):
    invalid_response = validate_document_payload(payload)
    if invalid_response:
        raise AppError(invalid_response["statusCode"], "VALIDATION_FAILED", "El documento no es válido.")
    result = upload_document(payload)
    _ATTEMPTS_CACHE.pop(payload.get("dataId") or payload["tomadorId"], None)
    return response(200, result)


def handle_register_failure(path, portal_token, payload):
    match = re.match(r"^/expedientes/([^/]+)/resultado$", path)
    if not match:
        return None
    tomador_id = urllib.parse.unquote(match.group(1))
    data_id = payload.get("dataId") or tomador_id
    register_result(data_id, payload.get("tomadorId") or tomador_id, payload)
    _ATTEMPTS_CACHE.pop(data_id, None)
    return empty_response(204)


def lambda_handler(event, context):
    del context
    try:
        method, path = get_method_and_path(event)
        log_event(
            "request_received",
            method=method,
            path=path,
            queryKeys=list(get_query_params(event).keys()),
        )
        if method == "OPTIONS":
            return empty_response(204)

        portal_token = get_bearer_token(event)

        if method == "GET":
            result = handle_get_expediente(path, portal_token)
            if result:
                return result

        if method == "POST" and path == "/documentos-identidad/validar":
            return handle_validate_document(portal_token, parse_body(event))

        if method == "POST" and path == "/documentos-identidad/registrar":
            return handle_register_document(portal_token, parse_body(event))

        if method == "POST":
            result = handle_register_failure(path, portal_token, parse_body(event))
            if result:
                return result

        raise AppError(404, "NOT_FOUND", "Ruta no encontrada.")
    except AppError as error:
        return response(
            error.status_code,
            {"success": False, "error": {"code": error.code, "message": error.message}},
        )
    except Exception as error:
        print(
            json.dumps(
                {
                    "event": "unhandled_error",
                    "errorType": type(error).__name__,
                    "message": str(error),
                }
            )
        )
        return response(
            500,
            {
                "success": False,
                "error": {
                    "code": "SERVER_ERROR",
                    "message": "El servicio no está disponible temporalmente.",
                },
            },
        )


handler = lambda_handler
