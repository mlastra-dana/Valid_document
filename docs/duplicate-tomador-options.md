# Opciones para Control de Duplicidad por TOMADOR_ID

## Contexto

La regla funcional definida para Validoc es global por cliente:

```text
Si un TOMADOR_ID ya tiene documento completado, no debe permitirse una nueva validación para ese mismo TOMADOR_ID, aunque DANA cree otro UID o envíe otro enlace.
```

El portal obtiene el `TOMADOR_ID` usando Data Retrieval a partir del `dataId` del enlace. El límite técnico actual es que Data Retrieval devuelve solo el registro asociado a ese `dataId`; no permite buscar todos los registros de `POC_VALIDOC` por `TOMADOR_ID`.

Por eso, si DANA crea un registro nuevo limpio con el mismo `TOMADOR_ID`, la Lambda no puede saber por Data Retrieval que otro registro anterior ya fue completado, a menos que DANA envíe una señal adicional o que el backend tenga un índice propio.

## Opción 1: Control previo en DANA

DANA valida antes de enviar el correo si ese `TOMADOR_ID` ya tiene un registro completado.

Comportamiento esperado:

1. Si el `TOMADOR_ID` no está completado, DANA envía el enlace normal.
2. Si el `TOMADOR_ID` ya está completado, DANA no envía un nuevo ciclo de validación.
3. Si por operación se crea igualmente un nuevo registro/enlace, DANA debe llenar `TOMADOR_ID_COMPLETADO=1` para que el portal muestre la pantalla de completado.

Ventajas:

- Mantiene la decisión dentro de DANA, que es donde vive la lista operativa.
- No requiere infraestructura adicional.
- Es simple para el POC si DANA puede segmentar o calcular el campo.

Limitaciones:

- Depende de que DANA ejecute siempre ese control antes del correo.
- Si se crea un registro limpio sin `TOMADOR_ID_COMPLETADO`, el portal lo verá como pendiente.
- Data Retrieval no resuelve por sí solo la búsqueda global por `TOMADOR_ID`.

## Opción 2: Índice técnico en DynamoDB

Crear una tabla DynamoDB que guarde solo el estado global del tomador.

Tabla sugerida:

```text
ValidocTomadores
```

Clave principal:

```text
TOMADOR_ID
```

Campos mínimos:

```text
TOMADOR_ID
STATUS
COMPLETED_AT
SOURCE_DATA_ID
```

Para mantenerlo simple, `STATUS` solo necesita registrar si el tomador está completado:

```text
COMPLETED
```

Comportamiento esperado:

1. El usuario abre el enlace.
2. La Lambda consulta Data Retrieval y obtiene `TOMADOR_ID`.
3. La Lambda consulta DynamoDB por ese `TOMADOR_ID`.
4. Si existe con `STATUS=COMPLETED`, el portal devuelve pantalla de completado y no permite carga.
5. Si no existe, el portal permite el flujo normal.
6. Cuando un documento valida correctamente y se actualiza DANA, la Lambda escribe `TOMADOR_ID` como `COMPLETED` en DynamoDB.

Ventajas:

- El backend queda protegido aunque DANA cree un nuevo registro limpio.
- La regla global por `TOMADOR_ID` queda centralizada y rápida de consultar.
- No depende de que Data Retrieval exponga búsquedas globales.
- Puede extenderse a otros canales si el mismo `TOMADOR_ID` se usa en varios procesos.

Limitaciones:

- Requiere una tabla DynamoDB e IAM adicional.
- Solo cubre completados procesados desde que la tabla exista.
- Si hay completados históricos en DANA, se requiere una carga inicial o aceptar que el índice se alimente desde nuevas validaciones.

## Opción 3: API adicional de búsqueda en DANA

Si DANA expone o habilita un endpoint para buscar registros por `TOMADOR_ID`, la Lambda podría consultar:

```text
¿Existe algún registro con TOMADOR_ID = X y ESTADO_VALIDOC = COMPLETED?
```

Ventajas:

- DANA sigue siendo la única fuente de verdad.
- No requiere mantener un índice propio.

Limitaciones:

- Hoy no está disponible dentro del flujo actual.
- Agrega una llamada adicional por apertura de expediente.
- Depende de disponibilidad y performance del API de búsqueda.

## Recomendación

Para el POC inmediato, mantener la opción 1:

```text
DANA controla antes del correo y/o envía TOMADOR_ID_COMPLETADO=1.
```

Para producción o un demo más robusto, agregar la opción 2:

```text
DynamoDB como índice técnico de TOMADOR_ID completados.
```

La recomendación combinada es:

1. DANA sigue decidiendo si envía recordatorios o nuevos enlaces.
2. DynamoDB funciona como respaldo técnico para que el portal no permita una nueva validación si el `TOMADOR_ID` ya fue completado.
3. DANA continúa siendo el expediente operativo; DynamoDB solo guarda el resultado global de completado por `TOMADOR_ID`.
