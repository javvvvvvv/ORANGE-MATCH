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

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { networkInterfaces } from "os";

import { PORT, ALLOWED_ORIGINS, ROOT_DIR } from "./src/config/env.js";
import { checkLicencia } from "./src/core/licenciaService.js";
import { reconstruirIndiceEmpresas } from "./src/models/empresasModel.js";

import authRoutes from "./src/api/routes/auth.js";
import usersRoutes from "./src/api/routes/users.js";
import empresasRoutes from "./src/api/routes/empresas.js";
import papelesTrabajoRoutes from "./src/api/routes/papelesTrabajo.js";
import tarifasIsrRoutes from "./src/api/routes/tarifasIsr.js";
import anexoConfigRoutes from "./src/api/routes/anexoConfig.js";
import backupsRoutes from "./src/api/routes/backups.js";
import licenciaRoutes from "./src/api/routes/licencia.js";
import logsRoutes from "./src/api/routes/logs.js";

const app = express();

app.use(helmet({
  // Sin HTTPS todavía (Hamachi/red local): si se activa contentSecurityPolicy
  // con su configuración por defecto o strictTransportSecurity, el navegador
  // truena con ERR_SSL_PROTOCOL_ERROR. En cuanto haya HTTPS real (Oracle
  // Cloud + Caddy), se puede volver a activar sin problema.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  strictTransportSecurity: false
}));

// CORS: por defecto refleja cualquier origen (modo desarrollo/Hamachi). En
// cuanto publiques en una IP pública, define ALLOWED_ORIGINS en .env (lista
// separada por comas) para que SOLO esos orígenes puedan usar la API con
// credenciales.
app.use(cors({
  origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true,
  credentials: true
}));
app.use(express.json({ limit: "20mb" }));
app.use(morgan("tiny"));

// Rate limiting global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ── API ──────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/empresas", empresasRoutes);
app.use("/api/empresas/:id", papelesTrabajoRoutes);
app.use("/api/tarifas-isr", tarifasIsrRoutes);
app.use("/api/anexo-config", anexoConfigRoutes);
app.use("/api/backups", backupsRoutes);

// Verificar licencia en cada request de /api (excepto login, backups y la
// propia ruta de licencia — ver core/licenciaService.js)
app.use("/api", checkLicencia);

app.use("/api/licencia", licenciaRoutes);
app.use("/api/logs", logsRoutes);

// ── FRONTEND ─────────────────────────────────────────────────
// Sirve el build de producción del frontend (Vite) — ver ../frontend/dist
const FRONTEND_DIST = path.join(ROOT_DIR, "..", "frontend", "dist");
app.use(express.static(FRONTEND_DIST));
app.get("*", (_, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));

// ── START ────────────────────────────────────────────────────
reconstruirIndiceEmpresas();
app.listen(PORT, "0.0.0.0", () => {
  const nets = networkInterfaces();
  let localIP = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  console.log(`\n🍊 Orange Match corriendo`);
  console.log(`   Local:       http://localhost:${PORT}`);
  console.log(`   Red/Hamachi: http://${localIP}:${PORT}`);
  if (process.env.HAMACHI_IP) console.log(`   Hamachi:     http://${process.env.HAMACHI_IP}:${PORT}`);
  console.log("");
});
