# Pruebas de entrega y seguridad del portal Validoc

Fecha: 21 de octubre de 2026. Los identificadores de enlace y datos personales se omiten.

| Nº | Prueba | Resultado observado | Estado |
| --- | --- | --- | --- |
| 1 | Abrir el botón de un correo DANA | El enlace incluye `dana` y abre un expediente ya completado. | Confirmado |
| 2 | Reabrir el enlace completado en incógnito | Muestra el mismo expediente sin iniciar sesión; no muestra carga. | Confirmado |
| 3 | Abrir un enlace pendiente en incógnito | Muestra datos del expediente y la pantalla para adjuntar un archivo sin iniciar sesión. | Confirmado |
| 4 | Agotar tres intentos | Se sigue mostrando la pantalla de carga aunque el contador indica que no quedan intentos, pero la interfaz no permite cargar un cuarto archivo. El usuario propone mostrar un mensaje de límite alcanzado desde la apertura, sujeto a confirmación del cliente. | Bloqueo visual confirmado; decisión de UX pendiente |
| 5 | Preparar pruebas siguientes | El contador se cambió a dos intentos usados para continuar las pruebas. El bloqueo tras agotarse ya fue comprobado desde la interfaz; no se repetirá esa prueba. | Registrado |
| 6 | Alterar el identificador `dana` | Al añadir `99` al identificador, el portal mostró «Expediente no encontrado» sin revelar datos del expediente. | Confirmado |
| 7 | Apertura del enlace y Trigger | Nuestro portal no llama al Trigger al abrir el enlace: consulta el expediente mediante Data Retrieval. El Trigger se usa al registrar un resultado de validación. Por eso la apertura no se registra como evento de nuestro flujo. Esto no descarta métricas de clic independientes que DANA pudiera tener configuradas. | Aclarado por diseño del portal |
| 8 | Nuevo `UID` para `TOMADOR_ID` ya completado | La lista DANA muestra un registro anterior `COMPLETED` y otro registro nuevo para el mismo `TOMADOR_ID`. El enlace del nuevo registro abre el portal como `Pendiente` con 3 intentos disponibles y opción de carga. | Hallazgo confirmado; bloqueante para la regla global por tomador |
| 9 | Correo nuevo después de marcar el indicador | Con `TOMADOR_ID_COMPLETADO=1` en el registro consultado y un correo nuevo, el portal muestra «completado». Esto confirma que el portal puede leer el indicador para ese registro. No resuelve que un `UID` duplicado nuevo reciba el indicador automáticamente. | Lectura del indicador confirmada; propagación global pendiente |
| 10 | Archivo de extensión no permitida | Al arrastrar un `.txt`, el portal mostró «La extensión del archivo no está permitida». Falta confirmar que el contador y el registro DANA no cambiaron. | Rechazo de interfaz confirmado |
| 11 | Autorización y validación del endpoint | Prueba local con servicios simulados antes de la corrección: sin `Bearer` el GET devolvió 401; con `Bearer cualquier-cadena` el GET devolvió 200; `POST /documentos-identidad/registrar` devolvió 200 e invocó la función de subida sin llamar a Bedrock. La prueba no usó DANA ni archivos reales. Se preparó una corrección local con vínculo Bearer/`dana` y prueba firmada del archivo; todavía no está desplegada. | Fallo confirmado localmente; corrección local pendiente de integración y despliegue |

## Validaciones pendientes

- Confirmar con DANA la vigencia y revocación del parámetro `dana`; no se encontró un plazo público garantizado.
- Acordar cómo el flujo DANA deja de enviar recordatorios después de que el cliente abre el enlace duplicado y el portal actualiza esa fila. La lectura de `TOMADOR_ID_COMPLETADO=1` en el registro consultado ya quedó confirmada.
- El enlace sin `dana` mostró «Enlace inválido» y el alterado mostró «Expediente no encontrado»; no hace falta repetirlos.
- Integrar y desplegar la corrección local del backend: configurar `VALIDATION_PROOF_SECRET` de al menos 32 bytes, desplegar primero el frontend compatible y después la Lambda; probar con un enlace real de prueba el flujo éxito/fallo y el rechazo de una llamada sin prueba. No realizar pruebas destructivas contra expedientes de producción. La comprobación global de completados en DynamoDB y el contador persistente de intentos siguen pendientes como parte de la siguiente fase.
- Verificar la continuación correcta de la conversación DANA después de los resultados de validación.

