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
7. Si falla por intentos, registra el resultado para que DANAconnect continúe el flujo.

## Variables de entorno

```env
CORS_ORIGIN=https://tu-dominio-amplify.com
DANA_TOKEN_URL=https://auth.danaconnect.com/oauth/token
DANA_ACCESS_TOKEN=
DANA_CLIENT_ID=
DANA_CLIENT_SECRET=
DANA_USERNAME=
DANA_PASSWORD=
DANA_SCOPE=
DANA_DATA_RETRIEVAL_URL=https://...
DANA_API_UPLOAD_URL=https://...
DANA_RESULT_URL=https://...
DANA_TIMEOUT_SECONDS=20
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
MAX_FILE_SIZE_BYTES=10485760
```

Puedes usar `DANA_ACCESS_TOKEN` si ya tienes un token técnico fijo para el demo. Si prefieres OAuth, configura `DANA_TOKEN_URL` con `DANA_CLIENT_ID` y `DANA_CLIENT_SECRET`; también soporta password grant si el ambiente de DANAconnect lo requiere.

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
