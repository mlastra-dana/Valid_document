# Arquitectura Validoc

## Componentes

- Frontend React en Amplify Hosting.
- AWS Lambda con Function URL en `lambda/index.py`.
- DANAconnect Data Retrieval API para consultar el registro del tomador.
- Amazon Bedrock Sonnet para validar la cédula.
- DANAconnect File Upload API para subir el documento aprobado.
- DANAconnect Start Conversation API para continuar el flujo de éxito o refuerzo.

## Flujo

```text
DANAconnect email
-> enlace con tomadorId/token
-> frontend Amplify
-> Lambda Function URL
-> Data Retrieval
-> Bedrock Sonnet
-> File Upload
-> Start Conversation
```

## Contrato DANA

Los campos de la lista Validoc son contrato fijo del proceso y viven en el código de la Lambda. No son variables de entorno.

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
- Project IDs o conversation IDs de resultado.
- Configuración de Bedrock.
- CORS, timeout y tamaño máximo.

La lista completa para copiar a Excel está en:

```text
lambda/environment-variables.csv
```
