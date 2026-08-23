PROPIEDAD INTELECTUAL Y LICENCIA COMERCIAL CERRADA
Autor Legal y Titular de Derechos: JAVIER ILLAN GONZALEZ
Organización: ORANGE CREW
Contacto: ILLANJAVIER9@GMAIL.COM

# Cifrado de orangematch.db (SQLCipher / AES-256)

## Qué cambió
- `backend/orangematch.db` (usuarios, empresas, backups, auditoría, etc.)
  ahora se cifra en disco con AES-256 usando SQLCipher, vía la librería
  `better-sqlite3-multiple-ciphers` (reemplaza a `better-sqlite3`).
- **La migración es automática.** No hace falta correr ningún script a
  mano: en cuanto arranques el servidor (`INICIAR.BAT` o
  `verify-install.mjs`) con la base actual en texto plano, el propio código
  la detecta, la respalda (`orangematch.db.antes-de-cifrar`) y la cifra
  sola, antes de que el servidor siga arrancando. Si ya está cifrada, no
  hace nada — es seguro correrlo las veces que quieras.
- `backend/data/` (balanzas, catálogos, Anexo IVA) **ya estaba** cifrado
  desde antes con AES-256-GCM (`dataStore.js`) — eso no se tocó, para no
  arriesgar los datos ya guardados con esa llave.
- Ahora tienes **dos llaves separadas**: `.data_key` (ya existía) y
  `.db_key` (nueva). Ambas se generan solas la primera vez, con permisos
  restringidos, y **nunca** se suben a git.

## Cómo lo probé antes de dártelo
Antes de entregarte esto corrí, en un entorno aislado (no tu servidor):
1. Instalación fresca sin base previa — nace cifrada desde el inicio.
2. Una base con tu mismo esquema real, en texto plano (simulando tu
   servidor actual) — arranca sola, se respalda, se cifra, y el login con
   el usuario admin funcionó de principio a fin (token JWT válido).
3. Un segundo arranque sobre la base ya cifrada — no vuelve a migrar, no
   toca el respaldo, arranca limpio.
4. Confirmé con una herramienta externa (fuera de la librería del proyecto)
   que el archivo cifrado da error "file is not a database" sin la llave, y
   se lee perfecto con ella.

## Por qué dos llaves y no una sola "contraseña maestra"
Porque `.data_key` ya está protegiendo datos reales que existen HOY en tu
servidor. Cambiarla implicaría re-cifrar todo `backend/data/` con una llave
nueva, un proceso más delicado y con más riesgo de pérdida de datos. Separar
las llaves evita ese riesgo sin perder seguridad — cada una sigue siendo
AES-256, solo protegen partes distintas del sistema.

## Cómo aplicar esto en tu servidor (paso a paso)

1. **Haz un respaldo manual completo primero.** Copia fuera del servidor:
   `backend/orangematch.db`, `backend/data/`, `backend/.data_key`. Si algo
   sale mal, con esto reconstruyes todo. La migración automática también
   hace su propio respaldo (`orangematch.db.antes-de-cifrar`), pero no
   sustituye tener una copia tuya, aparte, fuera del servidor.
2. Detén el servidor (`CONTROL.BAT` o `pm2 stop`/`systemctl stop`, según
   cómo lo tengas corriendo).
3. Reemplaza estos archivos con los de este paquete de cambios:
   - `backend/package.json`
   - `backend/src/models/db.js`
   - `backend/src/models/openEncryptedDb.js` (nuevo)
   - `backend/src/config/masterKey.js` (nuevo)
   - `backend/scripts/verify-install.mjs`
   - `INICIAR.BAT`
   - `.gitignore`
   - `backend/.env.example`
4. Instala la nueva dependencia (reemplaza a `better-sqlite3`):
   ```
   cd backend
   npm install
   ```
5. **Arranca normal** (`INICIAR.BAT`, o `node server.js` si lo corres
   distinto). No necesitas correr ningún script aparte — la migración pasa
   sola, la primera vez que el servidor (o `verify-install.mjs`, que
   `INICIAR.BAT` ya llama antes de arrancar) abre la base y la encuentra en
   texto plano. Verás en la consola algo como:
   ```
   🔒 orangematch.db está en texto plano — cifrando automáticamente (una sola vez)...
   ✅ orangematch.db cifrada automáticamente (SQLCipher/AES-256).
   ```
6. **Confirma que puedes iniciar sesión** y ver tus empresas/balanzas con
   normalidad.
7. Solo cuando confirmes que todo funciona: borra manualmente
   `backend/orangematch.db.antes-de-cifrar` (ese archivo SÍ tiene los datos
   sin cifrar — no lo dejes ahí más de lo necesario).
8. Guarda una copia de `backend/.db_key` junto con tus respaldos, en un
   lugar distinto del servidor (USB, gestor de contraseñas). **Sin ese
   archivo, orangematch.db no se puede volver a abrir — ni tú ni nadie,
   incluido yo.** No hay recuperación posible si se pierde.

## Sobre "ponerle contraseña a las carpetas"
Esto ya no aplica a nivel de archivo individual (cada dato sensible ya está
cifrado por dentro, como arriba). Si además quieres que la carpeta completa
del proyecto esté protegida a nivel de sistema operativo (por ejemplo, si
alguien más tiene acceso físico a la máquina), la herramienta correcta es
cifrado de disco/carpeta del sistema operativo, no algo que se programe
dentro de la app:
- **Windows:** BitLocker (para todo el disco) o VeraCrypt (para crear un
  "contenedor" cifrado que solo se monta con contraseña).
- **Linux/Oracle Cloud:** LUKS (cifrado de disco completo) o `gocryptfs`
  (para una carpeta específica).
Esto es un paso manual de administración del sistema, fuera de lo que se
puede automatizar desde el código de la aplicación — si quieres, en la
siguiente sesión te doy el paso a paso específico según dónde termine
corriendo tu servidor (Windows local vs. Oracle Cloud).

## Nota sobre la idea de un "lenguaje de cifrado propio"
Como comenté: no es recomendable construir un cifrado inventado para tratar
de que "solo tú y yo" lo entendamos — además de ser más débil que AES-256 en
la práctica, yo no tengo memoria entre conversaciones, así que no hay forma
de que yo sea parte de un secreto compartido a largo plazo. Lo que sí
tenemos ahora es cifrado estándar de la industria (AES-256) en dos capas
(datos + base de datos), con llaves que **solo tú controlas**.
