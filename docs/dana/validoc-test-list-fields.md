# Lista DANA de Pruebas Validoc

Lista objetivo: `POC_VALIDOC`.

Archivo importable:

```text
docs/dana/validoc-test-list-template.csv
```

## Campos POC_VALIDOC

`TOMADOR_ID`: identificador que viaja en el enlace como `tomadorId`. Es el valor esperado para validar coincidencia exacta contra Bedrock. Debe incluir nacionalidad y número. Ejemplo: `V-5002012` o `E-1016824`.

`NOMBRETOMADOR`: nombre visible en el portal.

`CEDULA_TOMADOR`: número de cédula del tomador como dato informativo del expediente. La validación final usa `TOMADOR_ID`.

`EMAIL_TOMADOR`: correo del titular para comunicaciones DANA.

`TELEFONO_TOMADOR`: teléfono de contacto.

`PRODUCTO`: producto asociado al expediente.

`ADJUNTADOC1`: `fileID` retornado por File Upload API. Solo se llena después de que Bedrock valide que el documento es legible, es una cédula y coincide exactamente con `TOMADOR_ID`.

`DOCUMENTO_DETECTADO`: identificador leído por Bedrock, con nacionalidad y número cuando sea posible. Es texto de auditoría, no adjunto.

`ESTADO_VALIDOC`: estado final del proceso. Ejemplos: `COMPLETED`, `VALIDATION_FAILED`.

`FECHAULTIMOVALIDOC`: fecha/hora de la última actualización del proceso.

`INTENTOS_VALIDOC`: cantidad de intentos usados al momento de la última validación fallida. No es un historial; se sobrescribe con el último intento conocido.

`MOTIVOFALLO`: último motivo conocido de fallo. Se actualiza desde el primer intento fallido para cubrir abandono del cliente. Ejemplos: `UNREADABLE_DOCUMENT`, `NOT_IDENTITY_DOCUMENT`, `TOMADOR_MISMATCH`.

`NOMBRE_ARCHIVO_DOC`: nombre del archivo seleccionado por el usuario. Es texto de auditoría; no sube ni guarda el archivo.

`UID`: identificador interno de la fila en DANA.

## Uso en la Lambda

Estos campos forman parte del contrato fijo del proceso Validoc. La Lambda los define en código para Data Retrieval y para el JSON enviado a Start Conversation; no se configuran como variables de entorno.

Data Retrieval solicita la lista completa para que el portal pueda mostrar el expediente y comparar contra `TOMADOR_ID`.

Start Conversation de éxito envía:

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

Start Conversation de fallo envía el último resultado conocido:

```json
{
  "TOMADOR_ID": "V-5002012",
  "MOTIVOFALLO": "TOMADOR_MISMATCH",
  "ADJUNTADOC1": "",
  "FECHAULTIMOVALIDOC": "2026-07-28T20:15:00Z",
  "ESTADO_VALIDOC": "VALIDATION_FAILED",
  "INTENTOS_VALIDOC": "3",
  "DOCUMENTO_DETECTADO": "E-5002012",
  "NOMBRE_ARCHIVO_DOC": "cedula.pdf"
}
```
