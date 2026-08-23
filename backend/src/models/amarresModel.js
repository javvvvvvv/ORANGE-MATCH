import { db } from "./db.js";

export function listAmarres(empresaId) {
  return db.prepare("SELECT periodo, validado, fecha_validacion FROM amarres WHERE empresa_id=?").all(empresaId);
}

export function upsertAmarre(empresaId, periodo, validado, fecha) {
  db.prepare(`
    INSERT INTO amarres (empresa_id, periodo, validado, fecha_validacion) VALUES (?,?,?,?)
    ON CONFLICT(empresa_id, periodo) DO UPDATE SET validado=excluded.validado, fecha_validacion=excluded.fecha_validacion
  `).run(empresaId, periodo, validado ? 1 : 0, fecha);
}

export function deleteAmarresByEmpresa(empresaId) {
  db.prepare("DELETE FROM amarres WHERE empresa_id=?").run(empresaId);
}

export function insertAmarreRaw(a) {
  db.prepare("INSERT INTO amarres (id,empresa_id,periodo,validado,fecha_validacion) VALUES (?,?,?,?,?)")
    .run(a.id, a.empresa_id, a.periodo, a.validado, a.fecha_validacion);
}

export function listAmarresByEmpresaRaw(empresaId) {
  return db.prepare("SELECT * FROM amarres WHERE empresa_id=?").all(empresaId);
}

export function listAllAmarres() {
  return db.prepare("SELECT * FROM amarres").all();
}

export function deleteAllAmarres() {
  db.prepare("DELETE FROM amarres").run();
}
