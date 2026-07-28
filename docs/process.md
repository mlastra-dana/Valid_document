# Proceso Validoc

## Entrada

El usuario abre un enlace enviado por DANAconnect:

```text
/completar-expediente?tomadorId=...&token=...
```

`tomadorId` identifica el registro en DANAconnect. El token viaja como bearer token hacia la Lambda.

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
3. Bedrock Sonnet evalúa legibilidad, tipo de documento y número detectado.
4. La Lambda compara el número detectado contra `NoCedula`.

## Fallos

No se registra cada intento fallido en DANA.

Si falla el intento 1 o 2, el portal solo muestra el motivo y permite intentar de nuevo.

Si falla el tercer intento, la Lambda dispara una sola vez el flujo de refuerzo por Start Conversation con el motivo final:

- `UNREADABLE_DOCUMENT`
- `NOT_IDENTITY_DOCUMENT`
- `TOMADOR_MISMATCH`

## Éxito

Si el documento es válido:

1. La Lambda sube el archivo con File Upload API.
2. DANAconnect retorna `fileID`.
3. La Lambda dispara el flujo de éxito por Start Conversation.
4. El frontend muestra la confirmación final.
