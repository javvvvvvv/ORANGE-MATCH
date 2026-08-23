================================================================================
FIX — 2026-08-17 — Detección de columnas de la Balanza (amarre bloqueado)
================================================================================

SÍNTOMA REPORTADO
   No se podía hacer el amarre de balanza de una empresa (ej. Herrajes). El
   sistema se comportaba como si "no estuvieran definidas las columnas de la
   balanza" — cuando en el archivo sí estaban. Como consecuencia, ningún mes
   quedaba validado y el Papel de Trabajo de ISR mostraba "No hay meses
   validados" (ese síntoma de ISR es un efecto secundario de este mismo bug,
   no un problema aparte: ISR solo calcula sobre meses con amarre validado).

CAUSA RAÍZ
   frontend/src/lib/balanza.js → detectarColumnasBalanza()
   El detector automático de columnas fallaba en reconocer el encabezado de
   la columna "Cuenta" en dos casos frecuentes en archivos reales:

   1) Encabezados con puntuación, ej. "No. Cuenta", "Cve. Cuenta", "N° Cuenta".
      El código solo eliminaba ESPACIOS al comparar texto, no puntuación ni
      símbolos, así que "NO. CUENTA" nunca calzaba con ninguna de las
      variantes reconocidas ("CUENTA", "CTA", "NOCUENTA", etc.).

   2) La columna "Cuenta" ubicada más allá de la 4ª columna del archivo (por
      ejemplo si el archivo trae una columna de folio/numeración antes). El
      código que busca en qué fila está el encabezado solo revisaba las
      primeras 4 columnas de cada fila; si "Cuenta" estaba en la 5ª o más
      allá, nunca se encontraba la fila de encabezado.

   En cualquiera de los dos casos, detectarColumnasBalanza() devolvía null y
   el sistema caía en un mapeo de columnas fijo (0,1,2,3…) que no
   correspondía con el archivo real, produciendo cuentas/importes mal leídos
   y el bloqueo del amarre.

CORRECCIÓN
   - Se normaliza el texto del encabezado quitando TODA la puntuación (no
     solo espacios) antes de compararlo.
   - Se reconoce el encabezado de cuenta quitando prefijos/sufijos comunes
     ("No.", "Núm.", "Cve.", "Clave", "Código", "de", "Contable") y
     comparando lo que queda contra "CUENTA"/"CTA", en vez de una
     coincidencia genérica de texto — esto evita además que el nombre de una
     cuenta como "Cuenta por Cobrar Clientes" se confunda con el encabezado.
   - Se revisa la fila completa (no solo las primeras 4 columnas) al buscar
     dónde está el encabezado.

VALIDACIÓN
   Se probó la función corregida contra 7 escenarios de balanza (formato
   estándar, con título de reporte arriba, "No. Cuenta", "Cve. Cuenta",
   columna de cuenta desplazada, un archivo sin balanza real, y un caso
   diseñado específicamente para verificar que NO se generen falsos
   positivos con nombres de cuenta que contienen la palabra "cuenta").
   Todos los casos detectan las columnas correctamente. Se compiló el
   frontend completo (vite build) sin errores y se verificó la sintaxis de
   todos los archivos del backend (node --check) sin errores.

ARCHIVO MODIFICADO
   frontend/src/lib/balanza.js (función detectarColumnasBalanza)

RECOMENDACIÓN
   Si al probar con el archivo real de alguna empresa el amarre sigue sin
   detectar las columnas, comparte cómo se ve exactamente la fila de
   encabezados de esa balanza (los nombres de columna tal cual aparecen en
   el Excel) para ajustar el reconocimiento a ese formato puntual.
