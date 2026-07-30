/**
 * Auditoría real controlada del Formulario 29.
 *
 * Objetivo único: comprobar con evidencia si API Gateway entrega conceptos
 * tributarios estructurados (remanente, PPM, retenciones, IVA determinado,
 * total) o si su JSON solo trae identificación, estado e historial.
 *
 * Reglas duras de esta auditoría:
 * - Máximo DOS solicitudes reales, sin reintentos automáticos.
 * - Si la primera falla, la segunda no se ejecuta.
 * - No se consulta RCV, ni PDF, ni otros periodos.
 * - No se modifica el motor tributario ni se sobrescriben antecedentes.
 * - La Clave Tributaria vive solo en memoria: no se guarda, registra ni devuelve.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  RegistroConsumo,
  requestApiGateway,
  type ApiGatewayCallLog,
} from "@/integrations/sii/apiGatewayClient";
import { recursoDe } from "@/integrations/sii/apiGatewayResourceMap";
import { construirCuerpoAuth } from "@/integrations/sii/apiGatewaySiiProviderAdapter";
import { SiiProviderError } from "@/integrations/sii/contracts";
import { sanitizarProfundo } from "@/integrations/sii/sanitize";
import {
  analizarPayload,
  enmascararFolio,
  propiedadesDescartadas,
  type AnalisisPayload,
} from "@/integrations/sii/f29RawAnalysis";
import { esRutValido, normalizarRut } from "@/lib/rut";
import {
  empresaAutorizadaParaPruebaReal,
  leerConfiguracion,
  modoPruebaRealHabilitado,
} from "@/lib/apiGateway.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";

/** Máximo absoluto de solicitudes reales de esta auditoría. */
export const MAX_CONSULTAS_AUDITORIA = 2;

/** Propiedades que el adaptador actual sí conserva del listado F29. */
const PROPIEDADES_USADAS_LISTADO = ["periodo", "folio", "fecha", "estado"];

export type ClasificacionConcepto =
  | "estructurado_listado"
  | "estructurado_detalle"
  | "otro_nombre"
  | "nulo"
  | "ausente"
  | "descartado_por_adaptador";

export interface ConceptoAuditado {
  concepto: string;
  clasificacion: ClasificacionConcepto;
  etiqueta: string;
  evidencia: string;
}

export interface ConsultaAuditada {
  orden: 1 | 2;
  titulo: string;
  recurso: string;
  ejecutada: boolean;
  estadoHttp: number | null;
  contentType: string | null;
  referenciaTecnica: string | null;
  creditosUsados: number | null;
  creditosDisponibles: number | null;
  duracionMs: number | null;
  errorCodigo: string | null;
  mensaje: string;
  analisis: AnalisisPayload | null;
  /** Propiedades presentes en el crudo que el modelo normalizado no conserva. */
  propiedadesDescartadas: string[];
  /** Campos del contrato interno tras normalizar. */
  normalizado: Record<string, unknown> | null;
}

export interface ResultadoAuditoriaF29 {
  periodo: string;
  consultasEjecutadas: number;
  creditosAntes: number | null;
  creditosDespues: number | null;
  creditosConsumidos: number;
  folioEnmascarado: string | null;
  folioPreservado: boolean;
  consultas: ConsultaAuditada[];
  conceptos: ConceptoAuditado[];
  conclusion:
    | "campos_estructurados_descartados"
    | "campos_adicionales_no_documentados"
    | "solo_identificacion_estado_historial"
    | "insuficiente";
  conclusionTexto: string;
  detenidaEn: string | null;
}

export interface EntradaAuditoriaF29 {
  companyId: string;
  periodo: string;
  rutUsuario: string;
  claveTributaria: string;
  consentimiento: boolean;
}

const ETIQUETA_CLASIFICACION: Record<ClasificacionConcepto, string> = {
  estructurado_listado: "Llegó estructurado en el listado",
  estructurado_detalle: "Llegó estructurado en el detalle",
  otro_nombre: "Llegó con otro nombre",
  nulo: "Llegó nulo",
  ausente: "No llegó",
  descartado_por_adaptador: "Llegó, pero el adaptador lo descartaba",
};

/** Conceptos evaluados y los términos con los que se buscan en el crudo. */
const CONCEPTOS: { concepto: string; terminos: string[] }[] = [
  { concepto: "Remanente anterior", terminos: ["remanente", "504"] },
  { concepto: "Nuevo remanente", terminos: ["remanente", "77"] },
  { concepto: "Base PPM", terminos: ["base", "563"] },
  { concepto: "Tasa PPM", terminos: ["tasa", "115"] },
  { concepto: "PPM determinado", terminos: ["ppm", "62"] },
  { concepto: "Retenciones", terminos: ["retencion"] },
  { concepto: "IVA determinado", terminos: ["iva", "89"] },
  { concepto: "Total determinado", terminos: ["total", "91"] },
  { concepto: "Total a pagar", terminos: ["total", "91"] },
  { concepto: "Códigos o líneas del formulario", terminos: ["codigo"] },
];

