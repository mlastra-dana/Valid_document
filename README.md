# Portal de Consignación de Documento de Identidad

Aplicación web React para que clientes o asesores de Mercantil Seguros completen un expediente digital iniciado desde una comunicación enviada por DANAconnect.

## Objetivo

El portal recibe `tomadorId` y `token` desde un enlace único, consulta el expediente, permite cargar una cédula venezolana, valida el documento mediante un servicio de IA, registra el resultado en el backend y muestra la confirmación final sin implementar autenticación propia.

## Flujo funcional

1. DANAconnect envía el correo inicial con el enlace de acceso.
2. El frontend lee `tomadorId` y `token` desde `/completar-expediente`.
3. El backend valida la relación entre token y tomador.
4. El portal consulta el expediente.
5. El usuario carga PDF, JPG, JPEG o PNG de máximo 10 MB.
6. El frontend envía el archivo en Base64 sin prefijo Data URL.
7. El servicio de IA valida legibilidad, tipo de documento y coincidencia.
8. El backend compara la cédula con la información del tomador.
9. En éxito, el backend registra e indexa en Document Manager y actualiza DANAconnect.
10. DANAconnect maneja comunicaciones iniciales, recordatorios y refuerzos.

## Tecnologías

- React 18
- Vite
- TypeScript estricto
- TailwindCSS
- React Router
- lucide-react
- ESLint y Prettier

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
http://localhost:5173/completar-expediente?tomadorId=ABC123&token=demo-token&scenario=success
```

## Variables de entorno

Copia `.env.example` a `.env.local` para desarrollo:

```env
VITE_API_BASE_URL=https://api.example.com
VITE_USE_MOCK_API=true
VITE_APP_NAME=Portal de Consignación de Documento de Identidad
VITE_MAX_FILE_SIZE_MB=10
VITE_REQUEST_TIMEOUT_MS=30000
```

No agregues credenciales sensibles al frontend. No deben existir variables como `AWS_SECRET_ACCESS_KEY`, `AWS_ACCESS_KEY_ID`, contraseñas, API keys privadas ni credenciales de DANAconnect.

## Modo mock

Activa el mock con:

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
/completar-expediente?tomadorId=ABC123&token=demo-token&scenario=unreadable
/completar-expediente?tomadorId=ABC123&token=demo-token&scenario=mismatch
```

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run typecheck
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

## Contratos de API

Consulta inicial:

```http
GET /expedientes/{tomadorId}
Authorization: Bearer {token}
```

Validación:

```http
POST /documentos-identidad/validar
Authorization: Bearer {token}
Content-Type: application/json
```

Registro documental:

```http
POST /documentos-identidad/registrar
Authorization: Bearer {token}
Content-Type: application/json
```

Resultado fallido:

```http
POST /expedientes/{tomadorId}/resultado
Authorization: Bearer {token}
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

## Integración con DANAconnect

DANAconnect genera el enlace, proporciona `tomadorId`, envía comunicaciones iniciales, recordatorios y refuerzos. El portal informa resultados al backend para que DANAconnect continúe el flujo correspondiente.

## Integración con Document Manager

El endpoint `/documentos-identidad/registrar` representa la integración con API Upload, Document Manager, indexación documental y actualización del expediente.

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

## Rewrite para React Router

En Amplify Hosting agrega:

- Source address: `/<*>`
- Target address: `/index.html`
- Type: `200 (Rewrite)`

## Logo

`public/mercantil-seguros-logo.svg` es un placeholder. Debe sustituirse por el recurso oficial autorizado de Mercantil Seguros antes de producción.

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
- Carga por drag and drop, selección manual, reemplazo y eliminación.
- Validación de tamaño y formato de archivo.
- Responsive en 320, 375, 768, 1024 y 1440 px.

## Solución de problemas frecuentes

- Si la app consulta el backend real durante desarrollo, revisa `VITE_USE_MOCK_API=true`.
- Si una ruta directa muestra 404 en Amplify, configura el rewrite SPA.
- Si el backend rechaza el archivo, confirma que recibe solo el contenido Base64 sin prefijo.
- Si aparece un error temporal, revisa disponibilidad de API Gateway/Lambda o del servicio de validación.
