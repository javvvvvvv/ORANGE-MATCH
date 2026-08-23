// ============================================================
//  dataStore.js — Almacenamiento INDEPENDIENTE de archivos periódicos
//  (balanzas, valores del Anexo de IVA, catálogos de cuentas)
// ============================================================
//
// Por qué existe este módulo:
// Antes, cada balanza mensual, cada catálogo de cuentas y cada valor del Anexo
// de IVA se guardaban como texto JSON dentro de columnas de la base de datos
// SQLite principal (orangematch.db). Con varias empresas, 12 meses al año y
// balanzas de cientos de cuentas, ese único archivo .db crece sin control y se
// vuelve pesado de respaldar/mover. Además, cada "Backup" duplicaba TODO ese
// contenido otra vez dentro de la misma base de datos.
//
// Ahora cada balanza/Anexo/catálogo se guarda en su PROPIO archivo, cifrado
// (AES-256-GCM), fuera de la base de datos, organizado así:
//
//   data/
//     empresa_12/
//       balanzas/2026-06.enc
//       balanzas/2026-07.enc
//       anexo_iva/2026-06.enc
//       catalogo/actual.enc
//
// orangematch.db se queda solo con lo pequeño y de consulta frecuente: usuarios,
// datos generales de la empresa, configuración, amarres (validado sí/no), etc.
// Esto escala mucho mejor: cada archivo es independiente (se puede respaldar,
// copiar o borrar por separado sin tocar los demás) y el .db principal se
// mantiene chico y rápido sin importar cuántos meses/empresas se acumulen.
//
// La llave de cifrado se genera sola la primera vez (archivo .data_key, no se
// sube a control de versiones) o se puede fijar manualmente con la variable de
// entorno DATA_ENCRYPTION_KEY (64 caracteres hexadecimales = 32 bytes) si se
// prefiere administrarla aparte (por ejemplo, en un gestor de secretos).

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ROOT_DIR } from "./src/config/env.js";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, "data");

const KEY_FILE = path.join(ROOT_DIR, ".data_key");

function obtenerLlave() {
  if (process.env.DATA_ENCRYPTION_KEY) {
    const k = Buffer.from(process.env.DATA_ENCRYPTION_KEY, "hex");
    if (k.length === 32) return k;
    console.warn("⚠ DATA_ENCRYPTION_KEY inválida (debe ser 64 caracteres hex) — se ignora.");
  }
  if (fs.existsSync(KEY_FILE)) {
    const k = Buffer.from(fs.readFileSync(KEY_FILE, "utf8").trim(), "hex");
    if (k.length === 32) return k;
  }
  const llave = crypto.randomBytes(32);
  try {
    fs.writeFileSync(KEY_FILE, llave.toString("hex"), { mode: 0o600 });
  } catch (e) {
    fs.writeFileSync(KEY_FILE, llave.toString("hex"));
  }
  console.log("🔑 Se generó una nueva llave de cifrado para los datos en:", KEY_FILE);
  console.log("   Guarda este archivo junto con tus respaldos — sin él no se pueden leer los datos guardados.");
  return llave;
}

const LLAVE = obtenerLlave();

function cifrar(objeto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", LLAVE, iv);
  const texto = JSON.stringify(objeto);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, cifrado]); // [12 bytes iv][16 bytes tag][payload cifrado]
}

function descifrar(buffer) {
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const cifrado = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", LLAVE, iv);
  decipher.setAuthTag(tag);
  const texto = Buffer.concat([decipher.update(cifrado), decipher.final()]).toString("utf8");
  return JSON.parse(texto);
}

// Evita path traversal: cada parte de la ruta se limpia a solo
// [a-zA-Z0-9_.-], nunca se usa texto del usuario tal cual en el filesystem.
function parteSegura(p) {
  return String(p).replace(/[^a-zA-Z0-9_.\-]/g, "_");
}

function rutaArchivo(empresaId, tipo, clave) {
  return path.join(DATA_DIR, `empresa_${parteSegura(empresaId)}`, parteSegura(tipo), `${parteSegura(clave)}.enc`);
}

/** Guarda un objeto (balanza, valores de Anexo IVA, catálogo, etc.) cifrado en su propio archivo. */
export function guardarDato(empresaId, tipo, clave, objeto) {
  const ruta = rutaArchivo(empresaId, tipo, clave);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, cifrar(objeto));
}

/** Lee un dato guardado; regresa null si no existe o no se pudo leer/descifrar. */
export function leerDato(empresaId, tipo, clave) {
  const ruta = rutaArchivo(empresaId, tipo, clave);
  if (!fs.existsSync(ruta)) return null;
  try {
    return descifrar(fs.readFileSync(ruta));
  } catch (e) {
    console.error(`⚠ No se pudo leer/descifrar ${ruta}:`, e.message);
    return null;
  }
}

/** Lista las claves (periodos) guardadas para una empresa+tipo, ej. ["2026-01","2026-02"]. */
export function listarClaves(empresaId, tipo) {
  const carpeta = path.join(DATA_DIR, `empresa_${parteSegura(empresaId)}`, parteSegura(tipo));
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta)
    .filter(f => f.endsWith(".enc"))
    .map(f => f.replace(/\.enc$/, ""));
}

export function eliminarDato(empresaId, tipo, clave) {
  const ruta = rutaArchivo(empresaId, tipo, clave);
  if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
}

/** Borra TODOS los archivos de una empresa (al eliminar la empresa por completo). */
export function eliminarEmpresa(empresaId) {
  const carpeta = path.join(DATA_DIR, `empresa_${parteSegura(empresaId)}`);
  if (fs.existsSync(carpeta)) fs.rmSync(carpeta, { recursive: true, force: true });
}

// ── ÍNDICE LEGIBLE DE EMPRESAS ─────────────────────────────────────────────
// Las carpetas de datos usan el id (empresa_12) y no el nombre: el nombre
// puede cambiar, traer acentos o caracteres inválidos para rutas, o repetirse
// entre dos empresas. Para no perder de vista qué carpeta es cuál al navegar
// data/ a mano, se mantiene este archivo de texto con el mapeo id -> nombre.
const INDICE_EMPRESAS = path.join(DATA_DIR, "_empresas.txt");

function leerIndiceEmpresas() {
  if (!fs.existsSync(INDICE_EMPRESAS)) return {};
  const mapa = {};
  fs.readFileSync(INDICE_EMPRESAS, "utf8").split("\n").forEach(linea => {
    const m = linea.match(/^(empresa_[^=]+)\s*=\s*(.*)$/);
    if (m) mapa[m[1].trim()] = m[2].trim();
  });
  return mapa;
}

function escribirIndiceEmpresas(mapa) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const lineas = Object.keys(mapa).sort().map(k => `${k} = ${mapa[k]}`);
  fs.writeFileSync(INDICE_EMPRESAS, lineas.join("\n") + (lineas.length ? "\n" : ""));
}

/** Registra o actualiza el nombre visible de una empresa en el índice legible. */
export function actualizarIndiceEmpresas(empresaId, nombre) {
  const mapa = leerIndiceEmpresas();
  mapa[`empresa_${parteSegura(empresaId)}`] = nombre || "(sin nombre)";
  escribirIndiceEmpresas(mapa);
}

/** Quita una empresa del índice legible (al eliminarla). */
export function quitarDeIndiceEmpresas(empresaId) {
  const mapa = leerIndiceEmpresas();
  delete mapa[`empresa_${parteSegura(empresaId)}`];
  escribirIndiceEmpresas(mapa);
}

export { DATA_DIR };
