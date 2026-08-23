import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../config/env.js";
import { auth, isUserExpired } from "../../core/auth.js";
import { auditLog } from "../../core/auditLog.js";
import { findByUsername, findById, updatePassword } from "../../models/usersModel.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Espera 15 minutos." }
});

router.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const user = findByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    auditLog(null, username, "LOGIN_FAIL", { username }, req.ip);
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  if (isUserExpired(user.expires_at)) {
    auditLog(user.id, user.username, "LOGIN_FAIL_EXPIRED", {}, req.ip);
    return res.status(403).json({ error: "Suscripción vencida. Contacta al administrador." });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, active: user.active, expires_at: user.expires_at },
    JWT_SECRET, { expiresIn: "8h" }
  );
  auditLog(user.id, user.username, "LOGIN_OK", {}, req.ip);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, expires_at: user.expires_at }
  });
});

router.post("/change-password", auth("viewer"), (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ error: "Contraseña mínimo 8 caracteres" });
  const user = findById(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password))
    return res.status(401).json({ error: "Contraseña actual incorrecta" });
  updatePassword(req.user.id, bcrypt.hashSync(newPassword, 12));
  auditLog(req.user.id, req.user.username, "CHANGE_PASSWORD", {}, req.ip);
  res.json({ ok: true });
});

export default router;
