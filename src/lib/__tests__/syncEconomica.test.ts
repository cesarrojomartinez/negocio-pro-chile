import { describe, expect, it } from "vitest";
import {
  claveIdempotencia,
  decidirActualizacionPeriodo,
  puedeReintentarDescargaF29,
  NORMAL_SYNC_FETCH_DOCUMENT_DETAIL,
  NORMAL_SYNC_PURCHASE_STATES,
} from "@/lib/syncEconomica";
import {
  agregadosComprasDeResumen,
  agregadosVentasDeResumen,
} from "@/integrations/sii/rcvSummary";
import {
  construirResumenCompras,
  construirResumenVentas,
} from "@/utils/taxCalculations";
import type { DocumentoTributario } from "@/types/tax";

const AHORA = new Date("2026-07-15T12:00:00-04:00");
const base = {
  periodoActual: "2026-07",
  ahora: AHORA,
  ultimaSincronizacionRcv: null,
  tieneF29Vigente: false,
  periodoCerrado: false,
  tieneDocumentosRcv: true,
};


describe("política de actualización periodo a periodo", () => {
  it("la primera vez siempre consulta", () => {
    const d = decidirActualizacionPeriodo({ ...base, periodo: "2026-07" });
    expect(d.consultarRcv).toBe(true);
    expect(d.motivo).toBe("sin_datos_previos");
  });

  it("el mes en curso se actualiza una vez al día", () => {
    const reciente = decidirActualizacionPeriodo({
      ...base,
      periodo: "2026-07",
      ultimaSincronizacionRcv: "2026-07-15T06:00:00-04:00",
    });
    expect(reciente.consultarRcv).toBe(false);
    expect(reciente.motivo).toBe("rcv_vigente");

    const vencido = decidirActualizacionPeriodo({
      ...base,
      periodo: "2026-07",
      ultimaSincronizacionRcv: "2026-07-14T05:00:00-04:00",
    });
    expect(vencido.consultarRcv).toBe(true);
    expect(vencido.motivo).toBe("mes_en_curso_vencido");
  });

  it("un mes terminado sin Formulario 29 se revisa cada tres días", () => {
    const dosDias = decidirActualizacionPeriodo({
      ...base,
      periodo: "2026-06",
      ultimaSincronizacionRcv: "2026-07-13T12:00:00-04:00",
    });
    expect(dosDias.consultarRcv).toBe(false);

    const cuatroDias = decidirActualizacionPeriodo({
      ...base,
      periodo: "2026-06",
      ultimaSincronizacionRcv: "2026-07-11T12:00:00-04:00",
    });
    expect(cuatroDias.consultarRcv).toBe(true);
    expect(cuatroDias.motivo).toBe("mes_sin_f29_vencido");
  });

  it("un periodo con Formulario 29 leído no vuelve a pedir el RCV", () => {
    const d = decidirActualizacionPeriodo({
      ...base,
      periodo: "2026-05",
      tieneF29Vigente: true,
      ultimaSincronizacionRcv: "2026-01-01T12:00:00-04:00",
    });
    expect(d.consultarRcv).toBe(false);
    // El listado anual sí se revisa: viene agrupado y con caché, y detecta
    // rectificatorias con folio nuevo.
    expect(d.revisarListadoF29).toBe(true);
    expect(d.motivo).toBe("periodo_con_f29_vigente");
  });

  it("un periodo cerrado no consulta absolutamente nada", () => {
    const d = decidirActualizacionPeriodo({
      ...base,
      periodo: "2026-04",
      periodoCerrado: true,
      tieneF29Vigente: true,
    });
    expect(d.consultarRcv).toBe(false);
    expect(d.revisarListadoF29).toBe(false);
  });

  it("seleccionar varios periodos evalúa cada uno por separado", () => {
    const decisiones = ["2026-05", "2026-06", "2026-07"].map((periodo) =>
      decidirActualizacionPeriodo({
        ...base,
        periodo,
        tieneF29Vigente: periodo === "2026-05",
        ultimaSincronizacionRcv:
          periodo === "2026-07" ? "2026-07-15T06:00:00-04:00" : "2026-07-01T12:00:00-04:00",
      }),
    );
    expect(decisiones.map((d) => d.consultarRcv)).toEqual([false, true, false]);
  });

  it("tras un fallo de descarga espera 24 horas antes de reintentar", () => {
    expect(puedeReintentarDescargaF29(null, AHORA)).toBe(true);
    expect(puedeReintentarDescargaF29("2026-07-15T06:00:00-04:00", AHORA)).toBe(false);
    expect(puedeReintentarDescargaF29("2026-07-13T06:00:00-04:00", AHORA)).toBe(true);
  });

  it("la llave de idempotencia es estable para el mismo pedido", () => {
    const partes = { companyId: "e1", periodoOAnio: "2026-06", modulo: "rcv_ventas" };
    expect(claveIdempotencia(partes)).toBe(claveIdempotencia(partes));
    expect(claveIdempotencia(partes)).not.toBe(
      claveIdempotencia({ ...partes, periodoOAnio: "2026-07" }),
    );
  });

  it("el flujo normal solo usa el estado REGISTRO y sin detalle", () => {
    expect([...NORMAL_SYNC_PURCHASE_STATES]).toEqual(["REGISTRO"]);
    expect(NORMAL_SYNC_FETCH_DOCUMENT_DETAIL).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Paridad: los totales calculados desde el RESUMEN oficial deben coincidir con
// los que se obtenían descargando el detalle documento por documento.
// ---------------------------------------------------------------------------

const linea = (
  documentTypeCode: number,
  documentCount: number,
  neto: number,
  iva: number,
  exento: number,
) => ({
  documentTypeCode,
  documentTypeName: String(documentTypeCode),
  documentCount,
  netAmount: neto,
  vatAmount: iva,
  exemptAmount: exento,
  totalAmount: neto + iva + exento,
  taxEffect: documentTypeCode === 61 ? -1 : 1,
});

const resumen = {
  ventas: {
    period: "2026-06",
    lines: [
      linea(33, 4, 4_000_000, 760_000, 0),
      linea(39, 1200, 1_000_000, 190_000, 0),
      linea(61, 1, 100_000, 19_000, 0),
    ],
  },
  compras: {
    period: "2026-06",
    lines: [linea(33, 6, 2_000_000, 380_000, 0), linea(61, 1, 50_000, 9_500, 0)],
  },
};

const doc = (
  id: string,
  tipoDocumento: string,
  neto: number,
  iva: number,
): DocumentoTributario =>
  ({
    id,
    tipoDocumento,
    folio: Number(id.replace(/\D/g, "")) || 1,
    fecha: "2026-06-10",
    contraparte: "Contraparte",
    neto,
    iva,
    exento: 0,
    total: neto + iva,
    estado: "registrada",
  }) as unknown as DocumentoTributario;

describe("paridad entre resumen oficial y detalle documento por documento", () => {
  it("las ventas dan el mismo IVA débito con resumen que con detalle", () => {
    const conDetalle = construirResumenVentas(
      [
        doc("v1", "factura", 1_000_000, 190_000),
        doc("v2", "factura", 3_000_000, 570_000),
        doc("v3", "notaCredito", 100_000, 19_000),
      ],
      // Con detalle guardado solo se agregan las boletas del resumen.
      agregadosVentasDeResumen(resumen, true),
    );
    const soloResumen = construirResumenVentas(
      [],
      agregadosVentasDeResumen(resumen, false),
    );

    expect(soloResumen.ventasExentas).toBe(conDetalle.ventasExentas);
    expect(soloResumen.ventasTotales).toBe(conDetalle.ventasTotales);
    expect(soloResumen.ventasNetas).toBe(conDetalle.ventasNetas);
  });

  it("las compras dan el mismo IVA crédito con resumen que con detalle", () => {
    const conDetalle = construirResumenCompras([
      doc("c1", "factura", 2_000_000, 380_000),
      doc("c2", "notaCredito", 50_000, 9_500),
    ]);
    const soloResumen = construirResumenCompras(
      [],
      agregadosComprasDeResumen(resumen, false),
    );

    expect(soloResumen.ivaCredito).toBe(conDetalle.ivaCredito);
    expect(soloResumen.comprasTotales).toBe(conDetalle.comprasTotales);
    expect(soloResumen.comprasNetas).toBe(conDetalle.comprasNetas);
  });

  it("con detalle guardado el resumen no duplica facturas ni notas de crédito", () => {
    expect(agregadosComprasDeResumen(resumen, true)).toBeNull();
    const ventas = agregadosVentasDeResumen(resumen, true);
    // Solo el bloque de boletas: 1.200 boletas informadas como total del mes.
    expect(ventas?.cantidadDocumentos).toBe(1200);
    expect(ventas?.iva).toBe(190_000);
  });

  it("un resumen sin movimiento no altera el periodo", () => {
    const vacio = { ventas: { period: "2026-06", lines: [] }, compras: null };
    expect(agregadosVentasDeResumen(vacio, false)).toBeNull();
    expect(agregadosComprasDeResumen(vacio, false)).toBeNull();
  });
});
