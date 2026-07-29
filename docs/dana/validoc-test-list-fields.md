# Lista DANA de Pruebas Validoc

Lista objetivo: `POC_VALIDOC`.

Archivo importable:

```text
docs/dana/validoc-test-list-template.csv
```

## Campos POC_VALIDOC

`TOMADOR_ID`: identificador esperado para validar coincidencia exacta contra Bedrock. No viaja en el enlace; la Lambda lo obtiene desde Data Retrieval usando el `dataId` entregado por DANA. Debe incluir nacionalidad y número. Ejemplo: `V-5002012` o `E-1016824`.

`NOMBRETOMADOR`: nombre visible en el portal.

`CEDULA_TOMADOR`: número de cédula del tomador como dato informativo del expediente. La validación final usa `TOMADOR_ID`.

`EMAIL_TOMADOR`: correo del titular para comunicaciones DANA.

`TELEFONO_TOMADOR`: teléfono de contacto.

`PRODUCTO`: producto asociado al expediente.

`ADJUNTADOC1`: `fileID` retornado por File Upload API. Solo se llena después de que Bedrock valide que el documento es legible, es una cédula y coincide exactamente con `TOMADOR_ID`.

`DOCUMENTO_DETECTADO`: identificador leído por Bedrock, con nacionalidad y número cuando sea posible. Es texto de auditoría, no adjunto.

`ESTADO_VALIDOC`: estado del proceso. Ejemplos: `COMPLETED`, `VALIDATION_FAILED`. Si está en `COMPLETED`, el portal no permite cargar otro documento para ese expediente.

`FECHAULTIMOVALIDOC`: fecha/hora de la última actualización del proceso.

`INTENTOS_VALIDOC`: cantidad de intentos usados al momento de la última validación fallida del correo/proceso más reciente. No es un historial; se sobrescribe con el último intento conocido. No debe usarse como bloqueo permanente si DANA envía un nuevo correo para un expediente pendiente.

`MOTIVOFALLO`: último motivo conocido de fallo. Se actualiza desde el primer intento fallido para cubrir abandono del cliente. Se guarda como texto operativo legible. Ejemplos: `Documento no legible`, `Archivo no es cedula de identidad`, `Documento no coincide con tomador`.

`NOMBRE_ARCHIVO_DOC`: nombre del archivo seleccionado por el usuario. Es texto de auditoría; no sube ni guarda el archivo.

`UID`: identificador interno y único de la fila en DANA. La Lambda lo lee como referencia de trazabilidad (`recordUid`) para confirmar que el intento corresponde al registro correcto. No se sobrescribe durante la actualización.

## Uso en la Lambda

Estos campos forman parte del contrato del proceso Validoc. `DANA_DATA_FIELDS` controla los campos que Data Retrieval lee desde `POC_VALIDOC`; los campos que la Lambda actualiza con Trigger se mantienen mapeados en código porque tienen lógica asociada.

Data Retrieval solicita la lista completa para que el portal pueda mostrar el expediente y comparar contra `TOMADOR_ID`.

La actualización de éxito sobre el mismo registro envía:

```json
{
  "TOMADOR_ID": "V-5002012",
  "MOTIVOFALLO": "",
  "ADJUNTADOC1": "fileID-retornado-por-DANA",
  "FECHAULTIMOVALIDOC": "2026-07-28T20:15:00Z",
  "ESTADO_VALIDOC": "COMPLETED",
  "INTENTOS_VALIDOC": "",
  "DOCUMENTO_DETECTADO": "V-5002012",
  "NOMBRE_ARCHIVO_DOC": "cedula.pdf"
}
```

La actualización de fallo sobre el mismo registro envía el último resultado conocido:

```json
{
  "TOMADOR_ID": "V-5002012",
  "MOTIVOFALLO": "Documento no coincide con tomador",
  "ADJUNTADOC1": "",
  "FECHAULTIMOVALIDOC": "2026-07-28T20:15:00Z",
  "ESTADO_VALIDOC": "VALIDATION_FAILED",
  "INTENTOS_VALIDOC": "3",
  "DOCUMENTO_DETECTADO": "E-5002012",
  "NOMBRE_ARCHIVO_DOC": "cedula.pdf"
}
```
