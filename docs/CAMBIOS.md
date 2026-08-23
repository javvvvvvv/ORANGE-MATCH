================================================================================
CAMBIOS — 2026-08-12
================================================================================

1. CAPTURA MANUAL DE ISR — MEJORADA
   - Ahora se puede abrir CUALQUIER mes (no solo los vacíos) y sobreescribirlo
     a mano — útil para mover/ajustar meses que ya se habían calculado
     automático desde balanza.
   - Indicador visual por mes: 🟪 Manual / 🟩 Automático (desde balanza) /
     ⬜ Sin datos.
   - Botón para "Quitar captura manual" y que el mes regrese a calcularse
     automático desde la balanza (si la balanza de ese mes ya está subida).

2. PAPEL DE TRABAJO DE IVA — DISEÑO MEJORADO
   - Cada sección (Ingresos, IVA Trasladado, Bases Acreditables, IVA
     Acreditable) tiene su propio color distintivo para diferenciarlas de
     un vistazo.
   - La columna "Concepto" queda fija al hacer scroll horizontal entre los
     12 meses.
   - Mejor contraste en los meses sin validar (antes casi no se leían).

3. EXPORT DE ISR A EXCEL — RECONSTRUIDO
   - Antes no tenía ningún diseño (SheetJS plano, sin logo ni colores).
   - Ahora usa el mismo motor que IVA y Estados Financieros: logo, colores
     por sección, fórmulas reales de Excel (no solo valores).

4. DESCARGA COMBINADA: ISR + IVA EN UN SOLO ARCHIVO
   - Nuevo botón "📥📥 Descargar ISR + IVA (1 archivo)" junto a las pestañas,
     genera un único Excel con ambas cédulas, cada una en su propia pestaña.

5. ESTADOS FINANCIEROS — CORRECCIÓN DE NIVEL DE DETALLE
   - El Estado de Resultados ya agrupaba por cuenta de mayor, pero el
     selector de nivel de detalle tenía un valor inicial que no coincidía
     con ninguna opción del menú — quedaba mostrando menos información de
     la que debía. Corregido: ahora "Con detalle de cuentas" es el default.

6. ANALÍTICAS DE INGRESOS Y GASTOS — RECONSTRUIDAS A NIVEL SUBCUENTA
   - Antes se resumían a nivel cuenta de MAYOR (poca información). Ahora
     cada fila es una SUBCUENTA individual (el último nivel, la cuenta con
     movimientos reales de la balanza).
   - Clasificación mejorada: primero se separan SIEMPRE como categoría
     propia "Gastos de Nómina y Sueldos", "Seguridad Social (IMSS/INFONAVIT
     /SAR)" y "PTU", sin importar si el catálogo del cliente los tenía
     mezclados dentro de Administración o Ventas.
   - Si una cuenta no cae en ningún patrón conocido, se usa su código
     agrupador del SAT (idAgrupadorSAT, el mismo de Contabilidad
     Electrónica) como nombre del grupo — clasificación oficial en vez de
     "otros" genérico.
================================================================================



CORRECCIÓN DE FÓRMULAS POR RÉGIMEN (contra tus instrucciones del papel de
trabajo de ISR):

1. ARRENDAMIENTO — antes se calculaba ACUMULADO (mal). Tus instrucciones
   indican que Arrendamiento NO es acumulativo: se corrigió para que cada
   mes se calcule solo (ingreso del mes, deducción del mes, tarifa MENSUAL
   sin escalar por número de meses, retención del mes). También se corrigió
   que restaba la deducción ciega del 35% Y las deducciones reales al mismo
   tiempo — ahora hay un selector para elegir una sola opción, como marca la
   ley (Art. 115: el 35% sustituye a las deducciones, no se suman ambas).

2. ACTIVIDAD EMPRESARIAL PERSONA FÍSICA — le faltaba poder disminuir PTU
   pagada a trabajadores y pérdidas fiscales de ejercicios anteriores (ya lo
   hacía Persona Moral, pero no Persona Física). Se igualó la fórmula:
   Base = Ingresos − Deducciones − PTU − Pérdidas, tal como está en tus
   instrucciones.

