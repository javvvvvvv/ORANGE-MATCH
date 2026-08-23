import { Router } from "express";
import { db } from "../../models/db.js";
import { auth } from "../../core/auth.js";
import { auditLog } from "../../core/auditLog.js";
import { protegerConfigPTAntesDeImportar } from "../../core/backupService.js";
import { getAnexoConfig, saveAnexoConfig } from "../../models/anexoConfigModel.js";

const router = Router();

router.get("/", auth("viewer"), (req, res) => {
  const row = getAnexoConfig();
  res.json(row ? JSON.parse(row.config) : {});
});

router.put("/", auth("editor"), (req, res) => {
  // Es configuración global que interviene en el amarre de IVA. Antes de
  // cambiarla, protege las configuraciones de todas las empresas.
  db.prepare("SELECT id FROM empresas").all().forEach(e => {
    try { protegerConfigPTAntesDeImportar(e.id, "Cambio de configuración global de Anexo IVA", req); } catch (_) {}
  });
  saveAnexoConfig(req.body);
  auditLog(req.user.id, req.user.username, "UPDATE_ANEXO_CONFIG", {}, req.ip);
  res.json({ ok: true });
});

export default router;
