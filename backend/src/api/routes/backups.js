import { Router } from "express";
import { db } from "../../models/db.js";
import { auth } from "../../core/auth.js";
import { auditLog } from "../../core/auditLog.js";
import { listEmpresas } from "../../models/empresasModel.js";
import { listAnexoConfigRaw } from "../../models/anexoConfigModel.js";
import { listAllAmarres } from "../../models/amarresModel.js";
import { listAllDatosFiscales } from "../../models/datosFiscalesModel.js";
import { listTarifasIsrRaw } from "../../models/tarifasIsrModel.js";
import {
  listBackupsMeta, getBackup, getBackupExport, createBackup,
  purgeOldBackups, restoreEmpresaFromBackup, restoreFullFromBackup
} from "../../models/backupsModel.js";

const router = Router();

router.get("/", auth("admin"), (req, res) => {
  const rows = listBackupsMeta();
  res.json(rows.map(r => {
    let meta = {};
    try { const d = JSON.parse(r.datos || '{}'); meta = { tipo: d.tipo || 'MANUAL', empresa_id: d.empresa_id || null, motivo: d.motivo || null }; } catch (_) {}
    return { id: r.id, nombre: r.nombre, created_by: r.created_by, created_at: r.created_at, ...meta };
  }));
});

router.post("/", auth("admin"), (req, res) => {
  const { nombre } = req.body;
  // Snapshot completo.
  // Nota: este respaldo NO incluye balanzas/Anexo IVA/catálogos (van cifrados
  // y por separado en la carpeta data/, ver README de la carpeta data/).
  const datos = {
    empresas: listEmpresas(),
    anexo_config: listAnexoConfigRaw(),
    amarres: listAllAmarres(),
    datos_fiscales: listAllDatosFiscales(),
    ajuste_inflacion: db.prepare("SELECT * FROM ajuste_inflacion").all(),
    tarifas_isr: listTarifasIsrRaw(),
    ts: new Date().toISOString()
  };
  const info = createBackup(nombre || `Backup ${new Date().toLocaleDateString()}`, datos, req.user.id);
  purgeOldBackups(100);
  auditLog(req.user.id, req.user.username, "CREATE_BACKUP", { nombre }, req.ip);
  res.json({ id: info.lastInsertRowid });
});

router.post("/:id/restore-empresa", auth("admin"), (req, res) => {
  const row = getBackup(req.params.id);
  if (!row) return res.status(404).json({ error: "Backup no encontrado" });
  let datos;
  try { datos = JSON.parse(row.datos); } catch (_) { return res.status(400).json({ error: "Backup inválido" }); }
  const empresas = datos.empresas || [];
  if (empresas.length !== 1 || !datos.empresa_id) {
    return res.status(400).json({ error: "Este respaldo no es un respaldo automático de una sola empresa." });
  }
  const e = empresas[0];
  restoreEmpresaFromBackup(e, datos.amarres, datos.datos_fiscales, datos.ajuste_inflacion || []);
  auditLog(req.user.id, req.user.username, "RESTORE_EMPRESA_BACKUP", { backup: req.params.id, empresa: e.id }, req.ip);
  res.json({ ok: true, empresa_id: e.id });
});

router.post("/:id/restore", auth("admin"), (req, res) => {
  const row = getBackup(req.params.id);
  if (!row) return res.status(404).json({ error: "Backup no encontrado" });
  const datos = JSON.parse(row.datos);
  restoreFullFromBackup(datos);
  auditLog(req.user.id, req.user.username, "RESTORE_BACKUP", { id: req.params.id }, req.ip);
  res.json({ ok: true });
});

router.get("/:id/export", auth("admin"), (req, res) => {
  const row = getBackupExport(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  res.setHeader("Content-Disposition", `attachment; filename="${row.nombre}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.send(row.datos);
});

router.post("/import", auth("admin"), (req, res) => {
  const { nombre, datos } = req.body;
  const info = createBackup(nombre || "Importado", datos, req.user.id);
  auditLog(req.user.id, req.user.username, "IMPORT_BACKUP", { nombre }, req.ip);
  res.json({ id: info.lastInsertRowid });
});

export default router;
