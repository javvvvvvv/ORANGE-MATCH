import { db } from "./db.js";

export function listDatosFiscales(empresaId) {
  return db.prepare("SELECT * FROM datos_fiscales WHERE empresa_id=? ORDER BY anio DESC").all(empresaId);
}

// Usada en snapshots/respaldos automáticos (sin orden particular, igual que el original)
export function listDatosFiscalesByEmpresa(empresaId) {
  return db.prepare("SELECT * FROM datos_fiscales WHERE empresa_id=?").all(empresaId);
}

export function listAllDatosFiscales() {
  return db.prepare("SELECT * FROM datos_fiscales").all();
}

export function upsertDatosFiscales(empresaId, d) {
  db.prepare(`
    INSERT INTO datos_fiscales (empresa_id, anio, regimen_fiscal, coeficiente_utilidad, perdidas_fiscales, ptu_pagada, saldo_favor_isr, deduccion_ciega)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(empresa_id, anio) DO UPDATE SET
      regimen_fiscal=excluded.regimen_fiscal, coeficiente_utilidad=excluded.coeficiente_utilidad,
      perdidas_fiscales=excluded.perdidas_fiscales, ptu_pagada=excluded.ptu_pagada,
      saldo_favor_isr=excluded.saldo_favor_isr, deduccion_ciega=excluded.deduccion_ciega
  `).run(
    empresaId, d.anio, d.regimen_fiscal || null, d.coeficiente_utilidad || 0,
    d.perdidas_fiscales || 0, d.ptu_pagada || 0, d.saldo_favor_isr || 0, d.deduccion_ciega ?? 35
  );
}

export function deleteDatosFiscales(empresaId, anio) {
  db.prepare("DELETE FROM datos_fiscales WHERE empresa_id=? AND anio=?").run(empresaId, anio);
}

export function deleteDatosFiscalesByEmpresa(empresaId) {
  db.prepare("DELETE FROM datos_fiscales WHERE empresa_id=?").run(empresaId);
}

export function insertDatosFiscalesRaw(d) {
  db.prepare(`INSERT INTO datos_fiscales (id,empresa_id,anio,regimen_fiscal,coeficiente_utilidad,perdidas_fiscales,ptu_pagada,saldo_favor_isr,deduccion_ciega) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(d.id, d.empresa_id, d.anio, d.regimen_fiscal, d.coeficiente_utilidad, d.perdidas_fiscales, d.ptu_pagada, d.saldo_favor_isr, d.deduccion_ciega);
}

export function deleteAllDatosFiscales() {
  db.prepare("DELETE FROM datos_fiscales").run();
}
