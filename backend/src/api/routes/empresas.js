import { Router } from "express";
import { auth } from "../../core/auth.js";
import { auditLog } from "../../core/auditLog.js";
import { protegerConfigPTAntesDeImportar } from "../../core/backupService.js";
import {
  listEmpresas, empresaExists, getEmpresa, createEmpresa, updateEmpresaFields,
  deleteEmpresa, leerCatalogo, guardarCatalogo
} from "../../models/empresasModel.js";

const router = Router();

router.get("/", auth("viewer"), (req, res) => {
  try {
    const rows = listEmpresas();
    // NO cargar catálogos aquí: pueden pesar cientos de KB cada uno y sumar varios MB.
    // Eso provocaba error 500 / timeouts. El catálogo se pide solo cuando se necesita
    // (importación, papeles de trabajo, etc.) vía ruta dedicada o al abrir la empresa.
    // Si el cliente pide ?conCatalogo=1 se incluyen (compatibilidad).
    const conCatalogo = req.query.conCatalogo === "1";
    const out = rows.map(e => {
      const base = { ...e, catalogo_cuentas: null };
      if (!conCatalogo) return base;
      try {
        const cat = leerCatalogo(e.id);
        base.catalogo_cuentas = cat ? JSON.stringify(cat) : null;
      } catch (err) {
        console.error("Error leyendo catálogo empresa", e.id, err.message);
      }
      return base;
    });
    res.json(out);
  } catch (err) {
    console.error("GET /api/empresas error:", err);
    res.status(500).json({ error: "Error al listar empresas: " + (err.message || String(err)) });
  }
});

router.get("/:id/catalogo", auth("viewer"), (req, res) => {
  try {
    const cat = leerCatalogo(req.params.id);
    res.json({ catalogo: cat || [] });
  } catch (err) {
    console.error("GET catalogo error:", err);
    res.status(500).json({ error: err.message || "Error leyendo catálogo" });
  }
});

router.post("/", auth("editor"), (req, res) => {
  const { nombre, rfc } = req.body;
  const info = createEmpresa(nombre, rfc);
  auditLog(req.user.id, req.user.username, "CREATE_EMPRESA", { nombre }, req.ip);
  res.json({ id: info.lastInsertRowid });
});

router.put("/:id", auth("editor"), (req, res) => {
  const id = req.params.id;
  if (!empresaExists(id)) return res.status(404).json({ error: "Empresa no encontrada" });

  const { nombre, rfc, config_iva, config_pt, catalogo_cuentas, actualizar_config_pt } = req.body;
  const esImportacionCatalogo = catalogo_cuentas !== undefined;
  const esCambioConfigPT = actualizar_config_pt === true;
  // Si una operación puede tocar datos de configuración, crea primero un snapshot
  // de la empresa. Esto permite recuperar reglas aunque el cliente mande un
  // objeto viejo o una configuración accidentalmente vacía.
  if (esImportacionCatalogo) protegerConfigPTAntesDeImportar(id, "Importación de catálogo", req);
  if (esCambioConfigPT) {
    const actualRow = getEmpresa(id);
    const incoming = config_pt;
    const incomingVacio = incoming === null || incoming === undefined || incoming === '' || (typeof incoming === 'string' && incoming.trim() === 'null');
    const actualTiene = actualRow?.config_pt && String(actualRow.config_pt).trim() && String(actualRow.config_pt).trim() !== 'null';
    if (actualTiene && incomingVacio && req.body.confirmar_borrado_config_pt !== true) {
      return res.status(409).json({ error: "Protección activada: las reglas de amarre existentes no pueden borrarse accidentalmente. Para borrarlas explícitamente envía confirmar_borrado_config_pt=true." });
    }
  }
  // Solo se actualizan las columnas cuya llave realmente vino en el body —
  // así un guardado parcial (p.ej. solo config_pt) nunca borra lo demás.
  const sets = []; const vals = [];
  if (nombre !== undefined) { sets.push("nombre=?"); vals.push(nombre); }
  if (rfc !== undefined) { sets.push("rfc=?"); vals.push(rfc); }
  if (config_iva !== undefined) {
    // Evitar multi-codificado: si ya viene string JSON, guardarlo tal cual;
    // si viene objeto, stringify una sola vez.
    let ivaVal = null;
    if (config_iva) {
      if (typeof config_iva === "string") {
        try { JSON.parse(config_iva); ivaVal = config_iva; }
        catch (_) { ivaVal = JSON.stringify(config_iva); }
      } else {
        ivaVal = JSON.stringify(config_iva);
      }
    }
    sets.push("config_iva=?"); vals.push(ivaVal);
  }
  // `config_pt` contiene las reglas críticas de amarre. Por seguridad NO se
  // acepta un valor que llegue accidentalmente en un PUT genérico de empresa
  // (por ejemplo por un `{...empresa}` viejo en el frontend). Solo se modifica
  // cuando el llamador lo solicita explícitamente.
  if (actualizar_config_pt === true && config_pt !== undefined) {
    sets.push("config_pt=?");
    vals.push(typeof config_pt === "string" ? config_pt : JSON.stringify(config_pt));
  }
  if (sets.length) {
    sets.push("updated_at=datetime('now')");
    updateEmpresaFields(id, sets, vals);
  }
  if (catalogo_cuentas !== undefined) {
    const cat = typeof catalogo_cuentas === "string" ? JSON.parse(catalogo_cuentas) : catalogo_cuentas;
    // Aviso simple de códigos de cuenta duplicados en el catálogo importado
    const vistos = new Set(); const duplicados = new Set();
    (cat || []).forEach(c => { const k = String(c.codigo || "").trim(); if (!k) return; if (vistos.has(k)) duplicados.add(k); vistos.add(k); });
    guardarCatalogo(id, cat || []);
    if (duplicados.size) {
      return res.json({ ok: true, aviso: `Códigos de cuenta duplicados en el catálogo: ${[...duplicados].slice(0, 10).join(", ")}${duplicados.size > 10 ? "…" : ""}` });
    }
  }
  auditLog(req.user.id, req.user.username, "UPDATE_EMPRESA", { id, nombre }, req.ip);
  res.json({ ok: true });
});

router.delete("/:id", auth("admin"), (req, res) => {
  deleteEmpresa(req.params.id);
  auditLog(req.user.id, req.user.username, "DELETE_EMPRESA", { id: req.params.id }, req.ip);
  res.json({ ok: true });
});

export default router;
