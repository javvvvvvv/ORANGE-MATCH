import { Router } from "express";
import { auth } from "../../core/auth.js";
import { auditLog } from "../../core/auditLog.js";
import { getTarifasIsr, saveTarifasIsr } from "../../models/tarifasIsrModel.js";

const router = Router();

router.get("/", auth("admin"), (req, res) => {
  const row = getTarifasIsr();
  res.json(row ? JSON.parse(row.config) : {});
});

router.put("/", auth("admin"), (req, res) => {
  saveTarifasIsr(req.body);
  auditLog(req.user.id, req.user.username, "UPDATE_TARIFAS_ISR", {}, req.ip);
  res.json({ ok: true });
});

export default router;
