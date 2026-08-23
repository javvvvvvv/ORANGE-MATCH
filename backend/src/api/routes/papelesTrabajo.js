import { Router } from "express";
import { auth } from "../../core/auth.js";
import { auditLog } from "../../core/auditLog.js";
import { protegerConfigPTAntesDeImportar } from "../../core/backupService.js";
import {
  leerBalanza, guardarBalanza, leerAnexoIva, guardarAnexoIva,
  leerIsrManual, guardarIsrManual, eliminarIsrManual
} from "../../models/empresasModel.js";
import { listAmarres, upsertAmarre } from "../../models/amarresModel.js";
import { listDatosFiscales, upsertDatosFiscales, deleteDatosFiscales } from "../../models/datosFiscalesModel.js";
import { getAjusteInflacion, saveAjusteInflacion } from "../../models/ajusteInflacionModel.js";
import { validarEmpresaId, validarPeriodo, validarAnio, validarBalanza, validarObjetoDatos, validarBoolean } from "../validation/papelesTrabajo.js";

const router = Router({ mergeParams: true });

// ── BALANZA MENSUAL (cifrada en disco, por periodo) ──
router.get("/balanza", auth("viewer"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const periodo = validarPeriodo(req.query.periodo);
    res.json({ balanza: leerBalanza(empresaId, periodo) || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/balanza", auth("editor"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const periodo = validarPeriodo(req.body?.periodo);
    const balanza = validarBalanza(req.body?.balanza);
    const backupId = protegerConfigPTAntesDeImportar(empresaId, `Importación de balanza ${periodo}`, req);
    guardarBalanza(empresaId, periodo, balanza);
    auditLog(req.user.id, req.user.username, "GUARDAR_BALANZA", { empresa: empresaId, periodo, cuentas: balanza.length }, req.ip);
    res.json({ ok: true, backupId });
  } catch (error) {
    console.error("PUT /balanza error:", error);
    res.status(400).json({ error: error.message || "No fue posible guardar la balanza." });
  }
});

// ── ANEXO DE IVA (cifrado en disco, por periodo) ──
router.get("/anexo-iva", auth("viewer"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const periodo = validarPeriodo(req.query.periodo);
    res.json({ datos: leerAnexoIva(empresaId, periodo) || {} });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/anexo-iva", auth("editor"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const periodo = validarPeriodo(req.body?.periodo);
    const datos = validarObjetoDatos(req.body?.datos, 100);
    const backupId = protegerConfigPTAntesDeImportar(empresaId, `Importación de Anexo IVA ${periodo}`, req);
    guardarAnexoIva(empresaId, periodo, datos);
    auditLog(req.user.id, req.user.username, "GUARDAR_ANEXO_IVA", { empresa: empresaId, periodo }, req.ip);
    res.json({ ok: true, backupId });
  } catch (error) {
    console.error("PUT /anexo-iva error:", error);
    res.status(400).json({ error: error.message || "No fue posible guardar el Anexo IVA." });
  }
});

// ── ISR — captura manual de meses anteriores (cifrada en disco, mismo patrón
// que el Anexo de IVA manual) ──
router.get("/isr-manual", auth("viewer"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const periodo = validarPeriodo(req.query.periodo);
    res.json({ datos: leerIsrManual(empresaId, periodo) || null });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/isr-manual", auth("editor"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const periodo = validarPeriodo(req.body?.periodo);
    const datos = validarObjetoDatos(req.body?.datos, 100);
    guardarIsrManual(empresaId, periodo, datos);
    auditLog(req.user.id, req.user.username, "GUARDAR_ISR_MANUAL", { empresa: empresaId, periodo }, req.ip);
    res.json({ ok: true });
  } catch (error) {
    console.error("PUT /isr-manual error:", error);
    res.status(400).json({ error: error.message || "No fue posible guardar ISR manual." });
  }
});

router.delete("/isr-manual/:periodo", auth("editor"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const periodo = validarPeriodo(req.params.periodo);
    eliminarIsrManual(empresaId, periodo);
    auditLog(req.user.id, req.user.username, "ELIMINAR_ISR_MANUAL", { empresa: empresaId, periodo }, req.ip);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── AMARRES (validación mensual) ──
router.get("/amarres", auth("viewer"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const rows = listAmarres(empresaId);
    res.json({ amarres: rows.map(r => ({ ...r, validado: !!r.validado })) });
  } catch (error) {
    console.error("GET /amarres error:", error);
    res.status(400).json({ error: error.message || "No fue posible consultar los amarres." });
  }
});

router.put("/amarres", auth("editor"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const periodo = validarPeriodo(req.body?.periodo);
    const validado = validarBoolean(req.body?.validado);
    const fecha = validado ? new Date().toISOString() : null;
    upsertAmarre(empresaId, periodo, validado, fecha);
    auditLog(req.user.id, req.user.username, "TOGGLE_AMARRE", { empresa: empresaId, periodo, validado }, req.ip);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// ── AJUSTE ANUAL POR INFLACIÓN (Art. 44 LISR) ──
router.get("/ajuste-inflacion", auth("viewer"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const anio = validarAnio(req.query.anio);
    res.json({ datos: getAjusteInflacion(empresaId, anio) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/ajuste-inflacion", auth("editor"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const anio = validarAnio(req.body?.anio);
    const datosEntrada = validarObjetoDatos(req.body, 100);
    const datos = saveAjusteInflacion(empresaId, anio, datosEntrada);
    auditLog(req.user.id, req.user.username, "GUARDAR_AJUSTE_INFLACION", { empresa: empresaId, anio }, req.ip);
    res.json({ ok: true, datos });
  } catch (error) {
    console.error("PUT /ajuste-inflacion error:", error);
    res.status(400).json({ error: error.message || "No fue posible guardar el ajuste." });
  }
});

// ── DATOS FISCALES (por ejercicio) ──
router.get("/datos-fiscales", auth("viewer"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    res.json({ datos: listDatosFiscales(empresaId) });
  } catch (error) {
    console.error("GET /datos-fiscales error:", error);
    res.status(400).json({ error: error.message || "No fue posible consultar los datos fiscales." });
  }
});

router.put("/datos-fiscales", auth("editor"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const datos = validarObjetoDatos(req.body, 30);
    const anio = validarAnio(datos.anio);
    upsertDatosFiscales(empresaId, { ...datos, anio });
    auditLog(req.user.id, req.user.username, "GUARDAR_DATOS_FISCALES", { empresa: empresaId, anio }, req.ip);
    res.json({ ok: true });
  } catch (error) {
    console.error("PUT /datos-fiscales error:", error);
    res.status(400).json({ error: error.message || "No fue posible guardar los datos fiscales." });
  }
});

router.delete("/datos-fiscales/:anio", auth("editor"), (req, res) => {
  try {
    const empresaId = validarEmpresaId(req.params.id);
    const anio = validarAnio(req.params.anio);
    deleteDatosFiscales(empresaId, anio);
    auditLog(req.user.id, req.user.username, "ELIMINAR_DATOS_FISCALES", { empresa: empresaId, anio }, req.ip);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
