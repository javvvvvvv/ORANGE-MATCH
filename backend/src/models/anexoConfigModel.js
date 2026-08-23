import { db } from "./db.js";

export function getAnexoConfig() {
  return db.prepare("SELECT config FROM anexo_config WHERE id=1").get();
}

export function saveAnexoConfig(config) {
  const existing = db.prepare("SELECT id FROM anexo_config WHERE id=1").get();
  if (existing) db.prepare("UPDATE anexo_config SET config=? WHERE id=1").run(JSON.stringify(config));
  else db.prepare("INSERT INTO anexo_config (id,config) VALUES (1,?)").run(JSON.stringify(config));
}

export function listAnexoConfigRaw() {
  return db.prepare("SELECT * FROM anexo_config").all();
}

export function upsertAnexoConfigRaw(row) {
  db.prepare("INSERT OR REPLACE INTO anexo_config (id,config) VALUES (1,?)").run(row.config);
}

export function deleteAllAnexoConfig() {
  db.prepare("DELETE FROM anexo_config").run();
}
