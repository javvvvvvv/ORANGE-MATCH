# Dockerfile para Orange Match Backend + Frontend
# ============================================================================
# Construye una imagen optimizada para producción con:
# - Node.js 20 LTS (alpine para menor tamaño)
# - Frontend pre-compilado
# - SQLite cifrado listo para usar
# - Puerto 3000 expuesto
# ============================================================================

FROM node:20-alpine AS base

# Instalar dependencias del sistema necesarias para better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite-libs

WORKDIR /app

# ============================================================================
# Etapa 1: Build del Frontend
# ============================================================================
FROM base AS frontend-build

COPY frontend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY frontend/ ./
RUN npm run build

# ============================================================================
# Etapa 2: Backend con dependencias
# ============================================================================
FROM base AS backend-build

COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY backend/ ./

# Copiar el build del frontend desde la etapa anterior
COPY --from=frontend-build /app/dist ./dist

# ============================================================================
# Etapa 3: Imagen final de producción (más ligera)
# ============================================================================
FROM base AS production

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S orange && adduser -S orange -u 1001 -G orange

WORKDIR /app

# Copiar backend construido
COPY --from=backend-build --chown=orange:orange /app .

# Variables de entorno para producción
ENV NODE_ENV=production
ENV PORT=3000

# Exponer puerto
EXPOSE 3000

# Cambiar a usuario no-root
USER orange

# Health check para monitoreo
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Comando de inicio
CMD ["node", "server.js"]

# ============================================================================
# Instrucciones de uso:
# ============================================================================
# 1. Construir: docker build -t orange-match:latest .
# 2. Ejecutar:  docker run -d -p 3000:3000 \
#                 -v orange-data:/app/data \
#                 -v orange-db:/app/backend \
#                 -e JWT_SECRET=tu-secreto-fuerte \
#                 -e ALLOWED_ORIGINS=https://tudominio.com \
#                 --name orange-match orange-match:latest
# 3. Logs:     docker logs -f orange-match
# ============================================================================