## Observación técnica

El componente del portal muestra el mensaje de máximo de intentos solo cuando su estado local pasa a `max-attempts`. Al abrir un expediente, el estado inicial es `idle` aunque `intentosRealizados` sea igual a `maximoIntentos`; el botón puede estar deshabilitado, pero la pantalla de carga sigue visible. El límite del backend usa valores enviados por el navegador y memoria temporal de Lambda, por lo que requiere validación independiente antes de producción.

`TOMADOR_ID_COMPLETADO` es una señal para los registros nuevos que comparten un tomador ya completado; el flujo actual de éxito no escribe ese campo automáticamente en el registro que se completó. Poner `1` en el registro original no hace que los nuevos `UID` hereden ese valor. El portal consulta solamente el registro del enlace abierto.

Diagnóstico local sin cambios de código: la función `tomador_id_completed_flag` interpretó `"1"` como verdadero en cuatro formas de respuesta simulada (campo directo, `record`, `fields` como objeto y `fields` como lista). El valor por defecto de `DANA_DATA_FIELDS` incluye el campo. La prueba con un nuevo correo después de marcar el registro confirmó también la lectura en el flujo desplegado. Lo que falta es el cálculo o propagación automática para un `UID` duplicado nuevo.

## Mejora opcional: registrar acceso al portal

La apertura no actualiza actualmente la lista DANA. Se podría agregar `FECHA_PRIMER_ACCESO_PORTAL` y marcarlo solo después de recuperar correctamente un expediente válido. Mantenerlo separado de `ESTADO_VALIDOC` y de la continuación por éxito del Trigger. Un clic de correo puede provenir de un sistema de seguridad que inspecciona enlaces; por eso conviene distinguir clic de acceso efectivo, y ninguno de los dos demuestra identidad o validación.

Decisiones útiles para el flujo: recordatorio si no hay acceso después del plazo acordado; ayuda para quien accedió pero no intentó cargar; instrucciones específicas si `INTENTOS_VALIDOC` es 1 o 2; revisión asistida si agota los intentos; detener recordatorios cuando `ESTADO_VALIDOC=COMPLETED`. Evitar enviar recordatorios solo por no detectar acceso hasta validar la fiabilidad de la señal.

## Solución propuesta para duplicados globales

La fuente que crea un registro nuevo puede considerarlo pendiente en su propio proceso; no le corresponde calcular si el tomador completó Validoc en otro `UID`. `TOMADOR_ID_COMPLETADO=1` era una señal manual/de integración para suplir la falta de consulta global. Con un índice de DynamoDB por `TOMADOR_ID` normalizado, esa señal deja de ser requisito para el portal.

Antes de activar la regla, cargar en DynamoDB los `TOMADOR_ID` con `ESTADO_VALIDOC=COMPLETED` históricos de DANA, deduplicados. DynamoDB contendrá **solo expedientes completados**, con los campos estándar que utiliza Validoc: `TOMADOR_ID` normalizado como clave; `UID` de origen; `NOMBRETOMADOR`, `CEDULA_TOMADOR`, `EMAIL_TOMADOR`, `TELEFONO_TOMADOR`, `PRODUCTO`; `ESTADO_VALIDOC=COMPLETED`, `FECHAULTIMOVALIDOC`, `ADJUNTADOC1` (referencia `fileID`/ruta), `DOCUMENTO_DETECTADO`, `NOMBRE_ARCHIVO_DOC` e `INTENTOS_VALIDOC`. `MOTIVOFALLO` debería quedar vacío en el registro completado. No guardar el archivo binario ni el parámetro secreto `dana` en DynamoDB. El registro canónico de un tomador conserva el `UID` que completó primero; abrir enlaces duplicados actualiza sus filas en DANA sin sobrescribir ese origen. Al completar un expediente, actualizar DANA y DynamoDB, con control de concurrencia y reconciliación si una de las dos escrituras falla. Los registros pendientes siguen en DANA y no se guardan en DynamoDB.