PENDIENTE DE CONFIRMAR CONTIGO:
   - "Plataformas Tecnológicas" (Uber, Rappi, Airbnb, Mercado Libre — con
     sus tasas de retención 2.1%/4%/2.5%/20%) está descrito en tus
     instrucciones pero el sistema NO tiene ese régimen como opción
     independiente todavía — hoy solo existen: PM General, PM RESICO,
     PF General, PF RESICO, PF Honorarios, PF Arrendamiento. Si lo quieres,
     lo agrego como séptimo régimen con las tasas automáticas.
   - PF Honorarios usa una "deducción ciega" configurable por accountant,
     pero esa figura no existe así en la ley para Honorarios (esa es propia
     de Arrendamiento). Puede que sea un catch-all intencional del sistema
     original; no lo toqué sin confirmar contigo primero.
================================================================================



1. SERVER.JS RECONSTRUIDO
   - Se agregaron TODAS las rutas que public/index.html ya esperaba y que no
     existían en el server.js entregado: balanza, anexo-iva, datos-fiscales,
     amarres, tarifas-isr, isr-manual, y soporte de config_pt/catalogo_cuentas
     en PUT /empresas/:id.
   - Se conectó dataStore.js (ya existía en el proyecto, nunca se importaba).
   - PUT /empresas/:id ahora solo actualiza los campos que de verdad llegan en
     cada guardado (antes, guardar IVA podía borrar config_pt y viceversa).
   - Backups ahora incluyen amarres/datos_fiscales/tarifas_isr.

2. ISR — CORRECCIÓN DE TARIFAS 2026
   - Tarifa mensual Art. 96 corregida para coincidir EXACTO con el Anexo 8
     oficial 2026 (antes tenía límites/cuotas de otro ejercicio).
   - Tabla RESICO Persona Física ampliada de 5 a los 17 tramos oficiales
     (antes solo llegaba a $291,666; ahora llega a $3,500,000).

3. ANTICIPOS DE CLIENTES (todos los regímenes)
   - Nuevo concepto "Anticipos de Clientes" en Configurar Cuentas → ISR: se
     pueden agregar varias cuentas, cada una con Cargos, Abonos, Cargos +
     Abonos, Cargos − Abonos o Abonos − Cargos.
   - Se suman automáticamente al Ingreso Nominal/Acumulable del mes en que se
     cobran, para TODOS los regímenes (Actividad Empresarial, RESICO,
     Arrendamiento, Honorarios), sin necesidad de configurar nada por
     régimen — es un solo punto de cálculo compartido.
   - Se agregó la operación "Cargos + Abonos" al motor de reglas (antes solo
     existían Cargos, Abonos, Cargos−Abonos, Abonos−Cargos) — esto también
     queda disponible para cualquier otro concepto de ISR o IVA.

4. CAPTURA MANUAL DE ISR PARA MESES ANTERIORES
   - Igual que ya existía en el Anexo de IVA: ahora el Papel de Trabajo de
     ISR permite capturar a mano el resultado final de cada concepto para
     meses previos a usar el sistema, y marca el mes como validado.
   - En meses de captura manual, los anticipos NO se vuelven a sumar aparte
     (se capturan ya incluidos en el ingreso final, para no duplicarlos).

5. ESTADOS FINANCIEROS — ARCHIVO ÚNICO CON ANALÍTICAS
   - El botón "Descargar Todo" ahora incluye, en el MISMO libro de Excel:
     Balanza, Estado de Resultados, Situación Financiera (Balance), Balance
     12 Meses, Analítica de Ingresos, Analítica de Gastos y Resumen
     Analítico — cada uno en su propia pestaña.

