import { insertAuditLog } from "../models/auditModel.js";

export function auditLog(userId, username, action, detail, ip) {
  insertAuditLog(userId, username, action, detail, ip);
}
