# Campos de la nueva lista de contactos Validoc

Campos de la lista de producción. Conservar estos códigos para el portal y el flujo DANA. Cada correo inicial o recordatorio concede tres intentos. DynamoDB controla las rondas y DANA conserva el contador visible para seleccionar recordatorios.

| Código | Origen y uso |
| --- | --- |
| `TOMADOR_ID` | Dato de entrada. Identificador con nacionalidad; clave de comparación del documento y de la consulta de completados en DynamoDB. |
| `NOMBRETOMADOR` | Dato de entrada. Nombre mostrado en portal y correo. |
| `EMAIL_TOMADOR` | Dato de entrada. Destinatario del correo. |
| `PRODUCTO` | Dato de entrada. Producto mostrado en el correo. |
| `ESTADO_VALIDOC` | Resultado del portal: pendiente, fallo, completado o cierre por duplicado según los valores definidos en el flujo. |
| `ADJUNTADOC1` | Referencia del documento devuelta por DANA, también copiada al registro duplicado cuando corresponda. |
| `FECHAULTIMOVALIDOC` | Fecha y hora de la última actualización de Validoc. |
| `INTENTOS_VALIDOC` | Intentos usados en la ronda actual de tres; iniciar en 0 o vacío. DANA selecciona el valor 3 solo si la fila sigue sin completar. La Lambda lo refleja desde DynamoDB. |
| `REINTENTO_VALIDOC` | Señal del recordatorio. El flujo escribe `PENDIENTE` al enviar un recordatorio a una fila con tres intentos y sin completar. Al abrir cualquier enlace válido de esa fila, la Lambda reinicia la ronda y escribe `CONSUMIDO`. Dejar vacío para el primer correo. |
| `MOTIVOFALLO` | Último motivo legible de fallo. |
| `DOCUMENTO_DETECTADO` | Identificador leído del documento. |
| `NOMBRE_ARCHIVO_DOC` | Nombre del archivo recibido. |
| `UID_VALIDOC` | Copia del UID real de esta fila, escrita por el Update de DANA con la expresión `idRow`. En la LC de prueba coinciden `UID=1` con `UID_VALIDOC=1` y `UID=17` con `UID_VALIDOC=17`. No viene del TXT. |

Son **13 campos base**: los primeros cuatro son datos de entrada y los otros nueve se llenan mediante el flujo o la Lambda. `CEDULA_TOMADOR` y `TELEFONO_TOMADOR` son opcionales. `UID` lo genera DANA y no se incluye en el TXT. Data Retrieval no devolvió `UID` ni `idrow` aunque la Lambda los solicitó; sí devolvió `UID_VALIDOC` después del Update. `TOMADOR_ID_COMPLETADO` no se crea.

Antes de activar la nueva LC, comprobar que Data Retrieval devuelve `UID_VALIDOC` y `REINTENTO_VALIDOC`, y que el External Trigger actualiza `INTENTOS_VALIDOC` y `REINTENTO_VALIDOC`. El valor `dana` puede cambiar al reabrir un correo; por eso no inicia rondas. Todos los enlaces vigentes de una misma fila comparten los tres intentos de la ronda actual. El flujo debe escribir `PENDIENTE` **solo al enviar un nuevo recordatorio**; la Lambda comprueba el completado en DynamoDB antes de consumir la señal. Una señal sin un nuevo correo no debe usarse para conceder intentos.
