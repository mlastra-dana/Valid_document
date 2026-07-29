# Demo POC Validoc

## Proposito

Demostrar un portal de consignacion de cedula integrado con DANAconnect, AWS Lambda Function URL y Amazon Bedrock Sonnet.

El usuario entra desde un correo enviado por DANA, carga su cedula y el sistema valida si el documento corresponde exactamente al tomador del expediente.

## Criterio funcional estable

El POC valida contra `TOMADOR_ID`.

`TOMADOR_ID` debe incluir nacionalidad y numero, por ejemplo:

```text
V-24657722
E-1016824
```

No se validan nombres ni apellidos en este POC. El nombre se muestra al usuario como referencia del expediente, pero la coincidencia real se hace por nacionalidad mas numero.

## Datos minimos en DANA

Para una prueba estable, cada registro de `POC_VALIDOC` debe tener:

- `TOMADOR_ID`: requerido para validar.
- `NOMBRETOMADOR`: recomendado para mostrar el expediente.
- `CEDULA_TOMADOR`: informativo.
- `EMAIL_TOMADOR`: recomendado para comunicaciones.
- `ESTADO_VALIDOC`: control del proceso.
- `ADJUNTADOC1`: fileID final cuando el documento fue aceptado.
- `INTENTOS_VALIDOC`: intentos usados en el ultimo correo/proceso. Es auditoria, no bloqueo permanente.
- `MOTIVOFALLO`: ultimo motivo legible de fallo.
- `DOCUMENTO_DETECTADO`: documento leido por Bedrock.
- `NOMBRE_ARCHIVO_DOC`: nombre del archivo cargado.
- `FECHAULTIMOVALIDOC`: ultima actualizacion del flujo.
- `UID`: identificador unico de la fila DANA para trazabilidad.

## Flujo de prueba esperado

1. DANA envia el correo con el enlace del portal.
2. El enlace entrega el `dataId` al portal.
3. La Lambda consulta Data Retrieval y obtiene el registro del expediente.
4. La Lambda conserva `UID` como `recordUid` para auditar que el intento corresponde a la fila DANA correcta.
5. Si `ESTADO_VALIDOC` es `COMPLETED` o `ADJUNTADOC1` tiene valor, el portal muestra expediente completado.
6. Si el expediente esta pendiente, un nuevo correo inicia un nuevo ciclo de tres intentos.
7. El usuario carga PDF, JPG, JPEG o PNG, o toma foto desde camara.
8. Bedrock valida que sea cedula venezolana, legible y que coincida con `TOMADOR_ID`.
9. Si coincide, la Lambda sube el archivo por File Upload API.
10. La Lambda actualiza el mismo registro DANA con Trigger.
11. El portal muestra confirmacion.

## Criterios de exito

La demo se considera exitosa si:

- El expediente se carga con los datos del tomador.
- El documento correcto pasa como `VALID_DOCUMENT`.
- DANA recibe `ADJUNTADOC1` con fileID.
- `ESTADO_VALIDOC` queda en `COMPLETED`.
- `DOCUMENTO_DETECTADO` coincide con `TOMADOR_ID`.
- Al abrir de nuevo el enlace, el portal muestra expediente completado y no permite cargar otro archivo.

## Criterios de fallo controlado

Cuando el documento no pasa, DANA conserva el ultimo resultado conocido:

- `Documento no legible`
- `Archivo no es cedula de identidad`
- `Documento no coincide con tomador`
- `Formato de archivo no permitido`
- `Archivo supera el tamano permitido`
- `Servicio de validacion no disponible`

No se guarda historial completo de intentos. Se guarda el ultimo motivo para que soporte, KAM u operaciones puedan entender el caso aunque el usuario abandone.

Si DANA envia un recordatorio o nuevo correo porque el expediente sigue pendiente, ese nuevo enlace debe permitir tres intentos nuevamente. `INTENTOS_VALIDOC` puede conservar el valor anterior como referencia operativa, pero el portal no lo usa como bloqueo global.

## Alcance fuera del POC

- Validacion de nombres y apellidos.
- Reemplazo de documento despues de completado.
- Historial detallado por intento.
- Autenticacion propia del portal.
- Edicion manual de datos del expediente desde el portal.
