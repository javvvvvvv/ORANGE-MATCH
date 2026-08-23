================================================================================
CONTROL DE VERSIONES — cómo nombrar, guardar y correr cada versión
================================================================================

Ahora mismo el proyecto NO tiene un repositorio git (no hay carpeta `.git`),
así que las versiones anteriores solo existen como los ZIPs que ya te he ido
mandando. Eso funciona, pero tiene un problema: no puedes ver QUÉ cambió
entre un ZIP y otro sin abrir los dos y compararlos a mano. Git resuelve
justo eso, y además te deja "regresar el tiempo" a cualquier versión sin
perder las demás.

--------------------------------------------------------------------------------
1. ¿QUÉ VERSIÓN ES ESTA?
--------------------------------------------------------------------------------

`backend/package.json` dice 2.0.0 y `frontend/package.json` dice 1.0.0 — están
descontroladas entre sí (normal, nadie las traía sincronizadas). Con los
cambios de hoy (logo, índice de empresas, fix de INICIAR.BAT), yo la llamaría:

    v2.1.0

Por qué 2.1.0 y no 3.0.0: en versionado semántico (el estándar más usado,
formato MAYOR.MENOR.PARCHE):
  - MAYOR sube cuando rompes compatibilidad (ej. cambias cómo se guardan los
    datos y las versiones viejas ya no abren los archivos nuevos).
  - MENOR sube cuando agregas algo nuevo sin romper lo que ya había (justo
    este caso: logo, índice legible, fix del BAT — nada de esto rompe nada
    de lo que ya tenías funcionando).
  - PARCHE sube cuando solo corriges un bug puntual, sin agregar nada.

Yo actualizaría los dos `package.json` a `"version": "2.1.0"` para que
coincidan (te dejo el paso en la sección 3).

--------------------------------------------------------------------------------
2. GIT: LO MÍNIMO PARA EMPEZAR (una sola vez)
--------------------------------------------------------------------------------

Necesitas tener Git instalado (https://git-scm.com/download/win). Luego, en
la carpeta raíz del proyecto (donde está INICIAR.BAT):

    git init
    git add .
    git commit -m "v2.0.0 - version antes del logo y fix de node_modules"

Con eso, TODO lo que hay ahora queda guardado como el punto de partida. A
partir de aquí, cada vez que termines un cambio importante, guardas un
"commit" — como una fotografía del proyecto completo en ese momento.

--------------------------------------------------------------------------------
3. GUARDAR ESTA VERSIÓN (v2.1.0)
--------------------------------------------------------------------------------

Con los cambios de este ZIP ya puestos en tu carpeta de trabajo:

    git add .
    git commit -m "v2.1.0 - logo oficial en toda la app, indice legible de empresas, fix node_modules roto en INICIAR.BAT"
    git tag v2.1.0

`git tag` es lo importante: le pone una etiqueta con nombre a este commit
exacto, así después puedes decir "quiero volver a v2.1.0" en vez de tener
que buscar cuál commit era por su mensaje.

--------------------------------------------------------------------------------
4. CÓMO CORRER UNA VERSIÓN ESPECÍFICA
--------------------------------------------------------------------------------

Ver qué versiones (tags) existen:

    git tag

Cambiar a una versión anterior (por ejemplo, si algo se rompió en la más
nueva y quieres probar cómo se veía v2.0.0):

    git checkout v2.0.0

Esto deja tu carpeta EXACTAMENTE como estaba en esa versión. Corres
INICIAR.BAT normal desde ahí. Para regresar a la versión más reciente:

    git checkout main

(o `master`, según cómo se haya llamado la rama principal al hacer `git
init` — git te lo dice si pones `git branch`).

IMPORTANTE: `node_modules/`, `.env`, `orangematch.db` y `backend/data/` están
en `.gitignore` a propósito — git nunca los toca ni los borra al cambiar de
versión. Cada vez que hagas `checkout` a una versión con dependencias
distintas, corre `npm install` de nuevo en esa carpeta si hace falta.

--------------------------------------------------------------------------------
5. DE AQUÍ EN ADELANTE: UN COMMIT POR CAMBIO TERMINADO
--------------------------------------------------------------------------------

No hace falta un tag (`git tag`) cada vez — solo cuando termines algo que
consideres "una versión entregable". Pero sí conviene un `commit` cada vez
que termines algo funcional, aunque sea chico:

    git add .
    git commit -m "descripcion corta de que cambio"

Mensajes cortos y concretos ("agrega export de nomina a excel", "corrige
calculo de IVA acreditable en resico") — eso es lo que después te va a
ahorrar tiempo cuando busques en qué commit se rompió algo.

--------------------------------------------------------------------------------
6. UN TIP EXTRA: GitHub (opcional, pero muy recomendable)
--------------------------------------------------------------------------------

Todo lo anterior guarda el historial solo en tu PC. Si esa PC falla, pierdes
el historial completo (no solo la versión actual). Un repositorio privado en
GitHub (gratis) es básicamente un respaldo en la nube de todo ese historial,
y además te deja ver los cambios línea por línea desde el navegador. Dado
que este es código de licencia comercial cerrada, el repo tendría que ser
**privado**, nunca público.
