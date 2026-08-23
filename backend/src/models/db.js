import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { ROOT_DIR } from "../config/env.js";
import { getDbKeyHex } from "../config/masterKey.js";
import { abrirBaseDeDatosCifrada } from "./openEncryptedDb.js";

const DB_PATH = path.join(ROOT_DIR, "orangematch.db");

// Abre orangematch.db cifrada (SQLCipher/AES-256). Si el archivo existe y
// todavía está en texto plano (instalaciones previas a este cambio), esta
// función lo detecta y lo cifra automáticamente antes de continuar — no
// requiere ningún paso manual.
export const db = abrirBaseDeDatosCifrada(DB_PATH, getDbKeyHex());
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'viewer',  -- admin | editor | viewer
    active     INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,                           -- fecha de vencimiento (ISO o YYYY-MM-DD). NULL = sin vencimiento
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS empresas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL,
    rfc        TEXT,
    config_iva TEXT,   -- JSON con cuentas y operaciones
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS anexo_config (
    id       INTEGER PRIMARY KEY DEFAULT 1,
    config   TEXT   -- JSON fila/columna de cada dato del anexo
  );

  CREATE TABLE IF NOT EXISTS backups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL,
    datos      TEXT NOT NULL,   -- JSON snapshot completo
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    username   TEXT,
    action     TEXT NOT NULL,
    detail     TEXT,
    ip         TEXT,
    ts         TEXT DEFAULT (datetime('now'))
  );
`);

// Migración: agregar columna expires_at si la tabla ya existía sin ella
try {
  db.exec(`ALTER TABLE users ADD COLUMN expires_at TEXT`);
} catch (_) { /* ya existe */ }

// Migración: agregar columna config_pt (configuración de Papeles de Trabajo:
// ISR, Anexo IVA, anticipos, etc.) a empresas si la tabla ya existía sin ella.
// El catálogo de cuentas (catalogo_cuentas) NO vive aquí: por su tamaño se
// guarda cifrado en disco vía dataStore.js (ver modelo de empresas).
try {
  db.exec(`ALTER TABLE empresas ADD COLUMN config_pt TEXT`);
} catch (_) { /* ya existe */ }

// ── Tablas complementarias de Papeles de Trabajo (datos pequeños, de consulta
// frecuente — las balanzas/Anexo IVA/catálogos "pesados" van cifrados en disco
// vía dataStore.js) ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS amarres (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id        INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    periodo           TEXT NOT NULL,               -- 'YYYY-MM'
    validado          INTEGER NOT NULL DEFAULT 0,
    fecha_validacion  TEXT,
    UNIQUE(empresa_id, periodo)
  );

  CREATE TABLE IF NOT EXISTS datos_fiscales (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    anio                INTEGER NOT NULL,
    regimen_fiscal      TEXT,
    coeficiente_utilidad REAL DEFAULT 0,
    perdidas_fiscales    REAL DEFAULT 0,
    ptu_pagada           REAL DEFAULT 0,
    saldo_favor_isr      REAL DEFAULT 0,
    deduccion_ciega      REAL DEFAULT 35,
    UNIQUE(empresa_id, anio)
  );

  CREATE TABLE IF NOT EXISTS tarifas_isr (
    id     INTEGER PRIMARY KEY DEFAULT 1,
    config TEXT   -- JSON: { mensual: {anio:[tramos]}, resico: {anio:[tramos]} } — global, aplica a todas las empresas
  );

  CREATE TABLE IF NOT EXISTS licencia (
    id         INTEGER PRIMARY KEY DEFAULT 1,
    clave      TEXT,
    activada_at TEXT,
    expira_at   TEXT,
    activa      INTEGER DEFAULT 0
  );

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

const licRow = db.prepare("SELECT id FROM licencia WHERE id=1").get();
if (!licRow) db.prepare("INSERT INTO licencia (id,activa) VALUES (1,0)").run();

// Usuario admin por defecto (solo si no existe ninguno). La contraseña se
// genera al azar cada vez (nunca queda una contraseña fija y conocida por
// cualquiera que haya visto el código) y se guarda UNA sola vez en un
// archivo local para que el administrador la lea y la borre de inmediato.
const adminExists = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
if (!adminExists) {
  const passwordInicial = randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "!Aa1";
  const hash = bcrypt.hashSync(passwordInicial, 12);
  db.prepare("INSERT INTO users (username, password, role) VALUES (?,?,?)")
    .run("admin", hash, "admin");
  const archivoPass = path.join(ROOT_DIR, "CONTRASENA_ADMIN_INICIAL.txt");
  fs.writeFileSync(archivoPass,
    `Usuario:     admin\nContraseña:  ${passwordInicial}\n\n` +
    ` Cambia esta contraseña en cuanto inicies sesión (Mi cuenta → Cambiar contraseña)\n` +
    ` Borra este archivo después de leerlo — no lo dejes en el servidor.\n`);
  console.log(" Usuario admin creado. La contraseña inicial quedó en: " + archivoPass);
  console.log("   Léela, cámbiala de inmediato y BORRA ese archivo.");
}
