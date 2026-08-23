import { db } from "./db.js";

export function findByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username=? AND active=1").get(username);
}

export function findById(id) {
  return db.prepare("SELECT * FROM users WHERE id=?").get(id);
}

export function findSessionUser(id) {
  return db.prepare("SELECT id, username, role, active, expires_at FROM users WHERE id=?").get(id);
}

export function listUsers() {
  return db.prepare("SELECT id,username,role,active,expires_at,created_at FROM users ORDER BY id").all();
}

export function createUser({ username, passwordHash, role, expiresAt }) {
  return db.prepare(
    "INSERT INTO users (username,password,role,expires_at) VALUES (?,?,?,?)"
  ).run(username, passwordHash, role, expiresAt);
}

export function updateRole(id, role) {
  db.prepare("UPDATE users SET role=? WHERE id=?").run(role, id);
}

export function updateActive(id, active) {
  db.prepare("UPDATE users SET active=? WHERE id=?").run(active ? 1 : 0, id);
}

export function updatePassword(id, passwordHash) {
  db.prepare("UPDATE users SET password=? WHERE id=?").run(passwordHash, id);
}

export function updateExpiresAt(id, expiresAt) {
  db.prepare("UPDATE users SET expires_at=? WHERE id=?").run(expiresAt, id);
}

export function deleteUser(id) {
  db.prepare("DELETE FROM users WHERE id=?").run(id);
}
