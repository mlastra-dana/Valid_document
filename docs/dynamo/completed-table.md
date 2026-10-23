# Tabla DynamoDB de Validoc

## Nombre

Tabla creada en DynamoDB: `ms-validoc-prod`, con clave de partición `TOMADOR_ID_KEY` (String) y sin clave de ordenación, según la captura compartida el 22 de octubre de 2026. Aparece en estado `Active`.

`ms` corresponde a Mercantil Seguros y `validoc` al portal de `ms.validoc.danaconnect.us`. El nombre no limita los estados futuros. La Lambda identificará la tabla mediante `VALIDOC_TABLE_NAME`.

Comprobación de solo lectura realizada el 21 de octubre de 2026: la Lambda actual se llama `Valid_document` y está en `us-east-1`. Verificar en la consola que `ms-validoc-prod` se haya creado en esa misma región. Todavía no se ha integrado la Lambda con la tabla.

## Clave y alcance

- Clave de partición: `TOMADOR_ID_KEY` (String). Incluir ambiente y valor normalizado, por ejemplo `TEST#V2457722` o `PROD#V2457722` para `V-2457722`; conservar letras y ceros iniciales. Si se prueban ambos ambientes en esta tabla de producción, el prefijo impide que un completado de prueba bloquee a un cliente real. Mantener los ítems de prueba identificados y retirarlos al cerrar las pruebas.
- Sin clave de ordenación: la regla acordada es **un completado global por tomador**, aunque DANA tenga varios `UID` o productos.
- En la primera fase, la tabla contendrá exclusivamente registros completados. Los pendientes, fallos e intentos viven en la lista DANA. En el futuro se pueden añadir otros valores de estado en los ítems sin cambiar el nombre de la tabla.
- No configurar vencimiento automático para estos completados: se necesitan para impedir nuevas cargas de un tomador ya validado.

## Datos del ítem completado

Guardar la ficha estándar del registro de DANA que completó primero:

```json
{
  "TOMADOR_ID_KEY": "TEST#V2457722",
  "TOMADOR_ID": "V-2457722",
  "UID": "1",
  "NOMBRETOMADOR": "Nombre de ejemplo",
  "CEDULA_TOMADOR": "2457722",
  "EMAIL_TOMADOR": "ejemplo@correo.test",
  "TELEFONO_TOMADOR": "0000000000",
  "PRODUCTO": "Vitales",
  "ESTADO_VALIDOC": "COMPLETED",
  "FECHAULTIMOVALIDOC": "2026-10-21T16:00:00Z",
  "ADJUNTADOC1": "s3://WS/ruta-de-ejemplo",
  "DOCUMENTO_DETECTADO": "V-2457722",
  "NOMBRE_ARCHIVO_DOC": "cedula.pdf",
  "INTENTOS_VALIDOC": 1,
  "MOTIVOFALLO": ""
}
```

`UID` identifica la fila original que completó. Al abrir otra fila del mismo tomador, la Lambda consulta esta tabla, muestra «ya completado» y escribe la referencia `ADJUNTADOC1` en la fila duplicada de DANA sin sobrescribir el ítem original. No guardar el parámetro `dana` ni el archivo binario en la tabla.

## Integración prevista

1. Verificar que `ms-validoc-prod` esté en `us-east-1` con la clave indicada; la captura confirma nombre, clave y estado activo, pero no muestra la región.
2. Dar a la Lambda permiso mínimo `dynamodb:GetItem` y `dynamodb:PutItem` sobre esa tabla. La usuaria confirmó la creación de la política el 22 de octubre de 2026.
3. Configurar `VALIDOC_TABLE_NAME=ms-validoc-prod` y el ambiente (`TEST` durante pruebas, `PROD` al pasar al flujo real) en la Lambda. La Lambda formará la clave con ese prefijo.
4. La integración local en `lambda/index.py` consulta al abrir un enlace y antes de registrar un archivo; escribe el ítem después de completar DANA, de forma condicional para no sustituir un completado anterior. Todavía no se ha desplegado.
5. Migrar los completados históricos de la LC de prueba/producción antes de activar el bloqueo global.
6. Probar dos `UID` del mismo `TOMADOR_ID`: el primero completa, el segundo muestra completado y recibe la ruta en su fila DANA.

Este documento registra la tabla creada por la usuaria y la integración local. El comportamiento desplegado no cambia hasta configurar las variables y publicar la Lambda.

## Prueba desplegada del 22 de octubre de 2026

La usuaria abrió el enlace de una fila de prueba ya completada. El export de DynamoDB `results.csv` confirma un ítem con clave `TEST#` para ese `TOMADOR_ID`, `ESTADO_VALIDOC=COMPLETED` y `ADJUNTADOC1` con la referencia del archivo. Esto verifica la carga retrospectiva al abrir ese enlace. `UID` quedó vacío en el ítem; comprobar si Data Retrieval entrega ese campo y cómo viene estructurado antes de dar por cerrada la trazabilidad.

