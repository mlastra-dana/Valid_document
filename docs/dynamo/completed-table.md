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

En la prueba siguiente, el portal mostró «Documento recibido exitosamente» para una fila nueva y la lista DANA mostró `ESTADO_VALIDOC=COMPLETED` con ruta de archivo. Falta verificar el ítem correspondiente en DynamoDB para cerrar la prueba de escritura tras una carga nueva. La pantalla de éxito mostraba la ruta interna bajo «Referencia»; se retiró esa sección del frontend local para el próximo despliegue.
