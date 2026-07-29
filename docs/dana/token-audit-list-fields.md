# Lista DANA de Auditoría de Tokens

Lista objetivo: `Bedrock_logs`.

Esta lista recibe un registro por cada validación procesada por Bedrock. No reemplaza ni actualiza `POC_VALIDOC`; solo conserva auditoría de consumo y resultado técnico del intento.

## Cómo se registra

La Lambda toma el consumo desde la respuesta de Bedrock:

```json
{
  "usage": {
    "input_tokens": 1250,
    "output_tokens": 180
  }
}
```

Luego llama Start Conversation por ProjectID:

```text
POST /api/2.0/rest/conversation/ProjectID/{DANA_TOKEN_AUDIT_PROJECT_ID}/start/data
```

Si `DANA_TOKEN_AUDIT_PROJECT_ID` está vacío, la auditoría queda desactivada. Si la llamada falla, el usuario no se bloquea; solo queda un log `token_audit_start_conversation_failed` en CloudWatch.

Se registra cada respuesta de Bedrock, tanto resultados exitosos como fallidos. Si Bedrock falla sin devolver consumo, se registra `RESULTADO_VALIDOC=VALIDATION_SERVICE_ERROR` con tokens en `0`.

## Campos sugeridos

`DATA_ID`: identificador del enlace/proceso recibido desde DANA. Permite asociar la auditoría al ciclo exacto consultado por Data Retrieval.

`LAMBDA_NAME`: nombre de la Lambda que hizo la invocación. Se toma automáticamente de `AWS_LAMBDA_FUNCTION_NAME`, variable que AWS Lambda inyecta en runtime.

`MODEL_ID`: modelo Bedrock usado en la validación.

`NOMBRE_ARCHIVO_DOC`: nombre del archivo que generó la invocación.

`RESULTADO_VALIDOC`: código técnico del resultado. Ejemplos: `VALID_DOCUMENT`, `TOMADOR_MISMATCH`, `UNREADABLE_DOCUMENT`.

`TOKENS_TOTALES`: suma de tokens de entrada y salida.

`TOKEN_INPUT`: tokens de entrada reportados por Bedrock.

`TOKEN_OUTPUT`: tokens de salida reportados por Bedrock.

`TOMADOR_ID`: identificador del cliente usado para validar la cédula.

`VALIDOC_UID`: `UID` del registro de `POC_VALIDOC` cuando Data Retrieval lo entrega.

`UID`: identificador interno/autonumérico de la lista `Bedrock_logs`. No lo envía la Lambda.

`FECHA`: este campo existe en la lista, pero no lo envía la Lambda. Lo llena el flujo DANA con un nodo update.

## Mapeo configurable

La Lambda usa estos códigos por defecto:

```json
{
  "dataId": "DATA_ID",
  "lambdaName": "LAMBDA_NAME",
  "recordUid": "VALIDOC_UID",
  "tomadorId": "TOMADOR_ID",
  "modelId": "MODEL_ID",
  "inputTokens": "TOKEN_INPUT",
  "outputTokens": "TOKEN_OUTPUT",
  "totalTokens": "TOKENS_TOTALES",
  "reasonCode": "RESULTADO_VALIDOC",
  "fileName": "NOMBRE_ARCHIVO_DOC"
}
```

Si la lista DANA usa otros nombres de campo, configura `DANA_TOKEN_AUDIT_FIELDS_JSON` con el mismo formato. Los valores de la izquierda son llaves internas de la Lambda; los valores de la derecha son códigos de campo DANA.
