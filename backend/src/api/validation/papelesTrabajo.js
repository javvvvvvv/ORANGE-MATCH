/* ============================================================================
   PROPIEDAD INTELECTUAL Y LICENCIA COMERCIAL CERRADA
   ============================================================================
   Autor Legal y Titular de Derechos: JAVIER ILLAN GONZALEZ
   Organización: ORANGE CREW
   Contacto: ILLANJAVIER9@GMAIL.COM

   ADVERTENCIA LEGAL (MÉXICO Y GLOBAL):
   Este código fuente y su arquitectura son propiedad intelectual exclusiva de
   JAVIER ILLAN GONZALEZ. Queda estrictamente prohibida su reproducción,
   distribución, modificación, ingeniería inversa, copia o uso comercial sin la
   autorización expresa y por escrito del autor. Obra protegida conforme a la
   Ley Federal del Derecho de Autor y tratados internacionales aplicables.
   ============================================================================ */

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const EMPRESA_ID_RE = /^\d+$/;

export function validarEmpresaId(value) {
  const id = String(value ?? '').trim();
  if (!EMPRESA_ID_RE.test(id) || Number(id) <= 0) throw new Error('Empresa inválida.');
  return Number(id);
}

export function validarPeriodo(value) {
  const periodo = String(value ?? '').trim();
  if (!PERIODO_RE.test(periodo)) throw new Error('Periodo inválido. Usa YYYY-MM.');
  return periodo;
}

export function validarAnio(value) {
  const anio = Number(value);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new Error('Ejercicio inválido.');
  return anio;
}

export function validarBalanza(value) {
  if (!Array.isArray(value) || value.length > 100000) throw new Error('La balanza debe ser un arreglo válido.');
  return value.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Fila de balanza inválida: ${index + 1}.`);
    const cuenta = String(row.cuenta ?? row.codigo ?? '').trim();
    if (!cuenta || cuenta.length > 100) throw new Error(`Cuenta inválida en fila ${index + 1}.`);
    return { ...row, cuenta };
  });
}

export function validarObjetoDatos(value, maxKeys = 200) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Los datos deben ser un objeto.');
  if (Object.keys(value).length > maxKeys) throw new Error('Los datos contienen demasiados campos.');
  return value;
}

export function validarBoolean(value) {
  if (typeof value !== 'boolean') throw new Error('El valor de validación debe ser booleano.');
  return value;
}
