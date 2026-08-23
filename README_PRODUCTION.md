# 🍊 Orange Match — Sistema de Amarre de Balanzas IVA

[![CI/CD Pipeline](https://github.com/tu-usuario/orange-match/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/tu-usuario/orange-match/actions/workflows/ci-cd.yml)
[![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)](https://hub.docker.com/)
[![Versión](https://img.shields.io/badge/versión-2.3.0-green)](./docs/VERSIONADO.md)

Sistema profesional para el amarre de balanzas contra el Anexo de IVA, papeles de trabajo de ISR y control de empresas/usuarios.

## 🚀 Características Principales

### ✅ Seguridad de Nivel Empresarial
- **Cifrado AES-256-GCM** para datos sensibles (balanzas, anexos, catálogos)
- **SQLCipher** para la base de datos principal
- **HTTPS forzado** en producción con HSTS
- **2FA (Autenticación de Dos Factores)** para administradores
- **Rate limiting** contra ataques de fuerza bruta
- **Auditoría completa** de todas las acciones

### 🤖 Automatización Incluida
- **Tests unitarios** con Jest (cobertura reportada)
- **Tests de integración** para APIs
- **CI/CD pipeline** con GitHub Actions
- **Build automático** del frontend
- **Deploy automatizado** a producción
- **Backups automáticos** antes de operaciones críticas

### 🐳 Contenerización
- **Dockerfile** multi-stage optimizado
- **Docker Compose** para orquestación
- **Health checks** integrados
- **Volúmenes persistentes** para datos
- **Redes aisladas** para seguridad

## 📋 Requisitos Previos

### Para Desarrollo
- Node.js 20+ LTS
- npm o yarn
- Git

### Para Producción (Opciones)
**Opción A - Docker (Recomendada):**
- Docker 20+
- Docker Compose 2+

**Opción B - Tradicional:**
- Node.js 20+ LTS
- PM2 (para gestión de procesos)
- Servidor web (Nginx/Apache) para HTTPS

## 🛠️ Instalación Rápida

### Desarrollo Local

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/orange-match.git
cd orange-match

# Instalar dependencias backend
cd backend
npm install

# Instalar dependencias frontend
cd ../frontend
npm install

# Iniciar en modo desarrollo
cd ..
# Windows: doble clic en INICIAR.BAT
# Linux/Mac:
cd backend && npm run dev
```

### Producción con Docker (Recomendado)

```bash
# 1. Generar secretos seguros
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
export DB_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo $DB_ENCRYPTION_KEY > .db_key && chmod 600 .db_key

# 2. Crear archivo .env
cat > .env << EOF
JWT_SECRET=$JWT_SECRET
DB_ENCRYPTION_KEY=$DB_ENCRYPTION_KEY
ALLOWED_ORIGINS=https://tudominio.com
NODE_ENV=production
EOF

# 3. Desplegar
cd docker
docker compose up -d --build

# 4. Verificar
docker compose logs -f
```

### Producción Tradicional (Sin Docker)

```bash
# 1. Instalar dependencias
cd backend
npm install --production
cd ../frontend
npm install
npm run build

# 2. Configurar variables de entorno
cd ../backend
cp .env.example .env
# Editar .env con tus valores reales

# 3. Iniciar con PM2
pm2 start server.js --name orange-match
pm2 save
pm2 startup
```

## 🔐 Configuración de Seguridad

### Variables de Entorno Críticas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `JWT_SECRET` | Secreto para tokens JWT (mínimo 64 caracteres hex) | `a1b2c3...` |
| `DB_ENCRYPTION_KEY` | Llave de cifrado SQLite (64 caracteres hex) | `f4e5d6...` |
| `ALLOWED_ORIGINS` | Dominios permitidos (CORS) | `https://midominio.com` |
| `NODE_ENV` | Entorno (`development` o `production`) | `production` |
| `PORT` | Puerto del servidor | `3000` |

### Activar 2FA para Administradores

1. Iniciar sesión como admin
2. Ir a **Mi Cuenta → Seguridad → 2FA**
3. Escanear código QR con Google Authenticator/Authy
4. Ingresar código de 6 dígitos para verificar
5. ¡Listo! Ahora requerirá 2FA en cada login

### Rotación de Secretos (Recomendado cada 90 días)

```bash
# Generar nuevo JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Actualizar en .env y reiniciar servicio
# Las sesiones activas se invalidarán (seguridad esperada)
```

## 🧪 Ejecutar Tests

```bash
# Todos los tests con cobertura
cd backend
npm test

# Solo tests unitarios
npm run test:unit

# Solo tests de integración
npm run test:integration

# Modo watch (desarrollo)
npm run test:watch
```

## 📊 Monitoreo y Logs

### Health Check Endpoint
```bash
curl http://localhost:3000/api/health
# Respuesta: {"status":"ok","timestamp":"2026-08-23T..."}
```

### Logs de Auditoría
- Ubicados en `/api/logs` (requiere autenticación admin)
- Incluyen: usuario, acción, IP, timestamp, detalles
- Exportables a Excel para cumplimiento normativo

### Docker Logs
```bash
docker compose logs -f orange-match
```

## 🔄 Backup y Recuperación

### Backup Automático
El sistema crea backups automáticos antes de:
- Importaciones masivas
- Cambios críticos de configuración
- Actualizaciones de versión

### Backup Manual de Volúmenes Docker
```bash
# Base de datos
docker run --rm \
  -v orange-match-database:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz -C /data .

# Datos de empresas
docker run --rm \
  -v orange-match-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/data-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Restaurar Backup
```bash
# Detener contenedor
docker compose down

# Restaurar archivos
tar xzf db-backup-20260823.tar.gz -C /ruta/a/restaurar

# Reiniciar
docker compose up -d
```

## 🚨 Solución de Problemas

### El puerto 3000 no responde
```bash
# Ver logs
docker compose logs orange-match

# O sin Docker:
cd backend
node server.js

# Causas comunes:
# 1. node_modules incompatible → npm install
# 2. Puerto ya en uso → cambiar PORT en .env
# 3. Falta .db_key → verificar permisos
```

### Error de cifrado de base de datos
```bash
# Verificar que .db_key existe y tiene permisos 600
ls -la backend/.db_key
chmod 600 backend/.db_key

# Si perdiste la llave, NO hay recuperación posible
# (por diseño de seguridad - sin backdoor)
```

### Tests fallan
```bash
# Limpiar caché de Jest
cd backend
npx jest --clearCache

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

## 📈 Roadmap de Mejoras

### Fase 1 (Completada ✅)
- [x] Tests unitarios e integración
- [x] 2FA para administradores
- [x] HTTPS forzado en producción
- [x] CI/CD pipeline
- [x] Dockerización

### Fase 2 (En Progreso)
- [ ] Sistema de colas (BullMQ + Redis) para tareas largas
- [ ] Caché Redis para consultas frecuentes
- [ ] Monitoreo con Prometheus + Grafana
- [ ] Alertas automáticas (email/Slack)

### Fase 3 (Planeada)
- [ ] Migración a PostgreSQL para escalabilidad
- [ ] Clustering para alta disponibilidad
- [ ] API GraphQL opcional
- [ ] Mobile app (React Native)

## 📞 Soporte

- **Documentación completa:** `/docs`
- **Reportar bugs:** GitHub Issues
- **Consultas comerciales:** illanjavier9@gmail.com

## ⚖️ Licencia

**PROPIEDAD INTELECTUAL CERRADA** - Ver archivo LICENSE para términos completos.

Titular: JAVIER ILLAN GONZALEZ / ORANGE CREW

---

**Construido con ❤️ por Orange Crew**  
*La solución más segura y automatizada del mercado para amarre de balanzas IVA*
