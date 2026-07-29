# Arquitectura Validoc

## Componentes

- Frontend React en Amplify Hosting.
- AWS Lambda con Function URL en `lambda/index.py`.
- DANAconnect Data Retrieval API para consultar el registro del tomador.
- Amazon Bedrock Sonnet para validar la cédula.
- DANAconnect File Upload API para subir el documento aprobado.
- DANAconnect Trigger para actualizar el mismo registro de `POC_VALIDOC`.

## Flujo

```text
DANAconnect email
-> enlace con dataId/dana
-> frontend Amplify
-> Lambda Function URL
-> Data Retrieval
-> Bedrock Sonnet
-> File Upload
-> Trigger update sobre el mismo registro
```

## Contrato DANA

Los campos de lectura de la lista Validoc se configuran con `DANA_DATA_FIELDS`. Los campos que se escriben quedan mapeados en código porque tienen lógica de negocio.

La lista de prueba está en:

```text
docs/dana/validoc-test-list-template.csv
```

La explicación de campos está en:

```text
docs/dana/validoc-test-list-fields.md
```

## Configuración

Las variables de entorno se limitan a:

- Credenciales DANAconnect.
- Base URL y token URL.
- Trigger URL para actualizar el mismo registro.
- Configuración de Bedrock.
- CORS, timeout y tamaño máximo.

La lista completa para copiar a Excel está en:

```text
lambda/environment-variables.csv
```
