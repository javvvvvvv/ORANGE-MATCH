// ============================================================================
//  masterKey.js — llave maestra para cifrar orangematch.db (SQLCipher)
// ============================================================================
// Esta llave es INDEPENDIENTE de la llave de dataStore.js (.data_key), que ya
// protege balanzas/anexos/catálogos con AES-256-GCM y no se toca aquí para no
// arriesgar los datos ya cifrados con ella.
//
// Resolución de la llave, en este orden:
//   1. Variable de entorno DB_ENCRYPTION_KEY (64 caracteres hex = 32 bytes).
//      Úsala si prefieres administrar la llave fuera del disco del servidor
//      (gestor de secretos, variable de entorno del sistema, etc).
//   2. Archivo .db_key junto al proyecto (se genera solo la primera vez,
//      permisos 0600, NUNCA se sube a git — ya está en .gitignore).
//
// SIN ESTA LLAVE NO SE PUEDE ABRIR orangematch.db UNA VEZ CIFRADA.
// Guárdala junto con tus respaldos, en un lugar distinto del servidor
// (USB, gestor de contraseñas, etc). Si la pierdes, la base de datos es
// irrecuperable — así funciona el cifrado real, no hay "puerta trasera".
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ROOT_DIR } from "./env.js";

const KEY_FILE = path.join(ROOT_DIR, ".db_key");

export function getDbKeyHex() {
  if (process.env.DB_ENCRYPTION_KEY) {
    const raw = process.env.DB_ENCRYPTION_KEY.trim();
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return raw.toLowerCase();
    console.warn("⚠ DB_ENCRYPTION_KEY inválida (debe ser 64 caracteres hex) — se ignora.");
  }
  if (fs.existsSync(KEY_FILE)) {
    const raw = fs.readFileSync(KEY_FILE, "utf8").trim();
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return raw.toLowerCase();
  }
  const nueva = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(KEY_FILE, nueva, { mode: 0o600 });
  } catch {
    fs.writeFileSync(KEY_FILE, nueva);
  }
  console.log("🔑 Se generó una nueva llave de cifrado para orangematch.db en:", KEY_FILE);
  console.log("   Guárdala junto con tus respaldos — sin ella la base de datos no se puede abrir.");
  return nueva;
}
