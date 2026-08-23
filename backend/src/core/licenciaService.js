import { db } from "../models/db.js";
import { getLicencia, getLicenciaStatus, activarLicencia } from "../models/licenciaModel.js";
import { auditLog } from "./auditLog.js";

// Verifica la licencia en cada request (excepto login, backups y la propia
// ruta de licencia). Si expiró, autodestruye empresas y config (NO backups).
export function checkLicencia(req, res, next) {
  const bypass = ["/auth/login", "/licencia", "/backups"];
  if (bypass.some(p => req.path.startsWith(p))) return next();
  const lic = getLicencia();
  if (!lic || !lic.activa) return res.status(403).json({ error: "LICENCIA_INACTIVA" });
  if (lic.expira_at && new Date(lic.expira_at) < new Date()) {
    db.prepare("DELETE FROM empresas").run();
    db.prepare("DELETE FROM anexo_config").run();
    db.prepare("UPDATE licencia SET activa=0 WHERE id=1").run();
    auditLog(null, "SISTEMA", "LICENCIA_EXPIRADA_AUTODESTRUCCION", {}, req.ip);
    return res.status(403).json({ error: "LICENCIA_EXPIRADA" });
  }
  next();
}

export function obtenerStatusLicencia() {
  return getLicenciaStatus() || { activa: 0 };
}

// Clave válida: "ORANGE-" + año-mes actual, con margen de ±1 mes.
export function validarClaveLicencia(clave) {
  const ahora = new Date();
  const claveEsperada = `ORANGE-${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(ahora); prev.setMonth(prev.getMonth() - 1);
  const next = new Date(ahora); next.setMonth(next.getMonth() + 1);
  const clavePrev = `ORANGE-${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const claveNext = `ORANGE-${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  return [claveEsperada, clavePrev, claveNext].includes(clave?.trim().toUpperCase());
}

// Activa por 4 meses desde hoy.
export function activar(clave) {
  const expira = new Date();
  expira.setMonth(expira.getMonth() + 4);
  activarLicencia(clave, expira.toISOString());
  return expira.toISOString();
}
