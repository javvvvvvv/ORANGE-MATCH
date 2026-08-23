# CAMBIOS — 2026-08-17 — Bienvenida, logos, recuperación y Ajuste por Inflación

## 1. Recuperación de contraseña
Se agregó `RECUPERAR_CONTRASENA_ADMIN.BAT`.

- Exige elevación de administrador de Windows mediante UAC.
- Detiene Orange Match localmente.
- Cambia directamente el hash de `admin` en SQLite usando bcrypt.
- Genera una contraseña aleatoria nueva.
- Reinicia Orange Match con PM2 si PM2 está instalado.
- No existe una ruta HTTP de recuperación que pueda usarse remotamente.

## 2. Video de bienvenida
Se incorporó el video proporcionado por el usuario como:
`frontend/public/videos/orange-match-bienvenida.mp4`

El flujo es:
Video → continuar → login → sistema.

El navegador recibe el video en modo `muted` para permitir reproducción automática;
el usuario puede activar el sonido manualmente.

## 3. Logos
- Se retiraron las placas blancas del CSS.
- Se conserva el fondo uniforme de la aplicación.
- Orange Match completo se usa donde corresponde a la marca principal.
- Orange Crew completo se usa donde corresponde a la marca paraguas.
- Orange Crew icon se mantiene para favicon/uso compacto.
- Se agregó una sombra de contraste muy ligera sin alterar el SVG oficial.

## 4. Ajuste Anual por Inflación
Nueva tabla `ajuste_inflacion` y endpoints por empresa/ejercicio.

El papel de trabajo calcula:
- saldo al último día de cada mes;
- promedio anual de créditos;
- promedio anual de deudas;
- factor de ajuste anual;
- ajuste acumulable;
- ajuste deducible;
- captura manual de meses sin balanza;
- exportación a Excel.

La fórmula implementada corresponde al Art. 44 LISR:
factor = INPC último mes del ejercicio / INPC último mes del ejercicio inmediato anterior − 1.

La clasificación concreta de créditos y deudas debe ser revisada por el contador conforme a los artículos 45 y 46 LISR y las circunstancias de cada contribuyente.


## Audio automático

El video de bienvenida se configura para reproducirse con audio (`muted=false`, volumen 100%). Los navegadores modernos pueden bloquear el autoplay audible sin interacción del usuario; la aplicación no puede saltarse esa política. Cuando el navegador permita autoplay audible, el video inicia con sonido automáticamente.
