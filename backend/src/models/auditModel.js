import { db } from "./db.js";

export function insertAuditLog(userId, username, action, detail, ip) {
  db.prepare("INSERT INTO audit_log (user_id,username,action,detail,ip) VALUES (?,?,?,?,?)")
    .run(userId, username, action, JSON.stringify(detail), ip);
}

export function listRecentAuditLog(limit = 500) {
  return db.prepare("SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?").all(limit);
}
