# Validoc: estado para dirección y salida a producción

Actualizado el 29 de octubre de 2026. Este es el único documento de seguimiento del proyecto. El [README principal](../README.md) explica el uso técnico del portal y el [README de la Lambda](../lambda/README.md) detalla la configuración del backend.

## Resumen para la jefa

Validoc permite que el tomador abra el enlace enviado por DANAconnect, cargue su cédula y reciba una validación automática con Amazon Bedrock. Si es válida, la Lambda guarda el archivo en DANA, marca la fila de la lista de contactos como `COMPLETED` y registra en DynamoDB un completado por tomador. Así, si la misma persona tiene otra fila por otro producto, el portal reconoce que ya consignó el documento, impide una segunda carga y copia la referencia original a esa fila cuando se abre su enlace.

La integración principal y la prevención de doble carga **se probaron con la lista de pruebas**. Aún no se ha creado ni activado el flujo de producción. No existen completados históricos que migrar: este proceso comienza con la nueva lista.

| Ajuste realizado | Estado comprobado |
| --- | --- |
| Consulta por enlace DANA y lectura de la fila mediante Data Retrieval | Probado en navegador normal e incógnito. |
| UID de origen: el Update DANA copia `idRow` a `UID_VALIDOC` antes del correo | Data Retrieval devolvió el campo; un completado nuevo guardó su UID en DynamoDB. |
| Tabla `ms-validoc-prod`, con claves `TEST#...` o `PROD#...` y una entrada por tomador completado | Probados guardado, consulta, bloqueo y conservación de la referencia original. |
| Segundo UID del mismo tomador | El portal mostró «ya completado», actualizó la segunda fila DANA y no sobrescribió el ítem original. |
| Carga válida | Probados Bedrock, File Upload, actualización DANA y registro en DynamoDB. |
| Protección de los endpoints de registro con prueba firmada del archivo, válida cinco minutos | Cubierta por pruebas locales; el despliegue anterior ya permitió el flujo de carga. |
| CORS | La captura de AWS confirma `CORS_ORIGIN=https://ms.validoc.danaconnect.us`; el portal pudo consultar la API. |
| Ajustes de interfaz y seguridad recientes | Retirada la referencia interna y el texto final innecesario; el código local oculta el token `dana` en las rutas registradas en nuevos logs. Su publicación depende del despliegue de la responsable del proyecto. |
| Tamaño de archivo | El código limita PDF/JPG/JPEG/PNG a 3 MB sin modificar el archivo. Con un PDF de 3.641.327 bytes, el portal local y el desplegado mostraron el error de tamaño. En el portal desplegado el contador permaneció en 2 de 3 y el navegador no hizo una solicitud de validación. Falta repetirlo en el futuro flujo de producción. |

## Esquema actual

1. DANA envía un correo con un enlace que contiene `dana`. El enlace sirve como credencial: quien lo tenga puede abrirlo en otro navegador. Abrirlo consulta la fila. Un nuevo valor `dana` no demuestra que se haya enviado un nuevo correo.
2. El portal envía el valor a la Lambda en la ruta y en `Authorization: Bearer`. La Lambda consulta Data Retrieval para obtener `TOMADOR_ID`, `UID_VALIDOC` y los campos del expediente.
3. La Lambda busca `VALIDOC_STAGE#TOMADOR_ID_NORMALIZADO` en DynamoDB. Cada completado conserva solo esa clave, el UID de origen, `COMPLETED`, la referencia `ADJUNTADOC1` y la fecha; no el documento binario ni datos de contacto. `TEST` y `PROD` son prefijos de configuración de la Lambda, no valores detectados automáticamente por fila.
4. Si encuentra un completado, cierra el portal. Si el enlace corresponde a otra fila del mismo tomador, marca esa fila `COMPLETED` en DANA y copia `ADJUNTADOC1`. La escritura de DynamoDB es condicional y no reemplaza al primer completado.
5. Si el tomador está pendiente, la Lambda usa un ítem de intentos en DynamoDB por `UID_VALIDOC` y reserva de forma condicional uno de los tres intentos antes de invocar Bedrock. DANA recibe una copia del contador para seleccionar recordatorios. En éxito, la Lambda sube el archivo a DANA, actualiza la fila mediante External Trigger y guarda el completado en DynamoDB. En fallo, registra el último motivo en DANA.

## Decisión confirmada: intentos por comunicación

