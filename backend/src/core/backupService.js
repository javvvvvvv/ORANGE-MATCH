import { db } from "../models/db.js";
import { getEmpresa } from "../models/empresasModel.js";
import { listAmarresByEmpresaRaw } from "../models/amarresModel.js";
import { listDatosFiscalesByEmpresa } from "../models/datosFiscalesModel.js";
import { listAnexoConfigRaw } from "../models/anexoConfigModel.js";
import { listTarifasIsrRaw } from "../models/tarifasIsrModel.js";
import { createBackupRaw, purgeOldBackups } from "../models/backupsModel.js";
import { auditLog } from "./auditLog.js";

// ── RESPALDO AUTOMÁTICO DE SEGURIDAD ANTES DE IMPORTACIONES ───────────────
// Las reglas de amarre/config_pt son críticas. Antes de aceptar una importación
// que pueda provocar cambios indirectos, se guarda un snapshot de la empresa.
export function snapshotEmpresa(empresaId, motivo, userId) {
  const empresa = db.prepare("SELECT * FROM empresas WHERE id=?").get(empresaId);
  if (!empresa) return null;
  const datos = {
    tipo: "AUTO_EMPRESA",
    motivo: motivo || "Antes de importar",
    empresa_id: Number(empresaId),
    empresas: [empresa],
    anexo_config: listAnexoConfigRaw(),
    amarres: listAmarresByEmpresaRaw(empresaId),
    datos_fiscales: listDatosFiscalesByEmpresa(empresaId),
    tarifas_isr: listTarifasIsrRaw(),
    ajuste_inflacion: db.prepare("SELECT * FROM ajuste_inflacion WHERE empresa_id=?").all(empresaId),
    ts: new Date().toISOString()
  };
  const nombre = `AUTO - ${empresa.nombre} - ${motivo || 'Importación'} - ${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const info = createBackupRaw(nombre, JSON.stringify(datos), userId);
  purgeOldBackups(100);
  return info.lastInsertRowid;
}

export function protegerConfigPTAntesDeImportar(empresaId, motivo, req) {
  const empresa = getEmpresa(empresaId);
  if (!empresa) throw new Error("Empresa no encontrada");
  const backupId = snapshotEmpresa(empresaId, motivo, req.user.id);
  auditLog(req.user.id, req.user.username, "AUTO_BACKUP_PREIMPORT", {
    empresa: empresaId, motivo, backupId,
    tenia_config_pt: !!(empresa.config_pt && String(empresa.config_pt).trim() && String(empresa.config_pt).trim() !== 'null')
  }, req.ip);
  return backupId;
}
