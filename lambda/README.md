# Lambda del Portal Validoc

Esta carpeta contiene el código que debe vivir dentro de AWS Lambda para el demo integrado del portal.

## Archivo principal

```text
lambda/index.py
```

Handler:

```text
index.lambda_handler
```

También queda disponible el alias:

```text
index.handler
```

Runtime recomendado:

```text
Python 3.12
```

## Flujo

1. El frontend llama la Function URL con `Authorization: Bearer <token>`.
2. La Lambda consulta el tomador en DANAconnect usando Data Retrieval.
3. La Lambda recibe la cédula en Base64 y valida tipo/tamaño.
4. La Lambda invoca Bedrock Sonnet para leer el documento.
5. La Lambda compara la cédula detectada con la esperada por DANA.
6. Si es válida, sube el documento con el API Upload de DANAconnect.
7. Si se agotan los tres intentos, registra una sola vez el motivo final para que DANAconnect continúe el flujo de refuerzo.

## Variables de entorno

```env
CORS_ORIGIN=https://tu-dominio-amplify.com
DANA_BASE_URL=https://appserv.danaconnect.com
DANA_TOKEN_URL=https://auth.danaconnect.com/oauth2/token
DANA_ACCESS_TOKEN=
DANA_CLIENT_ID=
DANA_CLIENT_SECRET=
DANA_USERNAME=
DANA_PASSWORD=
DANA_OAUTH_SCOPE=
DANA_FIELDS_QUERY_PARAM=fieldList
DANA_OAUTH_AUTH_METHOD=basic
DANA_SUCCESS_PROJECT_ID=
DANA_FAILURE_PROJECT_ID=
DANA_CONVERSATION_DEBUG=0
DANA_TIMEOUT_SECONDS=20
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
MAX_FILE_SIZE_BYTES=10485760
```

Para Data Retrieval hay dos caminos:

- Si configuras `DANA_USERNAME` y `DANA_PASSWORD`, se usa el camino estable probado: `GET /api/1.0/rest/conversation/data/{dana}?fields=...` con `Authorization: Basic ...`.
- Si no configuras usuario/password, se usa compatibilidad v2: `GET /api/2.0/rest/conversation/data/{dana}?{DANA_FIELDS_QUERY_PARAM}=...` con bearer token.

Puedes usar `DANA_ACCESS_TOKEN` si ya tienes un token técnico fijo para el demo. Si prefieres OAuth, configura `DANA_TOKEN_URL` con `DANA_CLIENT_ID` y `DANA_CLIENT_SECRET`. `DANA_OAUTH_AUTH_METHOD=basic` envía el client id/secret por Basic Auth al token endpoint.

Para File Upload se usa `POST /dana/conversation/http/rest/file/upload` con `multipart/form-data`, campo `file` y Basic Auth (`DANA_USERNAME`/`DANA_PASSWORD`). La respuesta esperada incluye `fileID`, que luego se envía como campo al Start Conversation de éxito.

Para Start Conversation se usa OAuth Bearer. El camino recomendado es por Project ID:

```text
POST /api/2.0/rest/conversation/ProjectID/{projectId}/start/data
```

Configura `DANA_SUCCESS_PROJECT_ID` para el resultado exitoso y `DANA_FAILURE_PROJECT_ID` para el flujo de fallo/refuerzo. El disparo se hace por `ProjectID` para mantener el mismo criterio entre ambientes.

La Lambda no registra cada intento fallido; solo dispara el flujo de fallo cuando el tercer intento queda agotado, enviando el motivo final (`UNREADABLE_DOCUMENT`, `NOT_IDENTITY_DOCUMENT` o `TOMADOR_MISMATCH`).

## Endpoints expuestos por Function URL

```http
GET /expedientes/{tomadorId}
POST /documentos-identidad/validar
POST /documentos-identidad/registrar
POST /expedientes/{tomadorId}/resultado
```

Todos requieren:

```http
Authorization: Bearer <token-del-enlace>
```

## Empaquetado desde la raíz del repo

```bash
npm run lambda:zip
```

Esto genera:

```text
validoc-lambda.zip
```

## Permiso IAM para Bedrock

La Lambda necesita permiso para invocar el modelo Sonnet configurado:

```json
{
  "Effect": "Allow",
  "Action": "bedrock:InvokeModel",
  "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
}
```

## Notas para producción

El contador `_ATTEMPTS_CACHE` solo sirve como respaldo temporal durante el demo. El conteo definitivo debe venir de DANAconnect o de una persistencia backend, porque la memoria de Lambda no es confiable entre invocaciones concurrentes o ambientes fríos.
