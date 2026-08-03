import { auth, defineMcp } from "@lovable.dev/mcp-js";

import historialPeriodos from "./tools/historial-periodos";
import listarEmpresas from "./tools/listar-empresas";
import resumenMensual from "./tools/resumen-mensual";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "minegocio-al-dia",
  title: "MiNegocio Al Día",
  version: "0.1.0",
  instructions:
    "Herramientas de Mi Negocio al Día: consulta las empresas de la persona conectada, el resumen tributario estimado de un periodo y el historial de periodos. Todas las cifras son estimaciones informativas y no reemplazan a un contador.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarEmpresas, resumenMensual, historialPeriodos],
});