async function exigirAuditoriaPermitida(userId: string, companyId: string) {
  await exigirRol(userId, companyId, ["owner"]);
  if (!modoPruebaRealHabilitado())
    throw new ErrorNegocio("La prueba con el proveedor real no está habilitada en este ambiente.");
  if (!empresaAutorizadaParaPruebaReal(companyId))
    throw new ErrorNegocio("Esta empresa no está autorizada para la prueba con el proveedor real.");
  const { config } = leerConfiguracion();
  if (!config)
    throw new ErrorNegocio("Falta configurar el servicio del proveedor real en el backend.");
  return config;
}

/**
 * Guarda el respaldo del proveedor. `variante` distingue el crudo sanitizado
 * del resultado ya normalizado, para poder compararlos después sin consultar
 * de nuevo. Nunca se guardan claves, tokens ni cabeceras privadas.
 */
async function guardarSnapshot(entrada: {
  companyId: string;
  periodId: string | null;
  modulo: "f29_periods" | "f29_detail";
  variante: "raw" | "normalized";
  folio: string | null;
  payload: unknown;
}) {
  const ahora = new Date().toISOString();
  await supabaseAdmin.from("tax_provider_snapshots").insert({
    company_id: entrada.companyId,
    tax_period_id: entrada.periodId,
    provider: "api_gateway",
    module: entrada.modulo,
    // El crudo se guarda tal cual llegó, salvo la sanitización de secretos.
    payload: sanitizarProfundo({
      variante: entrada.variante,
      folio: entrada.folio,
      contenido: entrada.payload,
    }) as never,
    provider_reference: `auditoria_f29:${entrada.variante}`,
    received_at: ahora,
    normalized_at: entrada.variante === "normalized" ? ahora : null,
  });
}

function desdeLog(log: ApiGatewayCallLog | null) {
  return {
    estadoHttp: log?.estadoHttp ?? null,
    contentType: log?.contentType ?? null,
    referenciaTecnica: log?.referenciaTecnica ?? null,
    creditosUsados: log?.creditosUsados ?? null,
    creditosDisponibles: log?.creditosDisponibles ?? null,
    duracionMs: log?.duracionMs ?? null,
  };
}

/** Extrae el folio del listado sin exponerlo. */
function extraerFolio(items: unknown[], periodo: string): string | null {
  const compacto = periodo.replace("-", "");
  const candidatos = items.filter((i) => i && typeof i === "object") as Record<string, unknown>[];
  const delPeriodo =
    candidatos.find((i) => String(i.periodo ?? "").replace("-", "") === compacto) ?? candidatos[0];
  const folio = delPeriodo?.folio;
  return folio == null || folio === "" ? null : String(folio);
}

function clasificar(
  terminos: string[],
  listado: AnalisisPayload | null,
  detalle: AnalisisPayload | null,
): { clasificacion: ClasificacionConcepto; evidencia: string } {
  const buscar = (a: AnalisisPayload | null) =>
    (a?.coincidencias ?? []).filter(
      (c) => c.origen === "llave" && terminos.includes(c.termino),
    );

  const enListado = buscar(listado);
  const enDetalle = buscar(detalle);
  const usado = (ruta: string) =>
    PROPIEDADES_USADAS_LISTADO.some((p) => ruta.toLowerCase().endsWith(p));

  const evaluar = (
    coincidencias: ReturnType<typeof buscar>,
    origen: "estructurado_listado" | "estructurado_detalle",
  ): { clasificacion: ClasificacionConcepto; evidencia: string } | null => {
    if (!coincidencias.length) return null;
    const conValor = coincidencias.filter((c) => c.tipoValor !== "null");
    if (!conValor.length)
      return {
        clasificacion: "nulo",
        evidencia: `Presente en ${coincidencias.map((c) => c.ruta).join(", ")} con valor nulo.`,
      };
    const descartado = conValor.filter((c) => !usado(c.ruta));
    if (descartado.length)
      return {
        clasificacion: "descartado_por_adaptador",
        evidencia: `Presente en ${descartado
          .map((c) => `${c.ruta}=${c.muestra}`)
          .join(", ")} y no conservado por el adaptador.`,
      };
    return {
      clasificacion: origen,
      evidencia: conValor.map((c) => `${c.ruta}=${c.muestra}`).join(", "),
    };
  };

  return (
    evaluar(enListado, "estructurado_listado") ??
    evaluar(enDetalle, "estructurado_detalle") ?? {
      clasificacion: "ausente",
      evidencia: "Ninguna propiedad del JSON crudo corresponde a este concepto.",
    }
  );
}

