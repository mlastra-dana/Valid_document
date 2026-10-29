# Portal Validoc de Mercantil Seguros

Aplicación web React para que clientes o asesores de Mercantil Seguros completen un expediente digital iniciado desde una comunicación enviada por DANAconnect.

## Objetivo

El portal recibe el parámetro `dana` de un enlace enviado por DANAconnect, consulta el expediente en la lista de contactos, permite cargar una cédula venezolana, valida el documento mediante Bedrock Sonnet, sube el archivo aprobado con File Upload API y actualiza el mismo registro DANA. DynamoDB conserva una entrada por tomador completado y otra por fila pendiente para controlar enlaces e intentos. El portal no implementa autenticación propia: quien tenga el enlace válido puede abrirlo desde otro navegador.

## Estado del portal

El flujo siguiente se probó con la lista DANA de pruebas. El paso a producción y las decisiones pendientes están en el [documento de seguimiento](docs/validoc-handoff-summary.md).

- Consulta de expediente desde DANA Data Retrieval usando el `dataId` del enlace.
- Obtención de `TOMADOR_ID` desde el registro DANA.
- Trazabilidad del `UID` único de la fila DANA como `recordUid`.
- Validación de cédula venezolana por nacionalidad y número exactos contra `TOMADOR_ID`.
- Carga de PDF, JPG, JPEG o PNG, con normalización backend del tipo real del archivo.
- Regla de tres intentos por ronda. Todos los enlaces válidos de la misma fila comparten el contador de DynamoDB. El flujo DANA marca `REINTENTO_VALIDOC=PENDIENTE` al enviar un recordatorio; la Lambda consume la marca una vez, reinicia los intentos y refleja el 0 en DANA.
- Registro del último fallo conocido en DANA con motivo legible para operaciones.
- File Upload a DANA solo cuando Bedrock valida correctamente el documento.
- Actualización del mismo registro DANA mediante Trigger.
- Bloqueo de nueva carga cuando `ESTADO_VALIDOC = COMPLETED` o `ADJUNTADOC1` ya tiene fileID.
- Bloqueo de carga cuando DynamoDB ya tiene un expediente completado para ese `TOMADOR_ID`, aunque el enlace pertenezca a otro `UID`.

Fuera de alcance del flujo actual:

- Validación de nombres y apellidos.
- Historial completo de intentos fallidos.
- Autenticación propia del portal.
- Reemplazo de documentos después de expediente completado.

## Flujo funcional

1. DANAconnect envía el correo inicial con el enlace de acceso.
2. El frontend recibe `?dana=...` del enlace y envía ese valor a la Lambda en la ruta y como `Authorization: Bearer`. Abrir el portal no registra por sí solo un evento en el flujo DANA.
3. La Lambda consulta Data Retrieval para obtener `TOMADOR_ID`, nombre, cédula informativa, estado y `UID_VALIDOC`. DANA no devolvió `UID` ni `idrow` directamente en las pruebas: un nodo Update previo al correo copia `idRow` a `UID_VALIDOC`.
4. La Lambda consulta `ms-validoc-prod` con la clave `VALIDOC_STAGE#TOMADOR_ID_NORMALIZADO`. Si el registro actual o el tomador ya están completados, el portal muestra cierre y no permite otra carga. Para una fila duplicada, copia a DANA el estado `COMPLETED` y la referencia original del documento.
5. El usuario carga PDF, JPG, JPEG o PNG de máximo 3 MB, o toma una foto desde cámara cuando el dispositivo lo permite. El portal rechaza un archivo mayor antes de enviarlo y no consume un intento.
6. El frontend envía el archivo en Base64 sin prefijo Data URL.
7. Bedrock Sonnet valida legibilidad, tipo de documento y documento detectado.
8. El backend compara nacionalidad más número contra `TOMADOR_ID`.
9. En éxito, el backend sube el archivo con File Upload API, actualiza DANAconnect mediante External Trigger y guarda en DynamoDB el completado, el UID de origen y la referencia del archivo. Una escritura condicional preserva el primer completado.
10. En fallo, el backend actualiza el último motivo conocido y los intentos usados de ese correo para que DANA pueda continuar con refuerzo o seguimiento.

