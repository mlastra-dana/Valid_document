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

1. El frontend llama la Function URL con `Authorization: Bearer <dataId-del-enlace>`. La Lambda exige que el Bearer coincida con el `dataId` solicitado y comprueba el registro mediante Data Retrieval.
2. La Lambda consulta el expediente en DANAconnect usando Data Retrieval.
3. La Lambda conserva `UID` como `recordUid` de trazabilidad del registro.
4. La Lambda recibe la cédula en Base64 y valida tipo/tamaño.
5. La Lambda invoca Bedrock Sonnet para leer el documento usando el `TOMADOR_ID` ya obtenido del expediente.
6. La Lambda toma el consumo de tokens de la respuesta de Bedrock.
7. Si `DANA_TOKEN_AUDIT_PROJECT_ID` está configurado, registra esos tokens en otra lista DANA con Start Conversation por ProjectID.
8. La Lambda compara la cédula detectada con la esperada por DANA.
9. Si es válida, sube el documento con el API Upload de DANAconnect.
10. Si una validación falla, registra el último motivo conocido en DANA para cubrir abandono del cliente.

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
DANA_DATA_FIELDS=ADJUNTADOC1,CEDULA_TOMADOR,DOCUMENTO_DETECTADO,EMAIL_TOMADOR,ESTADO_VALIDOC,FECHAULTIMOVALIDOC,INTENTOS_VALIDOC,MOTIVOFALLO,NOMBRETOMADOR,NOMBRE_ARCHIVO_DOC,PRODUCTO,TELEFONO_TOMADOR,TOMADOR_ID,TOMADOR_ID_COMPLETADO,UID
VALIDOC_TABLE_NAME=ms-validoc-prod
VALIDOC_STAGE=TEST
DANA_FIELDS_QUERY_PARAM=fieldList
DANA_OAUTH_AUTH_METHOD=basic
DANA_CONVERSATION_DEBUG=0
DANA_TOKEN_AUDIT_PROJECT_ID=
DANA_TOKEN_AUDIT_FIELDS_JSON=
DANA_TIMEOUT_SECONDS=20
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
MAX_FILE_SIZE_BYTES=10485760
```

`VALIDOC_TABLE_NAME` habilita la consulta y escritura de completados en DynamoDB. `VALIDOC_STAGE` debe ser `TEST` durante las pruebas con la LC actual y `PROD` al pasar a producción; forma parte de `TOMADOR_ID_KEY` para separar los registros. Si se configura la tabla y la consulta falla, la Lambda detiene el flujo para evitar una nueva carga sin comprobar duplicados. Antes de activar `PROD`, cargar en DynamoDB los completados históricos; una fila DANA ya completada se registra automáticamente cuando se abre su enlace, pero eso no cubre a quienes no lo abran.

Para Data Retrieval hay dos caminos:

- Si configuras `DANA_USERNAME` y `DANA_PASSWORD`, se usa el camino estable probado: `GET /api/1.0/rest/conversation/data/{dana}?fields=...` con `Authorization: Basic ...`.
- Si no configuras usuario/password, se usa compatibilidad v2: `GET /api/2.0/rest/conversation/data/{dana}?{DANA_FIELDS_QUERY_PARAM}=...` con bearer token.

`DANA_DATA_FIELDS` controla los campos leídos desde `POC_VALIDOC`. Si agregas un campo de solo lectura, puedes actualizar esta variable sin tocar código. `TOMADOR_ID_COMPLETADO` se mantiene temporalmente para compatibilidad con la LC de prueba; la nueva LC no lo necesita porque el bloqueo global consulta DynamoDB.

Puedes usar `DANA_ACCESS_TOKEN` si ya tienes un token técnico fijo para el demo. Si prefieres OAuth, configura `DANA_TOKEN_URL` con `DANA_CLIENT_ID` y `DANA_CLIENT_SECRET`. `DANA_OAUTH_AUTH_METHOD=basic` envía el client id/secret por Basic Auth al token endpoint.

Para registrar tokens de Bedrock en otra lista DANA, configura `DANA_TOKEN_AUDIT_PROJECT_ID` con el ProjectID de esa conversación/lista. La Lambda llama:

```text
POST /api/2.0/rest/conversation/ProjectID/{projectId}/start/data
```

El cuerpo son los campos de auditoría. Por defecto usa `LAMBDA_NAME`, `MODEL_ID`, `NOMBRE_ARCHIVO_DOC`, `RESULTADO_VALIDOC`, `TOKENS_TOTALES`, `TOKEN_INPUT` y `TOKEN_OUTPUT`. `LAMBDA_NAME` se toma automáticamente de `AWS_LAMBDA_FUNCTION_NAME`; no requiere variable manual. Si la lista DANA usa otros códigos, ajusta `DANA_TOKEN_AUDIT_FIELDS_JSON` sin tocar código. Los campos `UID/idrow` y `FECHA` de `Bedrock_logs` no los envía la Lambda; `FECHA` la llena el flujo DANA con un nodo update.

El registro de tokens es no bloqueante: si Start Conversation falla, se deja traza en CloudWatch pero no se interrumpe la validación del documento. Se registra cada respuesta de Bedrock, tanto validaciones exitosas como fallidas. Si Bedrock falla sin devolver `usage`, se registra `RESULTADO_VALIDOC=VALIDATION_SERVICE_ERROR` con tokens en `0`.

Para File Upload se usa `POST /dana/conversation/http/rest/file/upload` con `multipart/form-data`, campo `file` y Basic Auth (`DANA_USERNAME`/`DANA_PASSWORD`). La respuesta esperada incluye `fileID`, que luego se escribe en `ADJUNTADOC1`.

Para actualizar el registro existente se usa Trigger con el `dataId`/`dana` recibido desde el enlace:

```text
POST /event/Trigger?dana={dataId}&CAMPO=valor
```

`TOMADOR_ID` no se usa como llave de actualización. Si Data Retrieval entrega `UID`, la Lambda lo transporta como `recordUid` y lo escribe en logs para verificar que el intento y la actualización pertenecen a la misma fila DANA.

La carga se bloquea si el registro actual está completado o si DynamoDB contiene un ítem `COMPLETED` para el mismo `TOMADOR_ID_KEY`. Si se abre un enlace de otra fila del mismo tomador, la Lambda escribe en esa fila `ESTADO_VALIDOC=COMPLETED` y copia `ADJUNTADOC1` desde DynamoDB. `TOMADOR_ID_COMPLETADO` sigue siendo un control legado de la LC de prueba.

Cuando Data Retrieval entrega `ESTADO_VALIDOC=COMPLETED`, el endpoint `GET /expedientes/{dataId}` responde `expedienteCompletado=true` y el frontend va directo a la pantalla de completado. La Lambda acepta el valor aunque venga como campo directo, dentro de `record`, dentro de `fields` o como objeto con `value`.

Si DANA crea un registro nuevo limpio con un `TOMADOR_ID` ya completado, la consulta a DynamoDB lo detecta al abrir el enlace. La prevención del correo inicial duplicado sigue siendo responsabilidad del proceso que inyecta o selecciona destinatarios; la Lambda actúa cuando se abre el enlace.

La Lambda no guarda un historial de intentos fallidos. Actualiza los campos del último fallo conocido (`MOTIVOFALLO`, `ESTADO_VALIDOC`, `INTENTOS_VALIDOC`, `DOCUMENTO_DETECTADO`, `NOMBRE_ARCHIVO_DOC`) desde el primer intento fallido. `MOTIVOFALLO` se escribe como texto legible para operaciones, por ejemplo `Documento no coincide con tomador`.

La validación de cédula acepta documentos horizontales, verticales o rotados 90, 180 o 270 grados siempre que la nacionalidad y el número sean legibles. La rotación por sí sola no debe generar fallo; sí se rechaza cuando la imagen está borrosa, recortada, con reflejos, sombras o baja resolución que impida leer el identificador.

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

`POST /documentos-identidad/validar` devuelve `validationProof` cuando Bedrock termina. La prueba firmada dura cinco minutos y vincula el `dataId`, el `UID`, el resultado y el hash del archivo. El frontend la envía a `/registrar` o a `/resultado` según corresponda. Una petición directa sin prueba válida no puede registrar un archivo ni un resultado.

Configura `VALIDATION_PROOF_SECRET` en la Lambda con un valor aleatorio de al menos 32 bytes antes de desplegar esta versión. La validación falla cerrada si falta. Para evitar interrumpir la carga: despliega primero el frontend que envía `validationProof`, después configura el secreto y despliega la Lambda. El frontend nuevo sigue funcionando temporalmente con la Lambda anterior porque el campo es adicional.

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