export async function auditarF29Real(
  userId: string,
  entrada: EntradaAuditoriaF29,
): Promise<ResultadoAuditoriaF29> {
  const config = await exigirAuditoriaPermitida(userId, entrada.companyId);
  if (!entrada.consentimiento)
    throw new ErrorNegocio("Necesitamos tu autorización expresa para continuar.");
  if (!/^\d{4}-\d{2}$/.test(entrada.periodo))
    throw new ErrorNegocio("El periodo debe tener el formato AAAA-MM.");

  const rutUsuario = normalizarRut(entrada.rutUsuario ?? "");
  if (!esRutValido(rutUsuario))
    throw new ErrorNegocio("El RUT del usuario autorizado no es válido.");
  if (!entrada.claveTributaria || entrada.claveTributaria.length < 4)
    throw new ErrorNegocio("La clave indicada no es válida.");

  const { data: periodoFila } = await supabaseAdmin
    .from("tax_periods")
    .select("id")
    .eq("company_id", entrada.companyId)
    .eq("period", entrada.periodo)
    .maybeSingle();
  const periodId = periodoFila ? String(periodoFila.id) : null;

  const registro = new RegistroConsumo(MAX_CONSULTAS_AUDITORIA);
  const cuerpo = construirCuerpoAuth(rutUsuario, entrada.claveTributaria);

  const consultas: ConsultaAuditada[] = [];
  let creditosAntes: number | null = null;
  let analisisListado: AnalisisPayload | null = null;
  let analisisDetalle: AnalisisPayload | null = null;
  let folio: string | null = null;
  let detenidaEn: string | null = null;

  // ---------- CONSULTA 1: listado de declaraciones del periodo ----------
  const recursoListado = recursoDe("f29_periods").path.replace("{periodo}", entrada.periodo);
  try {
    const { datos, log } = await requestApiGateway<typeof cuerpo, unknown>({
      config,
      modulo: "f29_periods",
      metodo: "POST",
      ruta: recursoListado,
      body: cuerpo,
      registro,
      sinReintentos: true,
    });
    creditosAntes =
      log.creditosDisponibles != null && log.creditosUsados != null
        ? log.creditosDisponibles + log.creditosUsados
        : null;

    const crudo = sanitizarProfundo(datos);
    analisisListado = analizarPayload(crudo);
    folio = extraerFolio(
      Array.isArray(crudo)
        ? crudo
        : ((crudo as { data?: unknown })?.data as unknown[]) ?? [],
      entrada.periodo,
    );

    const normalizado = {
      period: entrada.periodo,
      folioPresente: folio != null,
      status: null,
      declaredVat: null,
      declaredPpm: null,
      declaredWithholdings: null,
      declaredTotal: null,
      vatCarryforward: null,
    };

    await guardarSnapshot({
      companyId: entrada.companyId,
      periodId,
      modulo: "f29_periods",
      variante: "raw",
      folio,
      payload: crudo,
    });
    await guardarSnapshot({
      companyId: entrada.companyId,
      periodId,
      modulo: "f29_periods",
      variante: "normalized",
      folio,
      payload: normalizado,
    });

    consultas.push({
      orden: 1,
      titulo: "Listado de declaraciones F29",
      recurso: recursoListado,
      ejecutada: true,
      ...desdeLog(log),
      errorCodigo: null,
      mensaje: "Respuesta recibida y respaldada.",
      analisis: analisisListado,
      propiedadesDescartadas: propiedadesDescartadas(
        analisisListado.propiedadesPrimerElemento,
        PROPIEDADES_USADAS_LISTADO,
      ),
      normalizado,
    });
  } catch (error) {
    const codigo = error instanceof SiiProviderError ? error.code : "INTERNAL";
    detenidaEn = "consulta_1";
    consultas.push({
      orden: 1,
      titulo: "Listado de declaraciones F29",
      recurso: recursoListado,
      ejecutada: true,
      ...desdeLog(registro.llamadas.at(-1) ?? null),
      errorCodigo: codigo,
      mensaje: "La primera consulta falló: la segunda no se ejecutó.",
      analisis: null,
      propiedadesDescartadas: [],
      normalizado: null,
    });
  }

  // ---------- CONSULTA 2: detalle de la declaración ----------
  const recursoDetalle = recursoDe("f29_detail").path;
  if (!detenidaEn && folio) {
    const ruta = recursoDetalle.replace("{folio}", folio);
    try {
      const { datos, log } = await requestApiGateway<typeof cuerpo, unknown>({
        config,
        modulo: "f29_detail",
        metodo: "POST",
        ruta,
        body: cuerpo,
        registro,
        sinReintentos: true,
      });
      const crudo = sanitizarProfundo(datos);
      analisisDetalle = analizarPayload(crudo);

      const normalizado = {
        folioPresente: true,
        estadoLeido: true,
        historialLeido: analisisDetalle.rutas.some((r) => /histor/i.test(r)),
        conceptosTributariosLeidos: false,
      };

      await guardarSnapshot({
        companyId: entrada.companyId,
        periodId,
        modulo: "f29_detail",
        variante: "raw",
        folio,
        payload: crudo,
      });
      await guardarSnapshot({
        companyId: entrada.companyId,
        periodId,
        modulo: "f29_detail",
        variante: "normalized",
        folio,
        payload: normalizado,
      });

      consultas.push({
        orden: 2,
        titulo: "Detalle de la declaración F29",
        recurso: recursoDetalle,
        ejecutada: true,
        ...desdeLog(log),
        errorCodigo: null,
        mensaje: "Respuesta recibida y respaldada.",
        analisis: analisisDetalle,
        // El adaptador actual no lee este recurso: todo lo recibido se descarta.
        propiedadesDescartadas: analisisDetalle.propiedadesPrimerElemento.length
          ? analisisDetalle.propiedadesPrimerElemento
          : analisisDetalle.clavesSuperiores,
        normalizado,
      });
    } catch (error) {
      const codigo = error instanceof SiiProviderError ? error.code : "INTERNAL";
      detenidaEn = "consulta_2";
      consultas.push({
        orden: 2,
        titulo: "Detalle de la declaración F29",
        recurso: recursoDetalle,
        ejecutada: true,
        ...desdeLog(registro.llamadas.at(-1) ?? null),
        errorCodigo: codigo,
        mensaje: "El detalle no pudo leerse.",
        analisis: null,
        propiedadesDescartadas: [],
        normalizado: null,
      });
    }
  } else if (!detenidaEn) {
    consultas.push({
      orden: 2,
      titulo: "Detalle de la declaración F29",
      recurso: recursoDetalle,
      ejecutada: false,
      estadoHttp: null,
      contentType: null,
      referenciaTecnica: null,
      creditosUsados: null,
      creditosDisponibles: null,
      duracionMs: null,
      errorCodigo: null,
      mensaje: "El listado no entregó un folio: no se ejecutó una segunda consulta.",
      analisis: null,
      propiedadesDescartadas: [],
      normalizado: null,
    });
  }

  const conceptos: ConceptoAuditado[] = CONCEPTOS.map((c) => {
    const r = clasificar(c.terminos, analisisListado, analisisDetalle);
    return {
      concepto: c.concepto,
      clasificacion: r.clasificacion,
      etiqueta: ETIQUETA_CLASIFICACION[r.clasificacion],
      evidencia: r.evidencia,
    };
  });

  const huboRespuesta = Boolean(analisisListado || analisisDetalle);
  const descartadosReales = conceptos.some(
    (c) => c.clasificacion === "descartado_por_adaptador",
  );
  const estructurados = conceptos.some(
    (c) =>
      c.clasificacion === "estructurado_listado" || c.clasificacion === "estructurado_detalle",
  );

  const conclusion: ResultadoAuditoriaF29["conclusion"] = !huboRespuesta
    ? "insuficiente"
    : descartadosReales
      ? "campos_estructurados_descartados"
      : estructurados
        ? "campos_adicionales_no_documentados"
        : "solo_identificacion_estado_historial";

  const conclusionTexto = {
    campos_estructurados_descartados:
      "API Gateway entrega campos estructurados y Lovable los descartaba.",
    campos_adicionales_no_documentados:
      "API Gateway entrega algunos campos adicionales no documentados.",
    solo_identificacion_estado_historial:
      "El JSON solo entrega identificación, estado e historial.",
    insuficiente: "La respuesta sigue siendo insuficiente para concluir.",
  }[conclusion];

  const creditosConsumidos = Number(registro.creditosUsados.toFixed(4));

  await registrarActividad(
    entrada.companyId,
    userId,
    "sii.f29_audit",
    "tax_provider_snapshots",
    {
      periodo: entrada.periodo,
      consultas: registro.consultas,
      creditos: creditosConsumidos,
      conclusion,
    },
  );

  return {
    periodo: entrada.periodo,
    consultasEjecutadas: registro.consultas,
    creditosAntes,
    creditosDespues: registro.creditosDisponibles,
    creditosConsumidos,
    folioEnmascarado: folio ? enmascararFolio(folio) : null,
    folioPreservado: Boolean(folio),
    consultas,
    conceptos,
    conclusion,
    conclusionTexto,
    detenidaEn,
  };
}