Alcance aclarado por conversación previa aportada por la usuaria: el equipo Validoc no controla el TXT de origen ni su importación; valida los registros que ya están en la lista DANA. Pueden existir dos `UID` con el mismo `TOMADOR_ID` y haberse enviado dos correos antes de que uno complete. No atribuir al equipo Validoc una acción sobre el TXT.

Para la excepción: cuando el primer `UID` completa, la Lambda escribe el completado global y la referencia del documento por `TOMADOR_ID` en DynamoDB. El recordatorio mensual es un correo nuevo al registro duplicado pendiente. Puede contener un `dana` nuevo por enlace, pero debe seguir consultando el mismo `UID` de la lista; verificarlo en el flujo real. **Cuando la persona abre el enlace del recordatorio**, el portal consulta DynamoDB; si otro `UID` ya completó ese tomador, muestra «ya completado», escribe en la fila pendiente de DANA la referencia original `s3://WS/...` y una marca de resuelto por duplicidad, y bloquea una nueva carga. El flujo DANA usa la actualización de esa fila para detener recordatorios posteriores. La disculpa, si se decide enviar, debe ocurrir una sola vez.

Este caso no requiere un nodo API adicional en el flujo del recordatorio: el enlace de ese correo permite al portal identificar y actualizar la fila actual mediante su parámetro `dana`. La actualización depende de que la persona abra el enlace; si ignora el recordatorio, el portal no recibe ese `dana` y la fila seguirá pendiente. En reunión debe acordarse el nombre exacto del estado/campos, el filtro de recordatorios y el texto de la disculpa.

## Aclaración del caso de negocio (transcripción aportada)

Una persona que aún no existe en la lista puede aparecer dos o más veces en el TXT por tener distintos productos. DANA crea varios `UID` y envía varios correos. La persona consigna la cédula en uno de ellos, por lo que solo ese registro recibe la ruta/fileID y queda `COMPLETED`; los otros siguen sin ruta y pueden generar recordatorios mensuales incorrectos. Históricamente, cuando alguien reclamaba, se eliminaba manualmente la fila duplicada. El objetivo acordado es resolver la fila pendiente **cuando el cliente abra el enlace del correo de recordatorio**, que puede tener un `dana` distinto del inicial pero debe apuntar al mismo registro.

Control al abrir el enlace duplicado, ya sea desde el correo inicial o el recordatorio: consultar DynamoDB por `TOMADOR_ID`, verificar que el `SOURCE_UID` completado es distinto del `UID` actual, bloquear una segunda carga y actualizar esa misma fila mediante el `dana` recibido con la referencia original y la marca acordada. Hacer la actualización idempotente para que recargar el portal no repita la disculpa.

Límite operativo: si la persona no abre el recordatorio, no se produce la consulta al portal y la fila duplicada sigue pendiente. El mecanismo acordado corrige la fila al abrir el enlace y evita recordatorios posteriores; no evita el primer recordatorio que llevó a esa apertura. Esto no requiere modificar el TXT de origen.

## Reintentos después de agotar los tres intentos

