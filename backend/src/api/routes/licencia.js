import { Router } from "express";
import { auth } from "../../core/auth.js";
import { auditLog } from "../../core/auditLog.js";
import { obtenerStatusLicencia, validarClaveLicencia, activar } from "../../core/licenciaService.js";

const router = Router();

router.get("/status", auth("viewer"), (req, res) => {
  res.json(obtenerStatusLicencia());
});

router.post("/activar", auth("admin"), (req, res) => {
  const { clave } = req.body;
  if (!validarClaveLicencia(clave)) {
    auditLog(req.user.id, req.user.username, "LICENCIA_CLAVE_INVALIDA", {}, req.ip);
    return res.status(400).json({ error: "Clave de licencia incorrecta" });
  }
  const expira = activar(clave);
  auditLog(req.user.id, req.user.username, "LICENCIA_ACTIVADA", { expira }, req.ip);
  res.json({ ok: true, expira });
});

export default router;
