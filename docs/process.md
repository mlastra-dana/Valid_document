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

`UID` es la referencia única de la fila DANA. La Lambda lo lee como `recordUid` cuando Data Retrieval lo entrega y lo conserva para trazabilidad del intento. No se usa `TOMADOR_ID` como llave de actualización.

Si el registro actual ya está completado, el portal no permite cargar otro documento para ese mismo expediente. Se considera completado cuando `ESTADO_VALIDOC` es `COMPLETED` o cuando `ADJUNTADOC1` ya contiene un `fileID`.

`TOMADOR_ID` es mandatorio porque identifica al cliente y es el valor contra el que se valida la cédula. La regla de negocio global es: si DANA ya tiene ese `TOMADOR_ID` como completado en cualquier `UID`, el portal no debe permitir una nueva carga y debe mostrar la pantalla de completado.

Como Data Retrieval entrega el registro asociado al `dataId` abierto, DANA debe incluir en ese registro un indicador de duplicado completado, por ejemplo `TOMADOR_ID_COMPLETADO=1`. La Lambda también acepta alias como `TOMADOR_COMPLETADO`, `TOMADOR_VALIDADO` o `TOMADORID_COMPLETADO`. Si ese indicador viene en verdadero, el portal trata el expediente como completado aunque el `UID` actual esté pendiente.

## Control previo en DANA

Antes de enviar un nuevo correo o crear un nuevo ciclo para un `TOMADOR_ID`, DANA debe validar si ese tomador ya tiene un expediente completado en `POC_VALIDOC`.

Regla esperada:

1. Si no existe otro `UID` completado para ese `TOMADOR_ID`, el registro nuevo puede quedar pendiente y el portal permite la carga.
2. Si existe cualquier `UID` completado para ese `TOMADOR_ID`, DANA no debería iniciar una nueva validación. Si por operación se genera el nuevo registro/enlace, ese registro debe viajar con `TOMADOR_ID_COMPLETADO=1` para que el portal vaya directo a la pantalla de completado.

Caso importante: si se crea un `UID` nuevo con el mismo `TOMADOR_ID` y ese registro viene limpio, sin `ESTADO_VALIDOC`, sin `ADJUNTADOC1` y sin `TOMADOR_ID_COMPLETADO`, la Lambda no puede saber con Data Retrieval que otro `UID` ya fue completado. En ese escenario el portal lo trataría como pendiente. Por eso el control por `TOMADOR_ID` debe ocurrir en DANA antes de enviar el enlace, o debe existir un API adicional que permita buscar completados por `TOMADOR_ID`.

Las alternativas técnicas para resolver esta duplicidad están documentadas en `docs/duplicate-tomador-options.md`.

## Validación

El usuario puede intentar cargar el documento hasta tres veces por enlace/correo.

Cada intento:

1. Envía el archivo a la Lambda en Base64.
2. La Lambda valida tipo y tamaño.
3. Bedrock Sonnet evalúa legibilidad, tipo de documento e identificador detectado.
4. La Lambda toma `input_tokens` y `output_tokens` de la respuesta de Bedrock.
5. Si `DANA_TOKEN_AUDIT_PROJECT_ID` está configurado, registra esa auditoría en otra lista DANA usando Start Conversation por ProjectID.
6. La Lambda compara nacionalidad más número contra `TOMADOR_ID`. La coincidencia debe ser exacta.

La auditoría de tokens no modifica el expediente de Validoc y no bloquea al usuario. Si DANA no recibe el registro de tokens por un error temporal, la validación continúa y el fallo queda en CloudWatch.

Después de abrir el expediente, la validación usa el `TOMADOR_ID` ya obtenido y no vuelve a consultar Data Retrieval antes de Bedrock. Esto permite que el cliente tenga más margen para corregir y subir el documento dentro de la misma sesión del portal.

Cuando DANA envia un nuevo correo o recordatorio con un nuevo `dataId`, el portal inicia el ciclo de ese registro. Si el mismo enlace se recarga, el portal toma `INTENTOS_VALIDOC` del registro actual para mantener el contador visible alineado con DANA.

Refrescar la pagina vuelve a consultar el expediente, pero no cuenta como intento. Un intento se consume solo cuando el usuario adjunta/toma un documento y la Lambda devuelve una respuesta de validacion activa para ese archivo.

## Fallos

No se guarda un historial de cada intento fallido en DANA.

Si falla un intento, la Lambda actualiza los campos del último resultado conocido: `MOTIVOFALLO`, `ESTADO_VALIDOC`, `INTENTOS_VALIDOC`, `DOCUMENTO_DETECTADO`, `NOMBRE_ARCHIVO_DOC` y `FECHAULTIMOVALIDOC`. Si el cliente abandona después del primer intento, DANA conserva ese último motivo y el contador usado.

El portal permite continuar mientras queden intentos disponibles en el enlace actual. Si el intento final valida correctamente, el estado queda `COMPLETED` y `INTENTOS_VALIDOC` conserva el total de intentos usados en ese ciclo. Si falla el tercer intento, el estado queda como `VALIDATION_FAILED` para que DANA pueda enviar refuerzo o seguimiento.

Los motivos se escriben en DANA como textos operativos legibles, por ejemplo:

- `Documento no legible`
- `Archivo no es cedula de identidad`
- `Documento no coincide con tomador`

## Éxito

Si el documento es válido:

1. La Lambda sube el archivo con File Upload API. Esta llamada solo ocurre después de que la validación sea correcta.
2. DANAconnect retorna `fileID`.
3. La Lambda actualiza el mismo registro DANA usando el `dataId` del enlace y registra `recordUid` en logs para validar trazabilidad con la fila DANA.
4. El frontend muestra la confirmación final.

Si el cliente vuelve a abrir el mismo enlace después de completado, Data Retrieval retorna el estado actualizado y el portal muestra la pantalla de expediente completado sin habilitar carga. Si abre un enlace de otro `UID` con el mismo `TOMADOR_ID`, DANA debe retornar `TOMADOR_ID_COMPLETADO=1` para aplicar el mismo cierre.

## Ciclo validado en CloudWatch

El ciclo probado correctamente fue:

1. `GET /expedientes/{dataId}` consulta Data Retrieval y obtiene `record`.
2. La Lambda extrae `TOMADOR_ID`, nombre, cédula y estado del expediente.
3. `POST /documentos-identidad/validar` usa `source: "payload"` para validar contra Bedrock sin repetir Data Retrieval.
4. Bedrock retorna `VALID_DOCUMENT` con coincidencia exacta de nacionalidad y número.
5. `POST /documentos-identidad/registrar` sube el archivo validado y actualiza el mismo registro DANA.
6. DANA responde `{"result": true}` al Trigger de actualización.
