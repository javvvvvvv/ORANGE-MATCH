import { db } from "./db.js";

export function getTarifasIsr() {
  return db.prepare("SELECT config FROM tarifas_isr WHERE id=1").get();
}

export function saveTarifasIsr(config) {
  const existing = db.prepare("SELECT id FROM tarifas_isr WHERE id=1").get();
  if (existing) db.prepare("UPDATE tarifas_isr SET config=? WHERE id=1").run(JSON.stringify(config));
  else db.prepare("INSERT INTO tarifas_isr (id,config) VALUES (1,?)").run(JSON.stringify(config));
}

export function listTarifasIsrRaw() {
  return db.prepare("SELECT * FROM tarifas_isr").all();
}

export function upsertTarifasIsrRaw(row) {
  db.prepare("INSERT OR REPLACE INTO tarifas_isr (id,config) VALUES (1,?)").run(row.config);
}
