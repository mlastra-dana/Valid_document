# Lambda del Portal Validoc

Esta carpeta contiene el backend del Portal Validoc de Mercantil Seguros. La función de pruebas observada en la consola compartida se denomina `Valid_document`; `ms-validoc-portal-prod` es el nombre propuesto para una función de producción separada, aún no creada. El nombre de la función en AWS no cambia el handler del código.

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

Runtime observado en los logs de la función de pruebas:

```text
Python 3.14
```

Al crear la función de producción, comprobar en AWS el runtime y las dependencias de la función de pruebas antes de copiar su configuración.

## Flujo

1. El frontend llama la Function URL con `Authorization: Bearer <dataId-del-enlace>`. La Lambda exige que el Bearer coincida con el `dataId` solicitado y comprueba el registro mediante Data Retrieval.
2. La Lambda consulta el expediente en DANAconnect usando Data Retrieval.
3. El nodo Update de DANA copia `idRow` a `UID_VALIDOC` antes de enviar el correo. Data Retrieval devolvió ese campo en las pruebas y la Lambda lo conserva como `recordUid`; los campos internos `UID` e `idrow` no se devolvieron directamente.
4. La Lambda recibe la cédula en Base64 y valida tipo/tamaño.
5. La Lambda invoca Bedrock Sonnet para leer el documento usando el `TOMADOR_ID` ya obtenido del expediente.
6. La Lambda toma el consumo de tokens de la respuesta de Bedrock.
7. Si `DANA_TOKEN_AUDIT_PROJECT_ID` está configurado, registra esos tokens en otra lista DANA con Start Conversation por ProjectID.
8. La Lambda compara la cédula detectada con la esperada por DANA.
9. Si es válida, sube el documento con el API Upload de DANAconnect.
10. Si una validación falla, registra el último motivo conocido y el número de intentos en DANA. Si se completa, registra en DynamoDB el tomador, el UID de origen y la referencia documental. Un segundo enlace del mismo tomador se cierra con la referencia original sin otra carga.

## Variables de entorno

```env
CORS_ORIGIN=https://ms.validoc.danaconnect.us
DANA_BASE_URL=https://appserv.danaconnect.com
DANA_TRIGGER_URL=https://appserv.danaconnect.com/event/Trigger
DANA_TOKEN_URL=https://auth.danaconnect.com/oauth2/token
DANA_ACCESS_TOKEN=
DANA_CLIENT_ID=
DANA_CLIENT_SECRET=
DANA_USERNAME=
DANA_PASSWORD=
DANA_OAUTH_SCOPE=
DANA_DATA_FIELDS=ADJUNTADOC1,CEDULA_TOMADOR,DOCUMENTO_DETECTADO,EMAIL_TOMADOR,ESTADO_VALIDOC,FECHAULTIMOVALIDOC,INTENTOS_VALIDOC,MOTIVOFALLO,NOMBRETOMADOR,NOMBRE_ARCHIVO_DOC,PRODUCTO,TELEFONO_TOMADOR,TOMADOR_ID,TOMADOR_ID_COMPLETADO,UID,UID_VALIDOC
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
MAX_FILE_SIZE_BYTES=3145728
```

`VALIDOC_TABLE_NAME` habilita la consulta y escritura de completados en DynamoDB. `VALIDOC_STAGE` debe ser `TEST` en la función de pruebas y `PROD` en la función del flujo real; forma parte de `TOMADOR_ID_KEY` para separar los registros dentro de la misma tabla. Es una variable de toda la función, no una propiedad detectada por cada enlace. Si se configura la tabla y la consulta falla, la Lambda detiene el flujo para evitar una nueva carga sin comprobar duplicados. Como este proceso comienza con la nueva lista, no hay completados históricos que migrar al activar `PROD`.

Para Data Retrieval hay dos caminos:

- Si configuras `DANA_USERNAME` y `DANA_PASSWORD`, se usa el camino estable probado: `GET /api/1.0/rest/conversation/data/{dana}?fields=...` con `Authorization: Basic ...`.
- Si no configuras usuario/password, se usa compatibilidad v2: `GET /api/2.0/rest/conversation/data/{dana}?{DANA_FIELDS_QUERY_PARAM}=...` con bearer token.

`DANA_DATA_FIELDS` controla los campos leídos desde `POC_VALIDOC`. Si agregas un campo de solo lectura, puedes actualizar esta variable sin tocar código. `TOMADOR_ID_COMPLETADO` se mantiene temporalmente para compatibilidad con la LC de prueba; la nueva LC no lo necesita porque el bloqueo global consulta DynamoDB.

Para registrar el UID real de la fila en DynamoDB, la Lambda lee `UID_VALIDOC` dentro de `record`. En la LC de prueba, el Update con expresión `idRow` escribió `UID_VALIDOC=1` en la fila `UID=1` y `UID_VALIDOC=17` en la fila `UID=17`. Se ejecuta antes del correo. Con `UID_VALIDOC` en `DANA_DATA_FIELDS`, CloudWatch mostró `data_retrieval_uid` con `source=record` y `present=true`; la usuaria confirmó un completado nuevo con UID en DynamoDB. No sustituir el UID por `requestID` ni por el parámetro `dana`.

Puedes usar `DANA_ACCESS_TOKEN` si ya tienes un token técnico fijo para las pruebas. Si prefieres OAuth, configura `DANA_TOKEN_URL` con `DANA_CLIENT_ID` y `DANA_CLIENT_SECRET`. `DANA_OAUTH_AUTH_METHOD=basic` envía el client id/secret por Basic Auth al token endpoint.

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

`TOMADOR_ID` no se usa como llave de actualización. Data Retrieval devolvió `UID_VALIDOC` tras el Update `idRow`; la Lambda lo transporta como `recordUid` y lo registra para relacionar el intento con la fila DANA.

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

El contador `_ATTEMPTS_CACHE` solo sirve como respaldo temporal. El conteo definitivo debe venir de DANAconnect o de una persistencia backend, porque la memoria de Lambda no es confiable entre invocaciones concurrentes o ambientes fríos.