El contacto agotado permanece en su misma fila DANA. El recordatorio es un correo nuevo y su enlace External Trigger puede traer un `dana` distinto; el `UID` de la lista sigue siendo el mismo. Un `dana` nuevo **no reinicia automáticamente** `INTENTOS_VALIDOC`: si la fila aún dice 3, el portal seguirá indicando 0 disponibles. El portal puede conceder la nueva ronda al abrir el recordatorio: (1) consultar DynamoDB por `TOMADOR_ID` y, si está completado, bloquear la carga y resolver la fila duplicada; (2) si no está completado, comprobar en DANA que el mismo `UID` tiene 3 intentos y un campo de autorización del recordatorio, por ejemplo `REINTENTO_VALIDOC=PENDIENTE`; (3) consumir esa autorización una sola vez, reiniciar `INTENTOS_VALIDOC` en esa misma fila y cambiar la marca a `CONSUMIDO`, dejando fecha/ciclo. Un valor permanente como `OK` sin cambio de estado permitiría reiniciar los intentos repetidamente. La ausencia en DynamoDB por sí sola no demuestra tres fallos ni autoriza el reinicio. Si el flujo solo envía este recordatorio a agotados, puede poner la marca de autorización al programar/enviar ese correo. Al reiniciar el contador compartido, los enlaces viejos que consulten la fila también podrían quedar reactivados. Si deben seguir agotados, se requiere estado por comunicación/enlace o invalidación de enlaces anteriores. Ninguna opción crea un registro nuevo ni agrega pendientes a la tabla de completados de DynamoDB.

Hallazgo técnico para esa regla: la Lambda actual usa `attemptsUsed` recibido del navegador y una caché en memoria (`_ATTEMPTS_CACHE`) indexada por `dataId` (`dana`) como parte del límite. Un `dana` nuevo puede crear una entrada de caché distinta, pero el contador de la fila DANA sigue siendo 3. Cambiar `INTENTOS_VALIDOC` en DANA tampoco constituye por sí solo una protección fiable contra manipulación del cliente; el servidor debe leer y aplicar el contador/ciclo autorizado desde una fuente persistente y actualizarlo de forma consistente. Prueba siguiente: agotar un registro, enviarle el recordatorio real, comparar los dos `dana`, consultar el `UID` y `INTENTOS_VALIDOC` que recupera cada enlace, y verificar la pantalla de carga. No se modificó código.

## Campos para la nueva lista de contactos DANA

Crear en la nueva LC los campos de entrada y resultado que usa el proceso, más el campo de reintento acordado. `TOMADOR_ID_COMPLETADO` fue útil para la prueba manual de la LC de test, pero no forma parte del diseño nuevo: la Lambda consultará los completados en DynamoDB por `TOMADOR_ID`.

| Grupo | Códigos | Motivo |
| --- | --- | --- |
| Datos de entrada y comunicación | `TOMADOR_ID`, `NOMBRETOMADOR`, `EMAIL_TOMADOR`, `PRODUCTO` | Coincidencia de cédula, nombre mostrado, destinatario y variables del correo. |
| Resultado, bloqueo y seguimiento | `ESTADO_VALIDOC`, `ADJUNTADOC1`, `INTENTOS_VALIDOC`, `MOTIVOFALLO`, `FECHAULTIMOVALIDOC`, `DOCUMENTO_DETECTADO`, `NOMBRE_ARCHIVO_DOC` | Campos que la Lambda escribe y/o consulta; deben existir aunque su valor inicial esté vacío. |
| Nuevo control de ronda | `REINTENTO_VALIDOC` | El flujo pone `PENDIENTE` al autorizar otra ronda; el portal lo cambia a `CONSUMIDO` cuando reinicia el contador una vez. Campo propuesto: requiere implementación, todavía no existe en el código actual. |
| Datos disponibles | `CEDULA_TOMADOR`, `TELEFONO_TOMADOR` | Los consulta la Lambda actual; son informativos o útiles si se usa SMS. |

`UID` es el identificador de la fila generado por DANA: confirmar que Data Retrieval lo entrega; no crearlo como dato de entrada del TXT. Para distinguir cierre por duplicidad puede utilizarse un valor acordado de `ESTADO_VALIDOC` más la ruta en `ADJUNTADOC1`; no hace falta otro campo hasta decidir la lógica de disculpa. Si se desea auditoría de varias rondas, agregar opcionalmente `CICLO_REINTENTO_VALIDOC` y `FECHA_REINTENTO_VALIDOC`. Cuando se implemente DynamoDB, quitar `TOMADOR_ID_COMPLETADO` de `DANA_DATA_FIELDS` de la configuración de producción; su lectura actual es legado de la prueba manual.
