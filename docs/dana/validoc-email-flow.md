# Email Validoc

Plantilla HTML:

```text
docs/dana/validoc-email-template.html
```

## Campos usados

La pieza usa campos de la lista `POC_VALIDOC`:

```text
NOMBRETOMADOR
TOMADOR_ID
PRODUCTO
```

El botón debe usar el enlace completo generado por el External Trigger de DANA. En esta plantilla, `ENLACE_EXTERNAL_TRIGGER_VALIDOC` es un marcador para sustituir en la configuración del flujo; no es un campo DANA confirmado:

```text
{{ENLACE_EXTERNAL_TRIGGER_VALIDOC}}
```

Los enlaces observados abren `https://ms.validoc.danaconnect.us/?dana=...`. Ese parámetro identifica la fila para Data Retrieval y no debe construirse manualmente. `TOMADOR_ID` no viaja en el enlace; la Lambda lo obtiene al consultar DANA. El enlace debe tratarse como una credencial de acceso al expediente.

## Criterio del flujo

El correo no adjunta ni recibe documentos. Solo lleva al portal.

El portal consulta Data Retrieval con el identificador entregado por DANA, obtiene `TOMADOR_ID`, valida la cedula con Bedrock y solo sube el archivo a DANA File Upload si la nacionalidad y el numero coinciden exactamente con `TOMADOR_ID`.

Si la validacion falla, el portal actualiza el ultimo motivo conocido en DANA sin subir archivo.
