# Proceso Validoc

## Entrada

El usuario abre un enlace enviado por DANAconnect:

```text
/completar-expediente
```

El HTML no incluye `TOMADOR_ID` ni token en query parameters. El external trigger de DANA entrega el identificador real de Data Retrieval al portal.

## Consulta del expediente

La Lambda consulta Data Retrieval con los campos configurados en `DANA_DATA_FIELDS`.

Con `DANA_USERNAME` y `DANA_PASSWORD`, usa el camino estable:

```text
GET /api/1.0/rest/conversation/data/{dataId}?fields=...
Authorization: Basic ...
```

El `dataId` viene del enlace entregado por DANA. `TOMADOR_ID` no viaja en el link; se obtiene desde Data Retrieval y queda como identificador esperado para validar la cédula.

Si el registro ya está completado, el portal no permite cargar otro documento para ese mismo expediente. Se considera completado cuando `ESTADO_VALIDOC` es `COMPLETED` o cuando `ADJUNTADOC1` ya contiene un `fileID`.

## Validación

El usuario puede intentar cargar el documento hasta tres veces.

Cada intento:

1. Envía el archivo a la Lambda en Base64.
2. La Lambda valida tipo y tamaño.
3. Bedrock Sonnet evalúa legibilidad, tipo de documento e identificador detectado.
4. La Lambda compara nacionalidad más número contra `TOMADOR_ID`. La coincidencia debe ser exacta.

Después de abrir el expediente, la validación usa el `TOMADOR_ID` ya obtenido y no vuelve a consultar Data Retrieval antes de Bedrock. Esto permite que el cliente tenga más margen para corregir y subir el documento dentro de la misma sesión del portal.

## Fallos

No se guarda un historial de cada intento fallido en DANA.

Si falla un intento, la Lambda actualiza los campos del último resultado conocido: `MOTIVOFALLO`, `ESTADO_VALIDOC`, `INTENTOS_VALIDOC`, `DOCUMENTO_DETECTADO`, `NOMBRE_ARCHIVO_DOC` y `FECHAULTIMOVALIDOC`. Si el cliente abandona después del primer intento, DANA conserva ese último motivo.

El portal permite continuar mientras queden intentos disponibles. Si falla el tercer intento, el estado queda cerrado como `VALIDATION_FAILED`.

Los motivos se escriben en DANA como textos operativos legibles, por ejemplo:

- `Documento no legible`
- `Archivo no es cedula de identidad`
- `Documento no coincide con tomador`

## Éxito

Si el documento es válido:

1. La Lambda sube el archivo con File Upload API. Esta llamada solo ocurre después de que la validación sea correcta.
2. DANAconnect retorna `fileID`.
3. La Lambda actualiza el mismo registro DANA usando el `dataId` del enlace.
4. El frontend muestra la confirmación final.

Si el cliente vuelve a abrir el mismo enlace después de completado, Data Retrieval retorna el estado actualizado y el portal muestra la pantalla de expediente completado sin habilitar carga.

## Ciclo validado en CloudWatch

El ciclo probado correctamente fue:

1. `GET /expedientes/{dataId}` consulta Data Retrieval y obtiene `record`.
2. La Lambda extrae `TOMADOR_ID`, nombre, cédula y estado del expediente.
3. `POST /documentos-identidad/validar` usa `source: "payload"` para validar contra Bedrock sin repetir Data Retrieval.
4. Bedrock retorna `VALID_DOCUMENT` con coincidencia exacta de nacionalidad y número.
5. `POST /documentos-identidad/registrar` sube el archivo validado y actualiza el mismo registro DANA.
6. DANA responde `{"result": true}` al Trigger de actualización.
