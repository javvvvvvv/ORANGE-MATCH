# Orange Match — Memoria Técnica

## Identificación

- Producto: Orange Match
- Versión base: 2.2.2
- Arquitectura: aplicación web local de cliente y servidor
- Backend: Node.js, Express, SQLite
- Frontend: React 18, Vite
- Persistencia: SQLite para datos transaccionales y almacenamiento cifrado en disco para balanzas, catálogos y Anexo IVA.

## Propósito funcional

Orange Match permite administrar empresas, usuarios, configuraciones fiscales, catálogos contables, balanzas mensuales, amarres, Papeles de Trabajo de IVA e ISR, Estados Financieros, Ajuste Anual por Inflación, respaldos y auditoría.

## Arquitectura lógica

```text
Navegador
   |
   v
Frontend React / UI
   |
   | HTTP + JSON + JWT
   v
API Express / routes
   |
   v
Servicios de negocio / core
   |
   +--------------------+
   |                    |
   v                    v
Modelos / SQLite     DataStore cifrado
   |                    |
   v                    v
orangematch.db       backend/data
```

## Capas

### UI

`frontend/src/components` y `frontend/src/pages` contienen únicamente presentación, interacción y coordinación de estado.

### API

`backend/src/api/routes` contiene rutas HTTP, autorización y validación de entrada.

### Core

`backend/src/core` contiene autenticación, licenciamiento, auditoría y respaldos.

### Models

`backend/src/models` contiene acceso a SQLite y almacenamiento de datos persistentes.

## Persistencia y recuperación

Los datos históricos recuperados de la versión anterior se conservan mediante `orangematch.db`, `.data_key` y `data/`. El sistema crea las tablas complementarias requeridas por la versión 2.2.2 mediante migraciones idempotentes.

## Seguridad

- JWT para sesiones.
- Contraseñas almacenadas mediante bcrypt.
- Helmet y rate limiting en Express.
- Validación de entradas de Papeles de Trabajo antes de acceder a los modelos.
- Secretos configurables mediante `.env`.
- `.env.example` incluido para configuración reproducible sin credenciales reales.

## Flujo de Papeles de Trabajo

```text
Empresa seleccionada
       |
       v
Carga de configuración, catálogo y datos mensuales
       |
       +--> Configuración
       +--> Catálogo
       +--> Datos fiscales
       +--> Balanzas / amarres
       +--> IVA
       +--> ISR
       +--> Estados financieros
```

Los módulos IVA e ISR se montan únicamente cuando el usuario selecciona su pestaña. Esto evita que un fallo de un módulo no visible bloquee toda la pantalla de Papeles de Trabajo.

## Recuperación ante errores de UI

`PapelesTrabajoErrorBoundary` evita que una excepción de renderizado deje la aplicación en una pantalla vacía y presenta el módulo afectado y el mensaje técnico para diagnóstico.

## Trazabilidad

Los cambios de importación y operaciones críticas se registran mediante el sistema de auditoría. Los respaldos automáticos protegen configuraciones antes de operaciones destructivas o de importación.

## Verificación

- Integridad SQLite: verificada durante la recuperación.
- Archivos cifrados históricos: verificados durante la recuperación.
- Compilación frontend: debe ejecutarse mediante `npm run build` desde `frontend`.
- Servidor: debe iniciar únicamente después de pasar `VERIFICAR.BAT`.
