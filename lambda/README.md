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

1. El frontend llama la Function URL con `Authorization: Bearer <dataId-del-enlace>`.
2. La Lambda consulta el expediente en DANAconnect usando Data Retrieval.
3. La Lambda conserva `UID` como `recordUid` de trazabilidad del registro.
4. La Lambda recibe la cédula en Base64 y valida tipo/tamaño.
5. La Lambda invoca Bedrock Sonnet para leer el documento usando el `TOMADOR_ID` ya obtenido del expediente.
6. La Lambda compara la cédula detectada con la esperada por DANA.
7. Si es válida, sube el documento con el API Upload de DANAconnect.
8. Si una validación falla, registra el último motivo conocido en DANA para cubrir abandono del cliente.

## Variables de entorno

```env
CORS_ORIGIN=https://tu-dominio-amplify.com
DANA_BASE_URL=https://appserv.danaconnect.com
DANA_TRIGGER_URL=https://appserv.danaconnect.com/event/Trigger
DANA_TOKEN_URL=https://auth.danaconnect.com/oauth2/token
DANA_ACCESS_TOKEN=
DANA_CLIENT_ID=
DANA_CLIENT_SECRET=
DANA_USERNAME=
DANA_PASSWORD=
DANA_OAUTH_SCOPE=
DANA_DATA_FIELDS=ADJUNTADOC1,CEDULA_TOMADOR,DOCUMENTO_DETECTADO,EMAIL_TOMADOR,ESTADO_VALIDOC,FECHAULTIMOVALIDOC,INTENTOS_VALIDOC,MOTIVOFALLO,NOMBRETOMADOR,NOMBRE_ARCHIVO_DOC,PRODUCTO,TELEFONO_TOMADOR,TOMADOR_ID,UID
DANA_FIELDS_QUERY_PARAM=fieldList
DANA_OAUTH_AUTH_METHOD=basic
DANA_CONVERSATION_DEBUG=0
DANA_TIMEOUT_SECONDS=20
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
MAX_FILE_SIZE_BYTES=10485760
```

Para Data Retrieval hay dos caminos:

- Si configuras `DANA_USERNAME` y `DANA_PASSWORD`, se usa el camino estable probado: `GET /api/1.0/rest/conversation/data/{dana}?fields=...` con `Authorization: Basic ...`.
- Si no configuras usuario/password, se usa compatibilidad v2: `GET /api/2.0/rest/conversation/data/{dana}?{DANA_FIELDS_QUERY_PARAM}=...` con bearer token.

`DANA_DATA_FIELDS` controla los campos leídos desde `POC_VALIDOC`. Si agregas un campo de solo lectura, puedes actualizar esta variable sin tocar código.

Puedes usar `DANA_ACCESS_TOKEN` si ya tienes un token técnico fijo para el demo. Si prefieres OAuth, configura `DANA_TOKEN_URL` con `DANA_CLIENT_ID` y `DANA_CLIENT_SECRET`. `DANA_OAUTH_AUTH_METHOD=basic` envía el client id/secret por Basic Auth al token endpoint.

Para File Upload se usa `POST /dana/conversation/http/rest/file/upload` con `multipart/form-data`, campo `file` y Basic Auth (`DANA_USERNAME`/`DANA_PASSWORD`). La respuesta esperada incluye `fileID`, que luego se escribe en `ADJUNTADOC1`.

Para actualizar el registro existente se usa Trigger con el `dataId`/`dana` recibido desde el enlace:

```text
POST /event/Trigger?dana={dataId}&CAMPO=valor
```

`TOMADOR_ID` no se usa como llave de actualización. Si Data Retrieval entrega `UID`, la Lambda lo transporta como `recordUid` y lo escribe en logs para verificar que el intento y la actualización pertenecen a la misma fila DANA.

La Lambda no guarda un historial de intentos fallidos. Actualiza los campos del último fallo conocido (`MOTIVOFALLO`, `ESTADO_VALIDOC`, `INTENTOS_VALIDOC`, `DOCUMENTO_DETECTADO`, `NOMBRE_ARCHIVO_DOC`) desde el primer intento fallido. `MOTIVOFALLO` se escribe como texto legible para operaciones, por ejemplo `Documento no coincide con tomador`.

## Endpoints expuestos por Function URL

```http
GET /expedientes/{dataId}
POST /documentos-identidad/validar
POST /documentos-identidad/registrar
POST /expedientes/{dataId}/resultado
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
