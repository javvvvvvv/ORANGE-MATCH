import { db } from "./db.js";

export function listBackupsMeta() {
  return db.prepare("SELECT id,nombre,created_by,created_at,datos FROM backups ORDER BY created_at DESC").all();
}

export function getBackup(id) {
  return db.prepare("SELECT datos FROM backups WHERE id=?").get(id);
}

export function getBackupExport(id) {
  return db.prepare("SELECT nombre,datos FROM backups WHERE id=?").get(id);
}

export function createBackup(nombre, datos, createdBy) {
  return db.prepare("INSERT INTO backups (nombre,datos,created_by) VALUES (?,?,?)")
    .run(nombre, JSON.stringify(datos), createdBy);
}

export function createBackupRaw(nombre, datosJson, createdBy) {
  return db.prepare("INSERT INTO backups (nombre,datos,created_by) VALUES (?,?,?)")
    .run(nombre, datosJson, createdBy);
}

// Conserva hasta 100 respaldos (incluidos los automáticos) para evitar que
// un respaldo manual elimine el respaldo automático que protege una importación.
export function purgeOldBackups(keep = 100) {
  const old = db.prepare("SELECT id FROM backups ORDER BY created_at DESC LIMIT -1 OFFSET ?").all(keep);
  old.forEach(r => db.prepare("DELETE FROM backups WHERE id=?").run(r.id));
}

// Restaura una sola empresa (respaldo automático) dentro de una transacción atómica.
export const restoreEmpresaFromBackup = db.transaction((e, amarres, datosFiscales, ajustesInflacion = []) => {
  db.prepare(`UPDATE empresas SET nombre=?, rfc=?, config_iva=?, config_pt=?, updated_at=? WHERE id=?`)
    .run(e.nombre, e.rfc, e.config_iva, e.config_pt ?? null, e.updated_at, e.id);
  db.prepare("DELETE FROM amarres WHERE empresa_id=?").run(e.id);
  (amarres || []).forEach(a => {
    db.prepare("INSERT INTO amarres (id,empresa_id,periodo,validado,fecha_validacion) VALUES (?,?,?,?,?)")
      .run(a.id, a.empresa_id, a.periodo, a.validado, a.fecha_validacion);
  });
  db.prepare("DELETE FROM datos_fiscales WHERE empresa_id=?").run(e.id);
  (datosFiscales || []).forEach(d => {
    db.prepare(`INSERT INTO datos_fiscales (id,empresa_id,anio,regimen_fiscal,coeficiente_utilidad,perdidas_fiscales,ptu_pagada,saldo_favor_isr,deduccion_ciega) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(d.id, d.empresa_id, d.anio, d.regimen_fiscal, d.coeficiente_utilidad, d.perdidas_fiscales, d.ptu_pagada, d.saldo_favor_isr, d.deduccion_ciega);
  });
  db.prepare("DELETE FROM ajuste_inflacion WHERE empresa_id=?").run(e.id);
  (ajustesInflacion || []).forEach(a => {
    db.prepare(`INSERT INTO ajuste_inflacion (empresa_id,anio,config,inpc_fin,inpc_prev,updated_at) VALUES (?,?,?,?,?,?)`)
      .run(a.empresa_id, a.anio, a.config, a.inpc_fin, a.inpc_prev, a.updated_at);
  });
});

// Restaura TODO el sistema (todas las empresas y configuración global) desde un
// respaldo completo, dentro de una transacción atómica.
export const restoreFullFromBackup = db.transaction((datos) => {
  db.prepare("DELETE FROM empresas").run();
  (datos.empresas || []).forEach(e => {
    db.prepare("INSERT INTO empresas (id,nombre,rfc,config_iva,config_pt,updated_at) VALUES (?,?,?,?,?,?)")
      .run(e.id, e.nombre, e.rfc, e.config_iva, e.config_pt ?? null, e.updated_at);
  });
  if (datos.anexo_config?.[0])
    db.prepare("INSERT OR REPLACE INTO anexo_config (id,config) VALUES (1,?)").run(datos.anexo_config[0].config);
  if (datos.tarifas_isr?.[0])
    db.prepare("INSERT OR REPLACE INTO tarifas_isr (id,config) VALUES (1,?)").run(datos.tarifas_isr[0].config);
  db.prepare("DELETE FROM amarres").run();
  (datos.amarres || []).forEach(a => {
    db.prepare("INSERT INTO amarres (id,empresa_id,periodo,validado,fecha_validacion) VALUES (?,?,?,?,?)")
      .run(a.id, a.empresa_id, a.periodo, a.validado, a.fecha_validacion);
  });
  db.prepare("DELETE FROM datos_fiscales").run();
  (datos.datos_fiscales || []).forEach(d => {
    db.prepare(`INSERT INTO datos_fiscales (id,empresa_id,anio,regimen_fiscal,coeficiente_utilidad,perdidas_fiscales,ptu_pagada,saldo_favor_isr,deduccion_ciega) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(d.id, d.empresa_id, d.anio, d.regimen_fiscal, d.coeficiente_utilidad, d.perdidas_fiscales, d.ptu_pagada, d.saldo_favor_isr, d.deduccion_ciega);
  });
  db.prepare("DELETE FROM ajuste_inflacion").run();
  (datos.ajuste_inflacion || []).forEach(a => {
    db.prepare(`INSERT INTO ajuste_inflacion (empresa_id,anio,config,inpc_fin,inpc_prev,updated_at) VALUES (?,?,?,?,?,?)`)
      .run(a.empresa_id, a.anio, a.config, a.inpc_fin, a.inpc_prev, a.updated_at);
  });
});

export { db };