Cada correo inicial o recordatorio debe conceder **tres intentos**. La regla fue confirmada el 29 de octubre de 2026. La prueba integral mostró que el mismo UID 6 recibió valores `dana` distintos en aperturas sucesivas, incluso al volver al primer correo. Por eso el token no identifica una comunicación ni autoriza el reinicio. La Lambda registró `retry_round_started`, DANA respondió HTTP 200 con `result:true` y una captura posterior confirmó la fila 6 en `PENDING` con 0 intentos. La escritura de 0 sí funcionó en esa prueba.

**Diseño local corregido, aún sin desplegar:** cuando el flujo envía un recordatorio a una fila con tres intentos y sin completar, escribe `REINTENTO_VALIDOC=PENDIENTE`. Al abrir cualquier enlace válido de esa fila, la Lambda consulta primero los completados en DynamoDB. Si sigue pendiente, consume la marca una vez con una actualización condicional, reinicia el contador compartido a 0, escribe `INTENTOS_VALIDOC=0` y `REINTENTO_VALIDOC=CONSUMIDO` en DANA y relee la fila para confirmar ambos valores antes de permitir la nueva ronda. Cualquier enlace vigente de esa fila puede usarla; abrir enlaces adicionales no crea otra ronda. Los completados siguen siendo globales por tomador. DynamoDB ya no guarda hashes de enlaces. Falta probar este diseño contra el flujo DANA real antes de desplegarlo como solución final.

## Decisiones pendientes con el cliente

1. **Pantalla al agotar intentos.** La cuarta carga se bloquea, pero al abrir el enlace aún se ve el área de carga. Acordar el mensaje definitivo para ese caso.
2. **Fila duplicada y recordatorios.** Acordar si, después de que el cliente abra el segundo enlace y el portal cierre esa fila, DANA enviará una disculpa y cómo evitar enviarla más de una vez. Si el cliente nunca abre ese enlace, el portal no puede actualizar esa fila por sí solo; el primer recordatorio podría llegar.

## Preparación pendiente para producción

- Crear una Lambda nueva con nombre propuesto `ms-validoc-portal-prod`. La función de pruebas observada en AWS se llama `Valid_document`; no se puede cambiar su nombre en el mismo recurso. La responsable del proyecto realiza el despliegue. La nueva función tendrá su propia Function URL, variables, rol/permisos y logs.
- Configurar en esa Lambda `VALIDOC_STAGE=PROD` y `VALIDOC_TABLE_NAME=ms-validoc-prod`. La tabla ya existe; `PROD#...` separará los expedientes reales de `TEST#...`. Configurar las credenciales DANA, Bedrock, `VALIDATION_PROOF_SECRET` y `MAX_FILE_SIZE_BYTES=3145728`, con permisos mínimos de lectura y escritura de la tabla.
- Preparar la nueva lista DANA con los [13 campos base del proceso](dana/validoc-new-list-fields.md). El Update debe escribir `UID_VALIDOC=idRow` antes del primer correo. El flujo DANA selecciona filas con tres intentos y sin completar, escribe `REINTENTO_VALIDOC=PENDIENTE` al enviarles el recordatorio y no reinicia por sí mismo `INTENTOS_VALIDOC`.
- Apuntar el portal real a la Function URL nueva mediante `VITE_API_BASE_URL` y configurar `VITE_MAX_FILE_SIZE_MB=3`. Mantener `CORS_ORIGIN` en `https://ms.validoc.danaconnect.us`. El dominio del portal incluido en los correos puede seguir igual.
- En el flujo real, probar una carga válida, un documento rechazado, un segundo UID del mismo tomador y archivos a ambos lados del límite de 3 MB. Comprobar en CloudWatch que los nuevos eventos no muestren el token `dana` completo. Probar el recordatorio con la misma fila y verificar que concede tres intentos nuevos.
- Probar de extremo a extremo el control de ronda corregido: agotar tres intentos, marcar `REINTENTO_VALIDOC=PENDIENTE` al enviar el recordatorio, abrir tanto el correo nuevo como el anterior, verificar un solo reinicio, tres intentos compartidos y `REINTENTO_VALIDOC=CONSUMIDO` en DANA. Confirmar también que un tomador ya completado se cierra sin reiniciar.
- Revisar límites de solicitudes y alarmas de gasto de Bedrock. Confirmar con DANA la vigencia o revocación del enlace; no se verificó un plazo. El acceso por enlace es el comportamiento actual y CORS no sustituye la autorización del endpoint.

Las pruebas locales actuales pasan: 25 pruebas de Lambda y compilación del frontend. Estas pruebas no sustituyen las comprobaciones del nuevo flujo DANA y de la configuración desplegada en AWS. La sincronización del contador de DynamoDB hacia DANA debe verificarse antes de declarar listo el despliegue.
