import { db } from "./db.js";

export function getAjusteInflacion(empresaId, anio) {
  const row = db.prepare(
    "SELECT empresa_id, anio, config, inpc_fin, inpc_prev, updated_at FROM ajuste_inflacion WHERE empresa_id=? AND anio=?"
  ).get(empresaId, anio);
  if (!row) return null;
  let config = {};
  try { config = row.config ? JSON.parse(row.config) : {}; } catch (_) {}
  return { ...row, config };
}

export function saveAjusteInflacion(empresaId, anio, payload) {
  const config = JSON.stringify(payload?.config || {});
  const inpcFin = payload?.inpc_fin === "" || payload?.inpc_fin == null ? null : Number(payload.inpc_fin);
  const inpcPrev = payload?.inpc_prev === "" || payload?.inpc_prev == null ? null : Number(payload.inpc_prev);
  db.prepare(`
    INSERT INTO ajuste_inflacion (empresa_id, anio, config, inpc_fin, inpc_prev, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(empresa_id, anio) DO UPDATE SET
      config=excluded.config,
      inpc_fin=excluded.inpc_fin,
      inpc_prev=excluded.inpc_prev,
      updated_at=datetime('now')
  `).run(empresaId, anio, config, inpcFin, inpcPrev);
  return getAjusteInflacion(empresaId, anio);
}
