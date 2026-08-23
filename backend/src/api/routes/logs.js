import { Router } from "express";
import { auth } from "../../core/auth.js";
import { listRecentAuditLog } from "../../models/auditModel.js";

const router = Router();

router.get("/", auth("admin"), (req, res) => {
  res.json(listRecentAuditLog(500));
});

export default router;
