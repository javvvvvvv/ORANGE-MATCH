import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { findSessionUser } from "../models/usersModel.js";

export function isUserExpired(expires_at) {
  if (!expires_at) return false;
  // Acepta "YYYY-MM-DD" o ISO completo
  const exp = new Date(expires_at.length === 10 ? expires_at + "T23:59:59" : expires_at);
  return exp < new Date();
}

export function auth(requiredRole = "viewer") {
  const roles = { viewer: 0, editor: 1, admin: 2 };
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Sin token" });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      // Verificar estado actual en la base de datos (activo + no vencido)
      const dbUser = findSessionUser(payload.id);
      if (!dbUser || !dbUser.active) {
        return res.status(403).json({ error: "Usuario inactivo" });
      }
      if (isUserExpired(dbUser.expires_at)) {
        return res.status(403).json({ error: "Suscripción vencida" });
      }
      if (roles[dbUser.role] < roles[requiredRole])
        return res.status(403).json({ error: "Sin permisos" });
      req.user = {
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        active: dbUser.active,
        expires_at: dbUser.expires_at
      };
      next();
    } catch {
      res.status(401).json({ error: "Token inválido o expirado" });
    }
  };
}
