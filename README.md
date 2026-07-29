# Portal de Consignación de Documento de Identidad

Aplicación web React para que clientes o asesores de Mercantil Seguros completen un expediente digital iniciado desde una comunicación enviada por DANAconnect.

## Objetivo

El portal recibe el `dataId` entregado por DANAconnect desde un enlace único, consulta el expediente en `POC_VALIDOC`, permite cargar una cédula venezolana, valida el documento mediante Bedrock Sonnet, sube el archivo aprobado con File Upload API y actualiza el mismo registro DANA. El POC no implementa autenticación propia; usa el enlace generado por DANA como entrada del flujo.

## Estado del POC

El demo se considera estable para presentación con este alcance:

- Consulta de expediente desde DANA Data Retrieval usando el `dataId` del enlace.
- Obtención de `TOMADOR_ID` desde el registro DANA.
- Validación de cédula venezolana por nacionalidad y número exactos contra `TOMADOR_ID`.
- Carga de PDF, JPG, JPEG o PNG, con normalización backend del tipo real del archivo.
- Tres intentos máximos por expediente.
- Registro del último fallo conocido en DANA con motivo legible para operaciones.
- File Upload a DANA solo cuando Bedrock valida correctamente el documento.
- Actualización del mismo registro DANA mediante Trigger.
- Bloqueo de nueva carga cuando `ESTADO_VALIDOC = COMPLETED` o `ADJUNTADOC1` ya tiene fileID.

Fuera de alcance para este POC:

- Validación de nombres y apellidos.
- Historial completo de intentos fallidos.
- Autenticación propia del portal.
- Reemplazo de documentos después de expediente completado.

## Flujo funcional

1. DANAconnect envía el correo inicial con el enlace de acceso.
2. El frontend recibe el `dataId` entregado por el external trigger de DANA.
3. La Lambda consulta Data Retrieval y obtiene `TOMADOR_ID`, nombre, cédula informativa, estado e intentos.
4. Si el expediente ya está completado, el portal muestra cierre y no permite carga.
5. El usuario carga PDF, JPG, JPEG o PNG de máximo 10 MB, o toma una foto desde cámara cuando el dispositivo lo permite.
6. El frontend envía el archivo en Base64 sin prefijo Data URL.
7. Bedrock Sonnet valida legibilidad, tipo de documento y documento detectado.
8. El backend compara nacionalidad más número contra `TOMADOR_ID`.
9. En éxito, el backend sube el archivo con File Upload API y actualiza DANAconnect.
10. En fallo, el backend actualiza el último motivo conocido para que DANA pueda continuar con refuerzo o seguimiento.

## Tecnologías

- React 18
- Vite
- TypeScript estricto
- TailwindCSS
- React Router
- lucide-react
- ESLint y Prettier
- AWS Lambda Function URL
- Amazon Bedrock con modelo Sonnet
- APIs Data Retrieval y Upload de DANAconnect

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
VITE_MAX_FILE_SIZE_MB=10
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

- El token se conserva solo en memoria durante la sesión.
- El documento no se guarda en `localStorage` ni `sessionStorage`.
- El Base64 no se imprime en consola ni se coloca en rutas.
- Los números de documento se muestran parcialmente ocultos.
- El frontend valida tipo, extensión y tamaño, pero el backend debe validar de nuevo.
- El frontend no debe conectarse directamente a DynamoDB, S3, Bedrock ni DANAconnect usando credenciales.
- Las integraciones deben realizarse mediante API Gateway y Lambda u otro backend controlado.

## Backend Lambda

El backend vive en [lambda/index.py](/Users/marialastra/Documents/Valid_document/lambda/index.py) y está documentado en [lambda/README.md](/Users/marialastra/Documents/Valid_document/lambda/README.md).

Responsabilidades:

- Recibir las rutas REST consumidas por el frontend.
- Usar el API Data Retrieval de DANAconnect para consultar el tomador.
- Invocar Amazon Bedrock Sonnet para validar legibilidad, tipo de documento y número detectado.
- Comparar el número detectado contra el esperado del tomador.
- Usar File Upload API de DANAconnect para subir la cédula validada.
- Actualizar el mismo registro en DANA con Trigger usando el `dataId` del enlace.

Variables del backend:

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

La carpeta `lambda/` es la referencia del código que debe estar dentro de AWS Lambda.

Documentación adicional:

- [Ficha del Demo POC](/Users/marialastra/Documents/Valid_document/docs/demo-poc.md)
- [Arquitectura](/Users/marialastra/Documents/Valid_document/docs/architecture.md)
- [Proceso Validoc](/Users/marialastra/Documents/Valid_document/docs/process.md)
- [Lista DANA de pruebas](/Users/marialastra/Documents/Valid_document/docs/dana/validoc-test-list-fields.md)
- [Email Validoc](/Users/marialastra/Documents/Valid_document/docs/dana/validoc-email-flow.md)

## Integración con DANAconnect

DANAconnect genera el enlace y entrega el `dataId` que permite leer el expediente con Data Retrieval. `TOMADOR_ID` se obtiene desde el registro DANA y se usa como valor esperado para validar la cédula. El portal informa resultados al backend para que DANAconnect continúe el flujo correspondiente.

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
- Si aparece un error temporal, revisa disponibilidad de API Gateway/Lambda o del servicio de validación.
