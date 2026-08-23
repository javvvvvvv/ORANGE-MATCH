import { db } from "./db.js";

export function getLicencia() {
  return db.prepare("SELECT * FROM licencia WHERE id=1").get();
}

export function getLicenciaStatus() {
  return db.prepare("SELECT activa, activada_at, expira_at FROM licencia WHERE id=1").get();
}

export function activarLicencia(clave, expiraIso) {
  db.prepare("UPDATE licencia SET clave=?,activada_at=datetime('now'),expira_at=?,activa=1 WHERE id=1")
    .run(clave, expiraIso);
}

export function desactivarLicenciaPorExpiracion() {
  db.prepare("UPDATE licencia SET activa=0 WHERE id=1").run();
}
