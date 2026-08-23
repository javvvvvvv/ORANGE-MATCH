import { Router } from "express";
import bcrypt from "bcryptjs";
import { auth } from "../../core/auth.js";
import { auditLog } from "../../core/auditLog.js";
import {
  listUsers, createUser, updateRole, updateActive,
  updatePassword, updateExpiresAt, deleteUser
} from "../../models/usersModel.js";

const router = Router();
const ROLES_VALIDOS = ["admin", "editor", "viewer"];

router.get("/", auth("admin"), (req, res) => {
  res.json(listUsers());
});

router.post("/", auth("admin"), (req, res) => {
  const { username, password, role, expires_at } = req.body;
  if (!ROLES_VALIDOS.includes(role))
    return res.status(400).json({ error: "Rol inválido" });
  if (!password || password.length < 8)
    return res.status(400).json({ error: "Contraseña mínimo 8 caracteres" });
  try {
    const passwordHash = bcrypt.hashSync(password, 12);
    const exp = expires_at && expires_at.trim() ? expires_at.trim() : null;
    const info = createUser({ username, passwordHash, role, expiresAt: exp });
    auditLog(req.user.id, req.user.username, "CREATE_USER", { username, role, expires_at: exp }, req.ip);
    res.json({ id: info.lastInsertRowid });
  } catch { res.status(409).json({ error: "Usuario ya existe" }); }
});

router.patch("/:id", auth("admin"), (req, res) => {
  const { role, active, password, expires_at } = req.body;
  const id = req.params.id;
  if (role) {
    if (!ROLES_VALIDOS.includes(role))
      return res.status(400).json({ error: "Rol inválido" });
    updateRole(id, role);
  }
  if (active !== undefined) updateActive(id, active);
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: "Mínimo 8 caracteres" });
    updatePassword(id, bcrypt.hashSync(password, 12));
  }
  // expires_at: string vacío o null = sin vencimiento
  if (expires_at !== undefined) {
    const exp = expires_at && String(expires_at).trim() ? String(expires_at).trim() : null;
    updateExpiresAt(id, exp);
  }
  auditLog(req.user.id, req.user.username, "UPDATE_USER", { id, role, active, expires_at }, req.ip);
  res.json({ ok: true });
});

router.delete("/:id", auth("admin"), (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
  deleteUser(req.params.id);
  auditLog(req.user.id, req.user.username, "DELETE_USER", { id: req.params.id }, req.ip);
  res.json({ ok: true });
});

export default router;
