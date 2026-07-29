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

El enlace del boton usa:

```text
{{PORTAL_VALIDOC_URL}}/completar-expediente
```

`{{PORTAL_VALIDOC_URL}}` es el link directo del portal configurado en la campana. El correo no incluye `TOMADOR_ID` ni token como query parameter. El external trigger de DANA entrega el identificador real de Data Retrieval al abrir el enlace.

## Criterio del flujo

El correo no adjunta ni recibe documentos. Solo lleva al portal.

El portal consulta Data Retrieval con el identificador entregado por DANA, obtiene `TOMADOR_ID`, valida la cedula con Bedrock y solo sube el archivo a DANA File Upload si la nacionalidad y el numero coinciden exactamente con `TOMADOR_ID`.

Si la validacion falla, el portal actualiza el ultimo motivo conocido en DANA sin subir archivo.
