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