Después abrió el enlace de una fila nueva con otro `UID` y el mismo `TOMADOR_ID`: el portal mostró «Tu expediente ya fue completado» y el ítem original de DynamoDB no cambió. La usuaria confirmó que esa fila DANA recibió `ESTADO_VALIDOC=COMPLETED` y la misma referencia `ADJUNTADOC1`; la captura deja visible el estado. Esta prueba confirma la lectura del completado global, el bloqueo de una segunda carga y la actualización de la fila duplicada al abrir su enlace. Pendiente: completar por primera vez una fila nueva y verificar que ese flujo escriba directamente en DynamoDB; también aclarar por qué `UID` queda vacío en el ítem retrospectivo.

En la prueba siguiente, el portal mostró «Documento recibido exitosamente» para una fila nueva y la lista DANA mostró `ESTADO_VALIDOC=COMPLETED` con ruta de archivo. La captura posterior de DynamoDB mostró dos ítems `TEST#`, incluido el de esa nueva fila, ambos con `ESTADO_VALIDOC=COMPLETED` y `ADJUNTADOC1` poblado: la escritura tras una carga nueva pasó. La pantalla de éxito mostraba la ruta interna bajo «Referencia»; se retiró esa sección del frontend local para el próximo despliegue. El recorte de DynamoDB no muestra la columna `UID`, así que sigue pendiente verificar si se escribió en el ítem nuevo y corregir la trazabilidad si también está vacío.

La usuaria confirmó después que `UID` está vacío en **ambos** ítems. La Lambda buscaba `UID`/`idrow` solo en el objeto `record`/`data`; se añadió localmente una búsqueda adicional en el nivel superior y un evento de diagnóstico que registra únicamente la procedencia o ausencia del identificador. Las pruebas locales pasan, pero aún falta comprobar si Data Retrieval devuelve realmente el UID en alguno de esos niveles. No asignar el UID de una fila duplicada al ítem canónico existente: primero hay que identificar la fila que completó originalmente. Los dos ítems actuales necesitan una corrección de UID basada en evidencia de la LC de DANA.

Los eventos de CloudWatch de esa misma prueba resolvieron la duda: Data Retrieval devolvió `record` y `requestID`; la lista de claves de `record` tampoco incluyó `UID`. La petición de la Lambda ya solicitaba `UID`, pero DANA no lo entregó. Por tanto, buscarlo en otro nivel del JSON no corrige los ítems actuales. `requestID` identifica la petición y el parámetro `dana` identifica el enlace; ninguno equivale al UID de la fila. La Lambda local puede leer `UID_VALIDOC` si DANA expone el UID real en ese campo, pero no debe desplegarse esperando que el UID se llene hasta probar esa asignación en DANA. Los dos ítems existentes requieren cotejar manualmente la fila que completó primero antes de completar su UID; abrir una fila duplicada no demuestra cuál fue la original.

La captura posterior de la LC mostró que el Update con expresión `idRow` escribió `UID_VALIDOC=1` en la fila `UID=1` y `UID_VALIDOC=17` en la fila `UID=17`. Esto valida la copia del UID en esas filas. Falta solicitar `UID_VALIDOC` en Data Retrieval y observar su presencia en la respuesta; la modificación de la variable `DANA_DATA_FIELDS` desplegada debe probarse primero. Los ítems ya creados en DynamoDB no se actualizan automáticamente porque la escritura condicional preserva al primer completado.

La siguiente apertura de la fila `UID=17` confirmó en CloudWatch que Data Retrieval devuelve `UID_VALIDOC` dentro de `record`, mientras **no devuelve** `UID` ni `idrow`, pese a solicitarlos (`fieldsCount=17`). El evento `data_retrieval_uid` indicó `source=record`, `present=true` y `expediente_extracted` registró `recordUid=17`. La trazabilidad para nuevos ítems puede usar `UID_VALIDOC`; no se puede retirar ese campo basándose en esta respuesta. Esta fila 17 es un duplicado ya cerrado, por lo que su apertura no debe escribir `UID=17` en el ítem canónico creado por la fila 1. El UID de los ítems existentes continúa pendiente de corrección según la fila original.

Una apertura posterior de la fila `UID=7` registró `UID_VALIDOC` como única clave de UID recibida en `record`, `data_retrieval_uid` con `source=record`, `present=true` y `expediente_extracted.recordUid="7"`. Esto verifica la lectura también para esa fila. No verifica una actualización del ítem ya existente en DynamoDB, pues `PutItem` usa condición de creación y preserva los ítems anteriores.

La usuaria confirmó después que una nueva finalización ya guarda el `UID` en DynamoDB. Se retiró del frontend la frase «No se requieren más acciones.» de la pantalla de confirmación, a petición de la usuaria.
