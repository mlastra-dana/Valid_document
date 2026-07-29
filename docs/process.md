# Proceso Validoc

## Entrada

El usuario abre un enlace enviado por DANAconnect:

```text
/completar-expediente
```

El HTML no incluye `TOMADOR_ID` ni token en query parameters. El external trigger de DANA entrega el identificador real de Data Retrieval al portal.

## Consulta del expediente

La Lambda consulta Data Retrieval con los campos fijos de la lista Validoc.

Con `DANA_USERNAME` y `DANA_PASSWORD`, usa el camino estable:

```text
GET /api/1.0/rest/conversation/data/{tomadorId}?fields=...
Authorization: Basic ...
```

## Validación

El usuario puede intentar cargar el documento hasta tres veces.

Cada intento:

1. Envía el archivo a la Lambda en Base64.
2. La Lambda valida tipo y tamaño.
3. Bedrock Sonnet evalúa legibilidad, tipo de documento e identificador detectado.
4. La Lambda compara nacionalidad más número contra `TOMADOR_ID`. La coincidencia debe ser exacta.

## Fallos

No se guarda un historial de cada intento fallido en DANA.

Si falla un intento, la Lambda actualiza los campos del último resultado conocido: `MOTIVOFALLO`, `ESTADO_VALIDOC`, `INTENTOS_VALIDOC`, `DOCUMENTO_DETECTADO`, `NOMBRE_ARCHIVO_DOC` y `FECHAULTIMOVALIDOC`. Si el cliente abandona después del primer intento, DANA conserva ese último motivo.

El portal permite continuar mientras queden intentos disponibles. Si falla el tercer intento, el estado queda cerrado como `VALIDATION_FAILED`.

- `UNREADABLE_DOCUMENT`
- `NOT_IDENTITY_DOCUMENT`
- `TOMADOR_MISMATCH`

## Éxito

Si el documento es válido:

1. La Lambda sube el archivo con File Upload API. Esta llamada solo ocurre después de que la validación sea correcta.
2. DANAconnect retorna `fileID`.
3. La Lambda dispara el flujo de éxito por Start Conversation.
4. El frontend muestra la confirmación final.