## Tecnologías

- React 18
- Vite
- TypeScript estricto
- TailwindCSS
- React Router
- lucide-react
- ESLint y Prettier
- AWS Lambda Function URL
- Amazon DynamoDB (`ms-validoc-prod`)
- Amazon Bedrock con modelo Sonnet
- APIs Data Retrieval y Upload de DANAconnect
- PWA instalable con manifest y service worker

## Función Lambda y ambientes

- **Código backend:** `lambda/index.py`; handler `index.lambda_handler`. La función de pruebas utilizada hasta ahora aparece como `Valid_document` en la consola compartida. Confirmar el nombre exacto en AWS antes de crear o cambiar recursos.
- **Tabla:** `ms-validoc-prod`, clave `TOMADOR_ID_KEY`. `VALIDOC_STAGE=TEST` guarda `TEST#...` y `ATTEMPTS#TEST#UID`; `VALIDOC_STAGE=PROD` guarda `PROD#...` y `ATTEMPTS#PROD#UID`. El valor es una configuración de toda la Lambda. Cada ítem completado conserva únicamente la clave normalizada del tomador, `UID`, `ESTADO_VALIDOC=COMPLETED`, `ADJUNTADOC1` y la fecha; no contiene el archivo binario ni datos de contacto. Cada ítem de intentos conserva el contador compartido de la fila, el estado de consumo del recordatorio y una versión para las escrituras condicionales. Estas protegen el primer completado y la reserva de cada intento.
- **Nombre recomendado para una función real separada:** `ms-validoc-portal-prod`. `ms-prod` sería ambiguo entre proyectos. Conservar `Valid_document` para pruebas evita mezclar ambos flujos mientras se prepara producción. Este nombre es una propuesta; la nueva función no se ha creado.
- **Paso a producción:** crear la nueva Lambda con el mismo código, configurar su propia Function URL, variables y permisos, y apuntar la compilación del portal real (`VITE_API_BASE_URL`) a esa URL. Probar una carga válida y una fallida en el flujo real antes de enviar correos reales. La URL nueva de la API no cambia por sí sola el dominio del portal que reciben los clientes.

AWS no permite cambiar el nombre de una función Lambda existente en su configuración: para usar otro nombre hay que crear una función nueva. El despliegue y el cambio de `VITE_API_BASE_URL` los realiza la responsable del proyecto. Véase [resumen de implementación y pruebas](docs/validoc-handoff-summary.md).

## Requisitos

- Node.js 20 o superior recomendado.
- npm compatible con `package-lock.json`.

## Instalación

```bash
npm install
```

## Ejecución local

```bash
npm run dev
```

Modo demo:

```text
http://localhost:5173/completar-expediente?dana=ABC123&scenario=success
```

## Variables de entorno

Copia `.env.example` a `.env.local` para desarrollo:

```env
VITE_API_BASE_URL=https://api.example.com
VITE_API_URL=
VITE_USE_MOCK_API=false
VITE_APP_NAME=Portal de Consignación de Documento de Identidad
VITE_MAX_FILE_SIZE_MB=3
VITE_REQUEST_TIMEOUT_MS=30000
```

En pruebas integradas y producción, `VITE_API_BASE_URL` debe apuntar a la Function URL de la Lambda backend. El frontend también acepta `VITE_API_URL` como alias para ambientes donde ya exista ese nombre.

No agregues credenciales sensibles al frontend. No deben existir variables como `AWS_SECRET_ACCESS_KEY`, `AWS_ACCESS_KEY_ID`, contraseñas, API keys privadas ni credenciales de DANAconnect.

## Modo mock

El proyecto ya no usa mock por defecto. Actívalo solo cuando se quiera desarrollar sin backend:

```env
VITE_USE_MOCK_API=true
```

Escenarios disponibles por query parameter:

- `success`
- `completed`
- `unreadable`
- `wrong-document`
- `mismatch`
- `max-attempts`
- `expired`
- `server-error`

