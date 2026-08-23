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
import crypto from "crypto";
import { getDbKeyHex } from "../src/config/masterKey.js";
import { abrirBaseDeDatosCifrada } from "../src/models/openEncryptedDb.js";

const BACKEND = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PROJECT = path.resolve(BACKEND, "..");
const dbPath = path.join(BACKEND, "orangematch.db");
const dataDir = path.join(BACKEND, "data");
const keyPath = path.join(BACKEND, ".data_key");

function fail(msg) {
  console.error(`[ERROR] ${msg}`);
  process.exitCode = 1;
}

// Instalación totalmente nueva: todavía no existe orangematch.db (se crea
// cifrada la primera vez que arranque server.js). No hay nada que verificar
// todavía — no es un error, es el estado normal de un primer arranque.
if (!fs.existsSync(dbPath)) {
  console.log("");
  console.log("Orange Match - verificación de instalación");
  console.log("   Primer arranque: orangematch.db aún no existe, se creará cifrada al iniciar el servidor.");
  process.exit(0);
}
if (!fs.existsSync(keyPath)) fail("No existe backend/.data_key; no se pueden leer los datos cifrados.");

if (process.exitCode) process.exit();

// Abre (y si hiciera falta, cifra automáticamente) orangematch.db igual que
// lo hace el servidor — así esta verificación también sirve como "primera
// migración" si se corre antes de arrancar el server por primera vez.
const db = abrirBaseDeDatosCifrada(dbPath, getDbKeyHex());

// Migración segura de instalaciones antiguas: la v2.2.2 requiere esta tabla
// para Ajuste Anual por Inflación. Si la base viene de una versión anterior,
// se crea vacía sin tocar ningún dato existente.
db.exec(`
  CREATE TABLE IF NOT EXISTS ajuste_inflacion (
    empresa_id  INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    anio        INTEGER NOT NULL,
    config      TEXT,
    inpc_fin    REAL,
    inpc_prev   REAL,
    updated_at  TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (empresa_id, anio)
  );
`);
const integrity = db.pragma("integrity_check", { simple: true });
if (integrity !== "ok") fail(`SQLite integrity_check: ${integrity}`);

const required = ["users","empresas","amarres","anexo_config","backups","audit_log","datos_fiscales","licencia","tarifas_isr","ajuste_inflacion"];
const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
for (const t of required) if (!tables.has(t)) fail(`Falta la tabla ${t}.`);

const empresas = db.prepare("SELECT id,nombre FROM empresas ORDER BY id").all();
const key = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
if (key.length !== 32) fail(".data_key no contiene una llave AES-256 válida.");

let archivos = 0, ilegibles = 0;
function revisarDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) revisarDir(p);
    else if (ent.name.endsWith(".enc")) {
      archivos++;
      try {
        const b = fs.readFileSync(p);
        if (b.length < 29) throw new Error("archivo demasiado pequeño");
        const iv = b.subarray(0,12);
        const tag = b.subarray(12,28);
        const ciphertext = b.subarray(28);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
      } catch (e) {
        ilegibles++;
        console.error(`[AVISO] No se pudo descifrar ${path.relative(PROJECT,p)}: ${e.message}`);
      }
    }
  }
}
revisarDir(dataDir);

const empresaIdsConDatos = new Set();
if (fs.existsSync(dataDir)) {
  for (const name of fs.readdirSync(dataDir)) {
    const m = name.match(/^empresa_(\d+)$/);
    if (m) empresaIdsConDatos.add(Number(m[1]));
  }
}
const huerfanas = [...empresaIdsConDatos].filter(id => !empresas.some(e => e.id === id));

console.log("");
console.log("Orange Match - verificación de instalación");
console.log(`   SQLite:          OK (${empresas.length} empresas)`);
console.log(`   Datos cifrados:  ${archivos} archivos`);
console.log(`   Descifrables:    ${archivos - ilegibles}/${archivos}`);
console.log(`   Carpetas sin BD: ${huerfanas.length}`);
if (huerfanas.length) console.log(`   IDs: ${huerfanas.join(", ")}`);

if (ilegibles || huerfanas.length) process.exitCode = 1;
else console.log("   Resultado:       TODO CORRECTO");
db.close();
