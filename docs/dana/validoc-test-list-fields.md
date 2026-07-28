# Lista DANA de Pruebas Validoc

Archivo importable:

```text
docs/dana/validoc-test-list-template.csv
```

## Campos recomendados

`Titular_ID`: identificador que viaja en el enlace como `tomadorId`. Ejemplo: `V-5002012`.

`NombreTitular`: nombre visible en el portal.

`Correo_Titular`: correo del titular para comunicaciones DANA.

`Telefono_Titular`: teléfono de contacto.

`NoCedula`: número esperado para comparar contra Bedrock. Ejemplo: `5002012`.

`Producto`: producto asociado al expediente.

`Correo_Interno`: correo operativo o de control interno.

`FechaUltimoValidaDoc`: fecha/hora de la última validación.

`ProcesaValidaDoc1`: marca de control para iniciar o permitir el proceso.

`EnviadoValidaDoc`: marca de correo inicial enviado.

`AperturaValidaDoc`: marca de apertura del correo o enlace.

`ReboteValidaDoc`: marca de rebote.

`FiltradoValidaDoc`: marca de filtrado.

`IrConsigna`: marca o URL/flag para llevar al portal de consignación.

`ConsignaDoc`: estado simple de consignación. Puede quedar vacío, `1`, `COMPLETED` o equivalente según el flujo DANA.

`ConsignaDocADS`: `fileID` retornado por File Upload API.

`EstadoConsignaDoc`: estado final del proceso. Ejemplos: `COMPLETED`, `VALIDATION_FAILED`.

`MotivoFallidoDoc`: motivo final solo cuando se agotan los tres intentos. Ejemplos: `UNREADABLE_DOCUMENT`, `NOT_IDENTITY_DOCUMENT`, `TOMADOR_MISMATCH`.

`IntentosValidaDoc`: cantidad de intentos usados al cierre del proceso.

`DocumentoDetectado`: número detectado por Bedrock, enmascarado o normalizado según el criterio de negocio.

`NombreArchivoCedula`: nombre del archivo subido.

`FechaConsignaDoc`: fecha/hora final de consignación.

## Uso en la Lambda

Estos campos forman parte del contrato fijo del proceso Validoc. La Lambda los define en código para Data Retrieval y para el JSON enviado a Start Conversation; no se configuran como variables de entorno.

Data Retrieval solicita la lista completa para que el portal pueda mostrar el expediente y comparar `NoCedula`.

Start Conversation de éxito/fallo envía un JSON con estos campos de salida:

```json
{
  "Titular_ID": "V-5002012",
  "EstadoConsignaDoc": "COMPLETED",
  "MotivoFallidoDoc": "",
  "IntentosValidaDoc": "1",
  "ConsignaDocADS": "fileID-retornado-por-DANA",
  "NombreArchivoCedula": "cedula.pdf",
  "DocumentoDetectado": "V5002012"
}
```
