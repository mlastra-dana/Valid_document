# Campos de la nueva lista de contactos Validoc

Campos base propuestos para la lista de producción. Conservar estos códigos para el portal y el flujo DANA. Los valores iniciales de resultado pueden estar vacíos. Los campos de rondas adicionales de intentos siguen pendientes de decisión con el cliente.

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
| `UID_VALIDOC` | Copia del UID real de esta fila, escrita por el Update de DANA con la expresión `idRow`. En la LC de prueba coinciden `UID=1` con `UID_VALIDOC=1` y `UID=17` con `UID_VALIDOC=17`. No viene del TXT. |

`UID` lo genera DANA y no se incluye en el TXT. Data Retrieval no devolvió `UID` ni `idrow` aunque la Lambda los solicitó; sí devolvió `UID_VALIDOC` después del Update. Una finalización nueva guardó ese UID en DynamoDB. `TOMADOR_ID_COMPLETADO` se usó en una prueba manual y **no** se crea en esta lista: la consulta global se hace en DynamoDB.

Antes de activar la nueva LC, configurar `DANA_DATA_FIELDS` para incluir `UID_VALIDOC` y excluir `TOMADOR_ID_COMPLETADO`; comprobar que Data Retrieval devuelve los campos y mapear los que escribe el External Trigger. `REINTENTO_VALIDOC` se agregaría solo si el cliente aprueba otra ronda de intentos y se implementa su control. Crear la lista no activa por sí solo esa lógica.
