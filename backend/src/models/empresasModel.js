import { db } from "./db.js";
import {
  guardarDato, leerDato, eliminarDato,
  eliminarEmpresa as eliminarEmpresaDatos,
  actualizarIndiceEmpresas, quitarDeIndiceEmpresas
} from "../../dataStore.js";

export function listEmpresas() {
  return db.prepare("SELECT * FROM empresas ORDER BY nombre").all();
}

// Reconstruye data/_empresas.txt a partir de la BD. Se corre una vez al
// arrancar el servidor por si el índice no existe todavía (instalaciones
// previas a este archivo) o quedó desincronizado.
export function reconstruirIndiceEmpresas() {
  const todas = db.prepare("SELECT id, nombre FROM empresas").all();
  todas.forEach(e => actualizarIndiceEmpresas(e.id, e.nombre));
}

export function getEmpresa(id) {
  return db.prepare("SELECT id, nombre, config_pt FROM empresas WHERE id=?").get(id);
}

export function empresaExists(id) {
  return db.prepare("SELECT id FROM empresas WHERE id=?").get(id);
}

export function createEmpresa(nombre, rfc) {
  const info = db.prepare("INSERT INTO empresas (nombre,rfc) VALUES (?,?)").run(nombre, rfc || "");
  actualizarIndiceEmpresas(info.lastInsertRowid, nombre);
  return info;
}

export function updateEmpresaFields(id, sets, vals) {
  db.prepare(`UPDATE empresas SET ${sets.join(",")} WHERE id=?`).run(...vals, id);
  // El nombre pudo cambiar en esta actualización; se relee de la BD para que
  // el índice legible de data/ siempre refleje el nombre actual.
  const actual = db.prepare("SELECT nombre FROM empresas WHERE id=?").get(id);
  if (actual) actualizarIndiceEmpresas(id, actual.nombre);
}

export function deleteEmpresa(id) {
  db.prepare("DELETE FROM empresas WHERE id=?").run(id);
  db.prepare("DELETE FROM amarres WHERE empresa_id=?").run(id);
  db.prepare("DELETE FROM datos_fiscales WHERE empresa_id=?").run(id);
  try { eliminarEmpresaDatos(id); } catch (e) { /* sin datos cifrados que borrar */ }
  try { quitarDeIndiceEmpresas(id); } catch (e) { /* índice legible: no crítico */ }
}

export function leerCatalogo(empresaId) {
  return leerDato(empresaId, "catalogo", "actual");
}

export function guardarCatalogo(empresaId, catalogo) {
  guardarDato(empresaId, "catalogo", "actual", catalogo || []);
}

export function leerBalanza(empresaId, periodo) {
  return leerDato(empresaId, "balanzas", periodo);
}

export function guardarBalanza(empresaId, periodo, balanza) {
  guardarDato(empresaId, "balanzas", periodo, balanza || []);
}

export function leerAnexoIva(empresaId, periodo) {
  return leerDato(empresaId, "anexo_iva", periodo);
}

export function guardarAnexoIva(empresaId, periodo, datos) {
  guardarDato(empresaId, "anexo_iva", periodo, datos || {});
}

export function leerIsrManual(empresaId, periodo) {
  return leerDato(empresaId, "isr_manual", periodo);
}

export function guardarIsrManual(empresaId, periodo, datos) {
  guardarDato(empresaId, "isr_manual", periodo, datos || {});
}

export function eliminarIsrManual(empresaId, periodo) {
  eliminarDato(empresaId, "isr_manual", periodo);
}
