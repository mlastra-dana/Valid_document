# Campos de la nueva lista de contactos Validoc

Propuesta acordada para la lista de producción. Conservar exactamente estos códigos para el portal y el flujo DANA. Los valores iniciales de resultado y reintento pueden estar vacíos.

| Código | Origen y uso |
| --- | --- |
| `TOMADOR_ID` | Dato de entrada. Identificador con nacionalidad; clave de comparación del documento y de la consulta de completados en DynamoDB. |
| `NOMBRETOMADOR` | Dato de entrada. Nombre mostrado en portal y correo. |
| `EMAIL_TOMADOR` | Dato de entrada. Destinatario del correo. |
| `PRODUCTO` | Dato de entrada. Producto mostrado en el correo. |
| `CEDULA_TOMADOR` | Dato de entrada informativo. El control de coincidencia usa `TOMADOR_ID`. |
| `TELEFONO_TOMADOR` | Dato de entrada informativo o para SMS. |
| `ESTADO_VALIDOC` | Resultado del portal: pendiente, fallo, completado o cierre por duplicado según los valores definidos en el flujo. |
| `ADJUNTADOC1` | Referencia del documento devuelta por DANA, también copiada al registro duplicado cuando corresponda. |
| `FECHAULTIMOVALIDOC` | Fecha y hora de la última actualización de Validoc. |
| `INTENTOS_VALIDOC` | Intentos usados en la ronda actual; iniciar en 0 o vacío. |
| `MOTIVOFALLO` | Último motivo legible de fallo. |
| `DOCUMENTO_DETECTADO` | Identificador leído del documento. |
| `NOMBRE_ARCHIVO_DOC` | Nombre del archivo recibido. |
| `REINTENTO_VALIDOC` | Nueva autorización de una ronda adicional: vacío, `PENDIENTE` o `CONSUMIDO`. El flujo pone `PENDIENTE`; el portal lo consume una sola vez al reiniciar el contador. Requiere implementación en la Lambda. |
| `UID_VALIDOC` | Copia del UID real de esta fila, escrita por el Update de DANA con la expresión `idRow`. En la LC de prueba coinciden `UID=1` con `UID_VALIDOC=1` y `UID=17` con `UID_VALIDOC=17`. No viene del TXT. |

`UID` lo genera DANA y no se incluye en el TXT. En la prueba del 22 de octubre de 2026, Data Retrieval **no devolvió** ese UID aunque la Lambda lo solicitó; únicamente devolvió los campos de negocio del registro y un `requestID` que identifica la solicitud, no la fila. La captura de la LC comprueba que el Update sí puede copiar el UID a `UID_VALIDOC` en dos filas. Falta comprobar que Data Retrieval devuelva `UID_VALIDOC` antes de cerrar la trazabilidad de extremo a extremo. `TOMADOR_ID_COMPLETADO` se usó en la prueba manual y **no** se crea en esta lista: la consulta global se hará en DynamoDB.

Antes de activar la nueva LC, ajustar la configuración `DANA_DATA_FIELDS` para incluir `REINTENTO_VALIDOC` y `UID_VALIDOC`, excluir `TOMADOR_ID_COMPLETADO`, comprobar que Data Retrieval devuelve estos códigos y mapear los campos que escribe el External Trigger a la nueva lista. Crear la lista no activa por sí solo la lógica de DynamoDB o de reintentos.
