import { SectionCard } from "@/components/shared/SectionCard";
import { formatCLP } from "@/utils/currency";
import { ORIGEN_F29_CONTADOR } from "@/lib/f29Antecedent";
import type { DashboardData } from "@/types/tax";

type Evidencia = "documentos" | "rcv_resumen" | "f29" | "demo" | "calculo" | "usuario";

const ETIQUETA_EVIDENCIA: Record<Evidencia, { texto: string; clase: string }> = {
  documentos: {
    texto: "Documentos del RCV",
    clase: "border-primary/30 bg-primary/10 text-primary",
  },
  rcv_resumen: {
    texto: "RCV resumido",
    clase: "border-warning/40 bg-warning-soft text-warning-foreground",
  },
  f29: {
    texto: "tax_f29_history",
    clase: "border-success/30 bg-success-soft text-success",
  },
  demo: {
    texto: "Datos demostrativos",
    clase: "border-border bg-secondary text-muted-foreground",
  },
  calculo: {
    texto: "Cálculo interno",
    clase: "border-border bg-secondary text-muted-foreground",
  },
  usuario: {
    texto: "Configurado por ti",
    clase: "border-border bg-secondary text-muted-foreground",
  },
};

interface Linea {
  concepto: string;
  monto: string;
  formula: string;
  evidencia: Evidencia;
}

function Etiqueta({ evidencia }: { evidencia: Evidencia }) {
  const e = ETIQUETA_EVIDENCIA[evidencia];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${e.clase}`}
    >
      {e.texto}
    </span>
  );
}

export function AuditoriaMontos({ data }: { data: DashboardData }) {
  const { resumen, ventas, compras } = data;
  const esDemo = data.fuentePeriodo === "mock";

  const hayDocsVenta = data.documentosVenta.length > 0;
  const hayDocsCompra = data.documentosCompra.length > 0;

  const evVentas: Evidencia = esDemo
    ? "demo"
    : hayDocsVenta
      ? "documentos"
      : "rcv_resumen";
  const evCompras: Evidencia = esDemo
    ? "demo"
    : hayDocsCompra
      ? "documentos"
      : "rcv_resumen";

  const evRemanente: Evidencia =
    resumen.fuenteRemanente === ORIGEN_F29_CONTADOR || resumen.fuenteRemanente === "f29"
      ? "f29"
      : resumen.fuenteRemanente === "mock"
        ? "demo"
        : "calculo";

  const evPpm: Evidencia =
    resumen.fuentePpm === ORIGEN_F29_CONTADOR || resumen.fuentePpm === "previous_f29"
      ? "f29"
      : resumen.fuentePpm === "mock"
        ? "demo"
        : resumen.fuentePpm === "configured"
          ? "usuario"
          : "calculo";

  const evRetenciones: Evidencia =
    resumen.fuenteRetenciones === ORIGEN_F29_CONTADOR ||
    resumen.fuenteRetenciones === "f29_history"
      ? "f29"
      : resumen.fuenteRetenciones === "documents"
        ? "documentos"
        : resumen.fuenteRetenciones === "mock"
          ? "demo"
          : resumen.fuenteRetenciones === "configured"
            ? "usuario"
            : "calculo";

  const tasaPpmTexto =
    resumen.tasaPpm != null
      ? `${(resumen.tasaPpm * 100).toLocaleString("es-CL", {
          maximumFractionDigits: 2,
        })}%`
      : "sin tasa registrada";

  const lineas: Linea[] = [
    {
      concepto: "Ventas netas del periodo",
      monto: formatCLP(ventas.ventasNetas),
      formula: `${ventas.cantidadDocumentosInformados} documentos informados (${ventas.cantidadFacturas} facturas, ${ventas.cantidadBoletas} boletas, ${ventas.cantidadNotasCredito} notas de crédito que restan).`,
      evidencia: evVentas,
    },
    {
      concepto: "IVA débito por ventas",
      monto: formatCLP(resumen.ivaDebito),
      formula: resumen.ivaDebitoInferido
        ? "Suma del IVA informado en cada documento; en algunos se infirió desde el neto."
        : "Suma del IVA informado en cada documento de venta, restando las notas de crédito.",
      evidencia: evVentas,
    },
    {
      concepto: "IVA crédito por compras",
      monto: formatCLP(resumen.ivaCredito),
      formula: `${compras.documentosRegistrados} documentos con derecho a crédito; ${compras.documentosPendientes} pendientes (${formatCLP(resumen.ivaCreditoPotencial)} potenciales) quedan fuera.`,
      evidencia: evCompras,
    },
    {
      concepto: "Remanente anterior",
      monto: formatCLP(resumen.remanenteAnterior),
      formula:
        evRemanente === "f29"
          ? "Remanente declarado en el F29 registrado para el periodo anterior."
          : "Remanente estimado a partir de la información disponible del periodo anterior.",
      evidencia: evRemanente,
    },
    {
      concepto: "IVA estimado por pagar",
      monto: formatCLP(resumen.ivaEstimado),
      formula: `${formatCLP(resumen.ivaDebito)} − ${formatCLP(resumen.ivaCredito)} − ${formatCLP(resumen.remanenteAnterior)}.`,
      evidencia: "calculo",
    },
    {
      concepto: "PPM estimado",
      monto: formatCLP(resumen.ppmEstimado),
      formula: `Base ${formatCLP(resumen.basePpm)} × tasa ${tasaPpmTexto}.`,
      evidencia: evPpm,
    },
    {
      concepto: "Retenciones estimadas",
      monto: formatCLP(resumen.retencionesEstimadas),
      formula: "Retenciones registradas para el periodo.",
      evidencia: evRetenciones,
    },
    {
      concepto: "Total tributario estimado",
      monto: formatCLP(resumen.totalTributarioEstimado),
      formula: `${formatCLP(resumen.ivaEstimado)} + ${formatCLP(resumen.ppmEstimado)} + ${formatCLP(resumen.retencionesEstimadas)}.`,
      evidencia: "calculo",
    },
    {
      concepto: "Reserva recomendada",
      monto: formatCLP(resumen.reservaRecomendada),
      formula: `Total tributario + margen preventivo de ${resumen.margenPorcentaje}% (${formatCLP(resumen.margenPreventivo)}).`,
      evidencia: "calculo",
    },
  ];

  return (
    <SectionCard
      titulo="Auditoría de los montos"
      descripcion="Desglose de cada cifra y el origen de la información utilizada."
    >
      <ul className="space-y-3">
        {lineas.map((l) => (
          <li key={l.concepto} className="rounded-xl bg-secondary/60 p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-semibold">{l.concepto}</p>
              <p className="shrink-0 text-sm font-bold tabular-nums">{l.monto}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{l.formula}</p>
            <div className="mt-2">
              <Etiqueta evidencia={l.evidencia} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        {esDemo
          ? "Datos simulados para pruebas. No corresponden a información obtenida del SII."
          : "Estimación informativa. El resultado definitivo debe ser confirmado por tu contador."}
      </p>
    </SectionCard>
  );
}
