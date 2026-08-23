// ============================================================================
//  openEncryptedDb.js — abre orangematch.db y la cifra sola si hace falta
// ============================================================================
// Se llama UNA VEZ, al arrancar el servidor (desde db.js). Si la base ya
// está cifrada, simplemente la abre con la llave y regresa. Si la encuentra
// en texto plano (instalaciones existentes, previas a este cambio), la
// respalda y la cifra automáticamente antes de seguir — sin pasos manuales.
//
// Es intencionalmente conservador: si algo no cuadra en la verificación
// posterior a cifrar, se detiene con un error claro y deja el respaldo
// intacto, en vez de arrancar el servidor con una base en un estado dudoso.
// ============================================================================

import Database from "better-sqlite3-multiple-ciphers";
import fs from "fs";
import path from "path";

export function abrirBaseDeDatosCifrada(dbPath, keyHex) {
  const yaExiste = fs.existsSync(dbPath);

  if (yaExiste) {
    // ¿Está en texto plano? Si se puede leer sqlite_master sin llave, sí.
    const prueba = new Database(dbPath, { fileMustExist: true });
    let esPlano = true;
    try {
      prueba.prepare("SELECT count(*) FROM sqlite_master").get();
    } catch {
      esPlano = false;
    }
    prueba.close();

    if (esPlano) {
      migrarATextoPlanoACifrado(dbPath, keyHex);
    }
  }

  const db = new Database(dbPath);
  db.pragma(`cipher='sqlcipher'`);
  db.pragma(`key="x'${keyHex}'"`);
  // Confirma que la llave es correcta: si es incorrecta, esta lectura falla.
  try {
    db.prepare("SELECT count(*) FROM sqlite_master").get();
  } catch (e) {
    db.close();
    throw new Error(
      "No se pudo abrir orangematch.db con la llave de backend/.db_key. " +
      "Si cambiaste o perdiste ese archivo, la base no se puede leer. " +
      "Restaura backend/.db_key desde tu respaldo antes de continuar."
    );
  }
  return db;
}

function migrarATextoPlanoACifrado(dbPath, keyHex) {
  const bakPath = dbPath + ".antes-de-cifrar";
  console.log("🔒 orangematch.db está en texto plano — cifrando automáticamente (una sola vez)...");

  // Respaldo del archivo tal cual, ANTES de tocar nada.
  fs.copyFileSync(dbPath, bakPath);

  const origen = new Database(dbPath);
  origen.pragma(`cipher='sqlcipher'`);
  origen.pragma(`rekey="x'${keyHex}'"`);
  origen.close();

  // Verificación: sin llave debe fallar; con llave debe leer bien.
  const sinLlave = new Database(dbPath, { fileMustExist: true });
  let abrioSinLlave = true;
  try {
    sinLlave.prepare("SELECT count(*) FROM sqlite_master").get();
  } catch {
    abrioSinLlave = false;
  }
  sinLlave.close();

  const conLlave = new Database(dbPath, { fileMustExist: true, readonly: true });
  conLlave.pragma(`cipher='sqlcipher'`);
  conLlave.pragma(`key="x'${keyHex}'"`);
  let tablas = null;
  try {
    tablas = conLlave.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get();
  } catch { /* se valida abajo */ }
  conLlave.close();

  if (abrioSinLlave || !tablas || tablas.n === 0) {
    throw new Error(
      "La migración automática de orangematch.db a cifrado NO se pudo verificar. " +
      "El archivo original sin cifrar sigue intacto en: " + bakPath + ". " +
      "El servidor no va a arrancar para evitar arrancar con una base en mal estado. " +
      "Restaura ese respaldo si hace falta y avisa antes de reintentar."
    );
  }

  // Limpia -wal/-shm viejos del archivo en texto plano para que el motor no
  // se confunda al reabrir la base ya cifrada.
  for (const ext of ["-wal", "-shm"]) {
    const p = dbPath + ext;
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch { /* no crítico */ }
    }
  }

  console.log("✅ orangematch.db cifrada automáticamente (SQLCipher/AES-256).");
  console.log("   Respaldo del archivo original (sin cifrar) en:", bakPath);
  console.log("   Bórralo cuando confirmes que todo funciona bien.");
}