Ejemplos:

```text
/completar-expediente?dana=ABC123&scenario=unreadable
/completar-expediente?dana=ABC123&scenario=mismatch
```

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run typecheck
npm run lambda:check
npm run lambda:zip
npm run validate
```

## Estructura del proyecto

```text
src/
  api/
  components/
  config/
  hooks/
  lib/
  mocks/
  pages/
  routes/
  types/
```

La interfaz, lógica de negocio, consumo de API, utilidades, tipos y datos simulados están separados para facilitar mantenimiento.

Lambda:

```text
lambda/
  index.py
  README.md
```

La Lambda queda preparada para desplegarse con Function URL y documenta las variables necesarias para DANAconnect y Bedrock.

## Contratos de API

Consulta inicial:

```http
GET /expedientes/{dataId}
Authorization: Bearer {dataId-del-enlace}
```

Validación:

```http
POST /documentos-identidad/validar
Authorization: Bearer {dataId-del-enlace}
Content-Type: application/json
```

Registro documental:

```http
POST /documentos-identidad/registrar
Authorization: Bearer {dataId-del-enlace}
Content-Type: application/json
```

Resultado fallido:

```http
POST /expedientes/{dataId}/resultado
Authorization: Bearer {dataId-del-enlace}
Content-Type: application/json
```

## Seguridad

- El token `dana` viene en el enlace y se envía a la Lambda en `Authorization: Bearer`. El enlace debe tratarse como una credencial y no compartirse; los logs nuevos ocultan su valor en las rutas.
- El documento no se guarda en `localStorage` ni `sessionStorage`.
- El Base64 no se imprime en consola ni se coloca en rutas.
- Los números de documento se muestran parcialmente ocultos.
- El frontend valida tipo, extensión y tamaño, pero el backend debe validar de nuevo.
- El frontend no debe conectarse directamente a DynamoDB, S3, Bedrock ni DANAconnect usando credenciales.
- Las integraciones se realizan desde la Lambda mediante su Function URL; el navegador no recibe credenciales de DANA ni de AWS.

## Backend Lambda

El backend vive en [lambda/index.py](lambda/index.py) y está documentado en [lambda/README.md](lambda/README.md).

Responsabilidades:

- Recibir las rutas REST consumidas por el frontend.
- Usar Data Retrieval de DANAconnect para consultar el tomador y su `UID_VALIDOC`.
- Consultar DynamoDB por `TOMADOR_ID` normalizado y guardar el primer expediente completado con su referencia documental.
- Invocar Amazon Bedrock Sonnet para validar legibilidad, tipo de documento y número detectado.
- Registrar tokens de Bedrock en una lista DANA separada mediante Start Conversation por ProjectID, si `DANA_TOKEN_AUDIT_PROJECT_ID` está configurado.
- Comparar el número detectado contra el esperado del tomador.
- Usar File Upload API de DANAconnect para subir la cédula validada.
- Actualizar el mismo registro en DANA con Trigger usando el `dataId` del enlace y registrar `UID_VALIDOC` como UID de origen.

Variables del backend:

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
DANA_DATA_FIELDS=ADJUNTADOC1,DOCUMENTO_DETECTADO,EMAIL_TOMADOR,ESTADO_VALIDOC,FECHAULTIMOVALIDOC,INTENTOS_VALIDOC,MOTIVOFALLO,NOMBRETOMADOR,NOMBRE_ARCHIVO_DOC,PRODUCTO,REINTENTO_VALIDOC,TOMADOR_ID,UID_VALIDOC
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

La carpeta `lambda/` es la referencia del código que debe estar dentro de AWS Lambda.

Documentación adicional:

- [Estado, decisiones pendientes y salida a producción](docs/validoc-handoff-summary.md)
- [Campos de la nueva lista DANA](docs/dana/validoc-new-list-fields.md)
- [Lista DANA de auditoría de tokens](docs/dana/token-audit-list-fields.md)
- [Plantilla de correo Validoc](docs/dana/validoc-email-flow.md)

## Integración con DANAconnect

DANAconnect genera el enlace y entrega el `dataId` que permite leer una fila mediante Data Retrieval. Un nodo Update previo al correo escribe `idRow` en el campo personalizado `UID_VALIDOC` de esa fila. `TOMADOR_ID` se usa para cotejar la cédula y consultar los completados en DynamoDB; `TOMADOR_ID_COMPLETADO` se conserva solo por compatibilidad con la lista de pruebas.

Si se abre el enlace de otra fila con el mismo tomador ya completado, la Lambda marca esa fila como `COMPLETED` en DANA y copia la referencia documental original. Si la persona nunca abre ese segundo enlace, el portal no recibe el evento y no puede actualizar esa fila por sí solo. El control de a quién se envían los correos corresponde al flujo de DANA y a la carga de la lista.

## Integración con Document Manager

El endpoint `/documentos-identidad/registrar` representa la integración con API Upload, Document Manager, indexación documental y actualización del expediente.

En este flujo, el API Upload de DANAconnect recibe el documento validado desde la Lambda. Si DANAconnect delega internamente en Document Manager, el portal solo necesita conservar el `documentId` o referencia devuelta por ese servicio.

## Despliegue en AWS Amplify

El archivo `amplify.yml` está preparado para Amplify Hosting:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

## Variables en Amplify

Configura en Amplify:

- `VITE_API_BASE_URL`
- `VITE_USE_MOCK_API`
- `VITE_APP_NAME`
- `VITE_MAX_FILE_SIZE_MB`
- `VITE_REQUEST_TIMEOUT_MS`

No configures secretos de AWS ni credenciales privadas en variables `VITE_`.

Para producción:

```env
VITE_API_BASE_URL=https://abcxyz.lambda-url.us-east-1.on.aws
VITE_USE_MOCK_API=false
```

## PWA

La app incluye soporte PWA:

- `public/manifest.webmanifest`
- `public/sw.js`
- iconos `192x192`, `512x512` y `apple-touch-icon`
- meta tags para iOS y desktop

La PWA cachea solo el app shell y assets estáticos. No cachea endpoints de expediente, validación, registro ni documentos. La validación sigue requiriendo conexión y un enlace DANA vigente.

Para probar este demo ya integrado:

1. Desplegar la Lambda con Function URL.
2. Configurar en la Lambda `DANA_BASE_URL`, `DANA_TRIGGER_URL` y credenciales de Data Retrieval/File Upload.
3. Configurar permisos IAM para invocar Bedrock Sonnet.
4. Configurar en Amplify `VITE_API_BASE_URL` con la Function URL.
5. Abrir desde el external trigger de DANA para que viaje el identificador real de Data Retrieval.

## Rewrite para React Router

En Amplify Hosting agrega:

- Source address: `/<*>`
- Target address: `/index.html`
- Type: `200 (Rewrite)`

## Logo

Los logos visibles están en `public/icono-mercantil.png` y `public/mercantilseguros.png`.

## Pruebas manuales sugeridas

- Enlace sin `tomadorId` o sin `token`.
- Expediente completado con `scenario=completed`.
- Validación exitosa con `scenario=success`.
- Documento ilegible con `scenario=unreadable`.
- Archivo incorrecto con `scenario=wrong-document`.
- Documento que no corresponde con `scenario=mismatch`.
- Intentos agotados con `scenario=max-attempts`.
- Enlace expirado con `scenario=expired`.
- Error temporal con `scenario=server-error`.
- Carga por drag and drop, selección manual, cámara, eliminación con X y nueva carga.
- Validación de tamaño y formato de archivo.
- Responsive en 320, 375, 768, 1024 y 1440 px.

## Solución de problemas frecuentes

- Si la app consulta el backend real durante desarrollo, revisa `VITE_USE_MOCK_API=true`.
- Si una ruta directa muestra 404 en Amplify, configura el rewrite SPA.
- Si el backend rechaza el archivo, confirma que recibe solo el contenido Base64 sin prefijo.
- Si aparece un error temporal, revisa la Function URL, los logs de Lambda y la disponibilidad de DANAconnect o Bedrock.
