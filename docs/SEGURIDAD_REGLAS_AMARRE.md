# Protección de reglas de amarre — Orange Match

## Qué cambia

A partir de esta versión, las reglas críticas de Papeles de Trabajo (`config_pt`) quedan protegidas frente a importaciones y guardados parciales.

### Respaldo automático antes de importar
Se crea un respaldo automático antes de:

- importar catálogo de cuentas;
- guardar/importar una balanza mensual;
- guardar/importar un Anexo IVA mensual;
- cambiar la configuración global de celdas del Anexo IVA;
- modificar explícitamente las reglas de Papeles de Trabajo.

El respaldo conserva `config_pt`, configuración IVA, amarres validados y datos fiscales de la empresa.

## Regla de protección
Un PUT genérico de empresa ya no puede modificar `config_pt` por accidente.

Para modificar las reglas se debe enviar explícitamente:

`actualizar_config_pt: true`

Si ya existen reglas y llega una configuración vacía/null, el servidor rechaza la operación salvo que se indique expresamente `confirmar_borrado_config_pt: true`.

## Recuperación
Los respaldos automáticos aparecen en **💾 Respaldos** como `🔒 Automático`.

Un administrador puede restaurar **solo la empresa protegida**, sin reemplazar las demás empresas del sistema.

Los respaldos manuales siguen permitiendo restauración completa del sistema.

## Importante
Las balanzas, Anexos IVA y catálogos continúan almacenándose en la estructura cifrada de `data/`. El respaldo automático protege especialmente la configuración y reglas que estaban siendo sobrescritas accidentalmente.
