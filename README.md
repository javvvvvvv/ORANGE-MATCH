# Orange Match — Amarre de Balanzas IVA

Sistema interno para el amarre de balanzas contra el Anexo de IVA, papeles de
trabajo de ISR y control de empresas/usuarios.

## Estructura

```
orange-match/
├── backend/          API (Express + SQLite, por capas)
│   ├── server.js     Punto de entrada: solo bootstrap y montaje de routers
│   ├── dataStore.js  Almacenamiento cifrado de balanzas/catálogos/Anexo IVA
│   └── src/
│       ├── config/   Variables de entorno (.env)
│       ├── models/   Acceso a datos (una consulta SQL vive en un solo lugar)
│       ├── core/     Lógica de negocio (auth, auditoría, respaldos, licencia)
│       └── api/routes/  Rutas HTTP (una por dominio: empresas, usuarios, etc.)
│
├── frontend/         Interfaz (React + Vite)
│   └── src/
│       ├── pages/       Una pantalla por archivo (PageEmpresas, PageEjecutar, …)
│       ├── components/  Piezas reutilizables (Login, Nav, ConfigCuentasEmpresa, …)
│       └── lib/          Helpers agrupados por tema (excel, isr, balanza, anexoIva…)
│
├── docs/             Historial de cambios y notas de seguridad del proyecto
├── INICIAR.BAT       Instala dependencias (primera vez), compila el frontend
│                     y levanta el backend
└── CONTROL.BAT       Panel para ver estado/logs, reiniciar o detener (vía PM2)
```

Antes, todo el frontend vivía en un solo `index.html` de 8,400+ líneas y todo
el backend en un `server.js` de 850+ líneas. Se separó en capas para que cada
archivo tenga una responsabilidad y sea más fácil de mantener sin tocar medio
proyecto por cada cambio.

## Cómo arrancarlo

**Windows (uso normal):** doble clic en `INICIAR.BAT`. La primera vez instala
dependencias y compila el frontend; después solo levanta el servidor.

**Manual / desarrollo:**
```bash
cd backend && npm install && npm start        # API en :3000
cd frontend && npm install && npm run dev     # UI con recarga en caliente, apunta a :3000
```

Para producción, el backend sirve el build de `frontend/dist` automáticamente
(`npm run build` en `frontend/`, luego `npm start` en `backend/`).

## Variables de entorno (`backend/.env`)

- `PORT` — puerto del servidor (default 3000)
- `JWT_SECRET` — si no existe, se genera uno solo y se guarda; revisa la
  consola al arrancar, avisa si es débil
- `ALLOWED_ORIGINS` — orígenes permitidos por CORS, separados por coma
  (vacío = acepta cualquiera; defínelo antes de exponer el sistema a Internet)
- `HAMACHI_IP` — opcional, para que `INICIAR.BAT`/consola muestren también esa URL

## Si el puerto 3000 no responde (ERR_CONNECTION_REFUSED)

Ese error de Chrome significa que **nada está escuchando** en el puerto —
o sea, el proceso de Node truena antes de llegar a levantar el servidor.
No es que falte la base de datos: `orangematch.db` se crea sola, vacía, la
primera vez que el servidor arranca bien (por diseño no viaja en el ZIP).

1. Abre `CONTROL.BAT` → opción **2 (Ver logs)** y lee el error real que
   imprime PM2. Casi siempre dice justo debajo de dónde truena.
2. La causa más común: `backend/node_modules` quedó compilado para otra
   versión de Node (por ejemplo si esa carpeta se copió de otra PC).
   `better-sqlite3` es un módulo nativo — no es portable entre versiones de
   Node/SO. Arreglo manual:
   ```bash
   cd backend
   rmdir /s /q node_modules
   npm install
   ```
   (`INICIAR.BAT` ya detecta esto solo y reinstala automáticamente desde
   esta versión — ver docs/CAMBIOS_2026-08-17.md).
3. Si sigue sin arrancar, corre `node server.js` directo dentro de
   `backend/` (sin PM2 ni el BAT) para ver el error completo en la consola.

## Recuperación incluida en esta entrega — 17/08/2026

Esta copia fue preparada a partir de la versión anterior `v.01.2` y la versión
nueva `v2.2.2`. Se conservó la base SQLite actual y se reincorporaron los datos
periódicos cifrados de la versión anterior:

- `backend/orangematch.db`
- `backend/.data_key`
- `backend/data/empresa_*/...`
- Catálogos de cuentas
- Balanzas mensuales
- Datos del Anexo IVA
- Índice legible `backend/data/_empresas.txt`

La llave `.data_key` es indispensable. **No la borres ni la cambies** mientras
existan datos cifrados de esta instalación.

### Verificación

Después de instalar dependencias se puede ejecutar:

```bash
VERIFICAR.BAT
```

o:

```bash
cd backend
node scripts/verify-install.mjs
```

La verificación comprueba la integridad de SQLite, las tablas críticas, la
llave AES-256 y que cada archivo `.enc` pueda descifrarse correctamente.

### Importante sobre respaldos

Los respaldos SQLite conservan la configuración pequeña y crítica. Los
catálogos, balanzas y Anexos IVA viven separadamente en `backend/data/` y se
respaldan copiando **también** esa carpeta junto con `backend/.data_key`.

## Control de versiones

Ver `docs/VERSIONADO.md` para cómo nombrar, guardar y correr cada versión.

## Seguridad

Ver `docs/SEGURIDAD_ANTES_DE_IP_PUBLICA.md` y `docs/SEGURIDAD_REGLAS_AMARRE.md`
antes de exponer el sistema fuera de la red local/Hamachi.


## Nuevas funciones — 17/08/2026

- **Recuperación local de contraseña de administrador:** `RECUPERAR_CONTRASENA_ADMIN.BAT`.
  Requiere permisos de administrador de Windows, detiene temporalmente Orange Match,
  genera una contraseña aleatoria nueva y reinicia el servidor. No crea una ruta web
  para saltarse el login.
- **Video de bienvenida:** antes de mostrar el login se reproduce automáticamente
  `frontend/public/videos/orange-match-bienvenida.mp4`. Se puede activar/desactivar
  el sonido y continuar manualmente.
- **Logotipos:** se eliminó la placa blanca alrededor de los logos; se usan los SVG
  oficiales sobre el fondo uniforme de la aplicación, con contraste mediante sombra
  sutil. En lugares de marca completa se usa el logo completo y en lugares compactos
  se usa el ícono.
- **Ajuste Anual por Inflación:** nueva pantalla `📈 Ajuste Inflación`, con configuración
  de cuentas de créditos/deudas, saldos mensuales desde balanza, captura manual para
  meses faltantes, INPC, factor, promedio anual, resultado acumulable/deducible y
  exportación a Excel. La configuración queda guardada por empresa y ejercicio.