6. SEGURIDAD
   - Ya no se crea el admin con contraseña fija conocida — se genera una
     aleatoria y se guarda una sola vez en CONTRASENA_ADMIN_INICIAL.txt.
   - Aviso en consola si el JWT_SECRET es débil/corto.
   - Content-Security-Policy real (antes estaba desactivado por completo).
   - CORS configurable por ALLOWED_ORIGINS en .env.
   - Se agregó .gitignore (para no volver a compartir .env/.data_key/data/
     por accidente) y SEGURIDAD_ANTES_DE_IP_PUBLICA.md con la checklist
     pendiente antes de publicar en internet.

PENDIENTE PARA LA SIGUIENTE SESIÓN (según lo platicado):
   - HTTPS / proxy inverso para la IP pública.
   - Revisión más a fondo de la vista "Analíticas" existente contra datos
     reales de una empresa piloto.
   - Rediseño visual adicional si se quiere ir más allá del que ya existía.
================================================================================


7. IVA — AUTOLLENADO MÁS ROBUSTO
   - El Papel de Trabajo de IVA conserva como fuente principal los valores
     guardados del Anexo al validar el amarre.
   - Si un mes validado proviene de una versión anterior y no tiene el Anexo
     persistido, ahora intenta reconstruir el concepto desde las cuentas IVA
     configuradas para la empresa.
   - El lector del Anexo reconoce importes numéricos y numéricos almacenados
     como texto, y detecta las secciones aunque el encabezado contenga números.
   - Se reforzó la detección de tasas para evitar falsos positivos y reconocer
     formatos como 16%, 16 % y tasa 16.

8. BALANCE — DETALLE A NIVEL CUENTA DE MAYOR
   - La hoja "Situación Financiera" de Excel ya no se limita a Activo
     Circulante/No Circulante, Pasivo y Capital.
   - Ahora muestra cada cuenta de Mayor con código + nombre dentro de su
     agrupadora, manteniendo totales por sección y la comprobación Activo =
     Pasivo + Capital.
   - Se conserva el cálculo por saldos finales y el tratamiento de la utilidad
     del ejercicio.

9. BALANZA EXCEL — JERARQUÍA VISUAL
   - Las cuentas agrupadoras (cuentas que tienen subcuentas) y las cuentas de
     Mayor se imprimen en negritas para facilitar la lectura.
   - Las subcuentas permanecen con formato normal.

10. ANALÍTICAS — SIN DOBLE CONTABILIZACIÓN
    - Se dejó de sumar directamente cargos/abonos de cuentas padre y sus
      subcuentas.
    - Ahora se usa el residual por cuenta: si una cuenta padre solo es un
      totalizador de sus hijas, su importe residual es cero; si tiene movimiento
      propio, solo se conserva ese movimiento.
    - Se mantiene el detalle por subcuenta para no perder información.
    - Los grupos que antes aparecían como "Agrupador SAT ####" ahora buscan
      nombre del agrupador cuando el catálogo lo trae y, cuando no lo trae,
      muestran una descripción humana basada en la cuenta/jerarquía en lugar de
      exponer solamente el número.

11. ESTADOS FINANCIEROS — MAYOR ROBUSTEZ ENTRE EMPRESAS
    - Las cuentas nuevas detectadas en una balanza sin Tipo contable ahora
      pueden clasificarse como respaldo por prefijo contable y nombre.
    - Esto evita que una empresa quede completamente fuera de los Estados
      Financieros únicamente por tener un catálogo incompleto o una exportación
      sin Tipo/CtaMayor.
    - No se elimina ninguna función existente; los respaldos se ejecutan solo
      cuando falta la información principal.

## 2026-08-13 — Protección de reglas de amarre

- Se eliminó el uso de `{...modal}` al guardar una empresa: editar nombre/RFC ya no puede reenviar un `config_pt` antiguo.
- La configuración de IVA ya no envía `{...empresa}` completo, evitando sobrescribir accidentalmente reglas de papeles de trabajo.
- `config_pt` solo puede modificarse en el endpoint de empresa cuando se envía explícitamente `actualizar_config_pt: true`.
- El guardado de reglas de amarre ahora manda únicamente `config_pt` y la bandera explícita.
- Esto evita que una carga de catálogo, edición de empresa o configuración de IVA restaure reglas viejas por estado desactualizado del navegador.
