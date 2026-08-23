# Antes de publicar Orange Match en una IP pública

Ningún sistema es "inhackeable" — ni la banca lo dice de sí misma. Lo que sí se puede
hacer es cerrar los riesgos conocidos. Esto es lo que ya se corrigió en esta entrega
y lo que **tú** todavía debes hacer a mano antes de exponerlo a internet.

## ✅ Ya corregido en este código

- El usuario `admin` ya NO se crea con una contraseña fija conocida (`Admin1234!`).
  Ahora se genera una aleatoria y se guarda una sola vez en
  `CONTRASENA_ADMIN_INICIAL.txt` junto al servidor.
- El servidor avisa en consola si tu `JWT_SECRET` es débil o corto.
- Content-Security-Policy activado (antes estaba completamente desactivado).
- CORS ahora se puede restringir a dominios específicos con `ALLOWED_ORIGINS`.
- Rate limiting en login (ya existía) y en toda la API (ya existía).
- Contraseñas con bcrypt, 12 rondas (ya existía, está bien).

## 🔴 Esto lo tienes que hacer TÚ, a mano, antes de salir a internet

1. **Rota el `JWT_SECRET`.** El que traía tu `.env` (`OrangeMatch_ServidorRuma_2026`)
   viene incluido en el ZIP que me compartiste — trátalo como comprometido.
   Genera uno nuevo (64 caracteres al azar) y ponlo en tu `.env`. Al cambiarlo,
   todas las sesiones activas se cierran (los usuarios tendrán que volver a
   entrar), es normal.
2. **Abre `CONTRASENA_ADMIN_INICIAL.txt`, cámbiala desde la app y BORRA el archivo.**
3. **Define `ALLOWED_ORIGINS` en tu `.env`** con el dominio o IP exacta desde donde
   se va a usar el sistema, por ejemplo:
   `ALLOWED_ORIGINS=https://tudominio.com`
   Si no lo defines, la API sigue aceptando peticiones de cualquier origen.
4. **Ponle HTTPS.** Todavía no vi certificado/proxy en este proyecto — sin HTTPS,
   contraseñas y tokens viajan en texto plano por internet. Lo más simple:
   un dominio + Caddy o Nginx como proxy inverso delante de Node (Caddy
   consigue el certificado solo). Si me confirmas que sí quieres esto, te
   preparo la configuración.
5. **No compartas `.env`, `.data_key` ni la carpeta `data/`** en ningún ZIP,
   correo o repositorio — son las llaves de todo. Ya quedaron en `.gitignore`.
6. **Revisa quién tiene cuentas `admin`** (`SELECT username,role FROM users` en
   `orangematch.db`) y quita las que no reconozcas.
7. **Haz un respaldo antes de mover nada** (botón de Backups ya existente).

## Pendiente si quieres ir más a fondo (avísame y lo hacemos)

- Firewall del servidor: solo abrir el puerto necesario (443 si usas proxy con
  HTTPS), nunca dejar el 3000 abierto directo a internet.
- Auditoría del `audit_log` (ya existe la tabla) con alertas si hay muchos
  intentos fallidos de login.
- 2FA para cuentas `admin`.
