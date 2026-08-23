/* ============================================================================
   PROPIEDAD INTELECTUAL Y LICENCIA COMERCIAL CERRADA
   ============================================================================
   Autor Legal y Titular de Derechos: JAVIER ILLAN GONZALEZ
   Organización: ORANGE CREW
   Contacto: ILLANJAVIER9@GMAIL.COM

   ADVERTENCIA LEGAL (MÉXICO Y GLOBAL):
   Este código fuente y su arquitectura son propiedad intelectual exclusiva de
   JAVIER ILLAN GONZALEZ. Queda estrictamente prohibida su reproducción,
   distribución, modificación, ingeniería inversa, copia o uso comercial sin la
   autorización expresa y por escrito del autor. Obra protegida conforme a la
   Ley Federal del Derecho de Autor y tratados internacionales aplicables.
   ============================================================================ */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import dotenv from "dotenv";

dotenv.config();

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Raíz del proyecto backend (dos niveles arriba de src/config)
export const ROOT_DIR = path.resolve(__dirname, "..", "..");

export const PORT = process.env.PORT || 3000;

export const JWT_SECRET = process.env.JWT_SECRET || (() => {
  // Auto-genera un secreto si no hay .env (y lo guarda)
  const s = randomBytes(64).toString("hex");
  fs.appendFileSync(path.join(ROOT_DIR, ".env"), `\nJWT_SECRET=${s}\n`);
  return s;
})();

// Blindaje: un JWT_SECRET corto o adivinable permite falsificar sesiones de
// CUALQUIER usuario (incluido admin). Si detectamos uno débil, lo avisamos
// fuerte en consola — no lo cambiamos solos para no invalidar sesiones sin
// que el administrador lo sepa, pero sí insistimos en que lo rote.
if (JWT_SECRET.length < 32) {
  console.warn("\n ALERTA DE SEGURIDAD: JWT_SECRET es demasiado corto/débil.");
  console.warn("   Cualquiera que lo adivine puede falsificar sesiones de administrador.");
  console.warn("   Genera uno fuerte y reemplázalo en tu archivo .env, por ejemplo:");
  console.warn("   JWT_SECRET=" + randomBytes(48).toString("hex") + "\n");
}

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(o => o.trim()).filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  console.warn(" ALLOWED_ORIGINS no está configurado: la API acepta peticiones desde CUALQUIER origen.");
  console.warn("  Antes de publicar en una IP pública, define ALLOWED_ORIGINS en tu .env.");
}
