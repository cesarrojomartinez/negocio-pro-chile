import { describe, expect, it } from "vitest";

import { construirDashboard } from "@/lib/dashboardBuilder";
import {
  aplicarAntecedenteF29,
  interpretarAntecedenteF29,
  resolverRemanenteAnterior,
  resolverTasaPpm,
} from "@/lib/f29Antecedent";
import type { DocumentoTributario, PeriodoData } from "@/types/tax";
import type { Empresa } from "@/types/company";

/**
 * Motor general: cada componente se resuelve según su propia fuente.
 * Caso real de abril de 2026 (RUT 77.976.228-9).
 * VENTAS   1 factura · 6.000.000 neto · 1.140.000 IVA débito
 * COMPRAS 22 facturas ·   311.650 IVA crédito
 * F29      remanente anterior 114.353 · PPM 150.000 (2,5 % sobre 6.000.000)
 *          IVA determinado 713.997 · Total 863.997
 */

const EMPRESA: Empresa = {
  id: "bdc659fe-ef6e-4e14-82a5-33c8e32c86ba",
  rut: "77.976.228-9",
  razonSocial: "Explotación de Madera JMC SpA",
  nombreFantasia: "JMC",
  actividad: "Servicios de corta de madera",
  estadoConexionSii: "connected",
  ultimaSincronizacion: "2026-07-30T08:15:29.223Z",
  periodoActivo: "2026-04",
};

const F29_ABRIL = {
  declaration_status: "filed",
  declared_vat: 713_997,
  declared_ppm: 150_000,
  declared_withholdings: 0,
  declared_total: 863_997,
  vat_carryforward: 114_353,
  source: "accountant",
  raw_data: {
    origin: "accountant_confirmed_f29",
    confirmation_status: "confirmed",
    ppm_rate: 0.025,
    ppm_tax_base: 6_000_000,
  },
};

function documentosAbril() {
  const ventas: DocumentoTributario[] = [
    {
      id: "v-1",
      fecha: "2026-04-15",
      tipoDocumento: "factura",
      folio: 30,
      contraparte: "Agrícola Hacienda Huentelauquén Limitada",
      rutContraparte: "77.422.290-1",
      neto: 6_000_000,
      iva: 1_140_000,
      exento: 0,
      total: 7_140_000,
      estado: "emitido",
      periodo: "2026-04",
    },
  ];
  const compras: DocumentoTributario[] = Array.from({ length: 22 }, (_, i) => {
    const iva = i === 0 ? 311_650 - 21 * 10_000 : 10_000;
    return {
      id: `c-${i}`,
      fecha: "2026-04-10",
      tipoDocumento: "factura" as const,
      folio: 100 + i,
      contraparte: `Proveedor ${i + 1}`,
      rutContraparte: "76.000.000-0",
      neto: Math.round(iva / 0.19),
      iva,
      exento: 0,
      total: Math.round(iva / 0.19) + iva,
      estado: "registrada" as const,
      periodo: "2026-04",
    };
  });
  return { ventas, compras };
}

function periodoAbril(): PeriodoData {
  const { ventas, compras } = documentosAbril();
  const antecedente = interpretarAntecedenteF29(F29_ABRIL);
  const remanente = resolverRemanenteAnterior({
    esDemo: false,
    antecedentePeriodo: antecedente,
    remanenteCalculadoPrevio: null,
    periodoAnteriorConfirmado: false,
  });
  const tasa = resolverTasaPpm({
    esDemo: false,
    antecedentePeriodo: antecedente,
    tasaParametroVigente: 0.025,
    tasaConfigurada: null,
    configuracionConfirmada: false,
    tasaConfirmadaPrevia: null,
  });
  const parametros = aplicarAntecedenteF29(
    {
      remanenteAnterior: remanente.remanenteAnterior,
      fuenteRemanente: remanente.fuenteRemanente,
      tasaPpm: tasa.tasaPpm,
      fuentePpm: tasa.fuentePpm,
      retenciones: 0,
      fuenteRetenciones: "unknown",
    },
    antecedente,
  );

  return {
    periodo: "2026-04",
    documentosVenta: ventas,
    documentosCompra: compras,
    remanenteAnterior: parametros.remanenteAnterior,
    fuenteRemanente: parametros.fuenteRemanente,
    remanenteConocido: remanente.conocido,
    tasaPpm: parametros.tasaPpm,
    fuentePpm: parametros.fuentePpm,
    basePpmConfirmada: antecedente?.basePpmDeclarada ?? null,
    retencionesEstimadas: parametros.retenciones,
    fuenteRetenciones: parametros.fuenteRetenciones,
    ivaDeclarado: antecedente?.ivaDeclarado ?? null,
    ppmDeclarado: antecedente?.ppmDeclarado ?? null,
    retencionesDeclaradas: antecedente?.retenciones ?? null,
    totalDeclarado: antecedente?.totalDeclarado ?? null,
    metaMensual: 0,
    dineroReservado: 0,
    diasTranscurridos: 30,
    diasTotales: 30,
    estadoPeriodo: "closed",
    confiabilidad: "alta",
  };
}

function armar(periodo: PeriodoData, f29Confirmado = true) {
  return construirDashboard({
    empresa: EMPRESA,
    periodo,
    periodoAnterior: null,
    idPeriodoAnterior: null,
    margenPorcentaje: 10,
    dineroReservado: 0,
    metaMensual: 0,
    esDemo: false,
    f29Confirmado,
    calculadoEn: "2026-07-30T00:00:00.000Z",
  });
}

describe("motor general — abril 2026 con antecedentes confirmados", () => {
  const d = armar(periodoAbril());

  it("aplica la fórmula general del IVA con el remanente confirmado", () => {
    expect(d.contexto.vat_debit).toBe(1_140_000);
    expect(d.contexto.current_period_vat_credit).toBe(311_650);
    expect(d.contexto.previous_vat_carryforward).toBe(114_353);
    expect(d.contexto.total_vat_credits).toBe(426_003);
    expect(d.contexto.estimated_vat_payable).toBe(713_997);
    expect(d.contexto.estimated_new_carryforward).toBe(0);
  });

  it("usa la base y la tasa de PPM confirmadas", () => {
    expect(d.contexto.ppm_tax_base).toBe(6_000_000);
    expect(d.contexto.ppm_rate).toBe(0.025);
    expect(d.contexto.estimated_ppm).toBe(150_000);
  });

  it("coincide con el total declarado en el Formulario 29", () => {
    expect(d.contexto.estimated_tax_total).toBe(863_997);
    expect(d.contexto.declared_tax_total).toBe(863_997);
    expect(d.contexto.declared_difference).toBe(0);
    expect(d.contexto.diferencias.every((x) => x.diferencia === 0)).toBe(true);
  });

  it("registra la procedencia de cada componente por separado", () => {
    expect(d.contexto.sources.vat_debit_source).toBe("rcv");
    expect(d.contexto.sources.vat_credit_source).toBe("rcv");
    expect(d.contexto.sources.carryforward_source).toBe("accountant_confirmed");
    expect(d.contexto.sources.ppm_rate_source).toBe("accountant_confirmed");
    expect(d.contexto.sources.ppm_base_source).toBe("accountant_confirmed");
    expect(d.contexto.calculation_status).toBe("closed");
    expect(d.contexto.missing_components).toHaveLength(0);
  });
});

describe("motor general — periodos sin antecedentes", () => {
  it("marca incompleto cuando falta el remanente y la tasa de PPM", () => {
    const base = periodoAbril();
    const sinAntecedentes: PeriodoData = {
      ...base,
      periodo: "2026-01",
      remanenteAnterior: 0,
      fuenteRemanente: "unknown",
      remanenteConocido: false,
      tasaPpm: null,
      fuentePpm: "unknown",
      basePpmConfirmada: null,
      retencionesEstimadas: 0,
      fuenteRetenciones: "unknown",
      ivaDeclarado: null,
      ppmDeclarado: null,
      retencionesDeclaradas: null,
      totalDeclarado: null,
    };
    const d = armar(sinAntecedentes, false);

    expect(d.contexto.calculation_status).toBe("incomplete");
    expect(d.contexto.missing_components.map((c) => c.clave)).toEqual(
      expect.arrayContaining(["carryforward", "ppm_rate", "withholdings"]),
    );
    expect(d.contexto.estimated_ppm).toBe(0);
    // El remanente desconocido se calcula con cero, nunca se inventa.
    expect(d.contexto.previous_vat_carryforward).toBe(0);
    expect(d.contexto.carryforward_known).toBe(false);
    expect(d.contexto.estimated_vat_payable).toBe(828_350);
  });

  it("no arrastra datos demostrativos a una empresa real sin documentos", () => {
    const vacio: PeriodoData = {
      periodo: "2026-02",
      documentosVenta: [],
      documentosCompra: [],
      remanenteAnterior: 0,
      fuenteRemanente: "unknown",
      remanenteConocido: false,
      tasaPpm: null,
      fuentePpm: "unknown",
      retencionesEstimadas: 0,
      fuenteRetenciones: "unknown",
      metaMensual: 0,
      dineroReservado: 0,
      diasTranscurridos: 28,
      diasTotales: 28,
      estadoPeriodo: "closed",
      confiabilidad: "desconocida",
    };
    const d = armar(vacio, false);

    expect(d.fuentePeriodo).toBe("not_synchronized");
    expect(d.contexto.estimated_tax_total).toBe(0);
    expect(d.contexto.sources.sales_source).toBe("unknown");
    expect(d.contexto.calculation_status).toBe("incomplete");
  });

  it("genera nuevo remanente cuando los créditos superan a los débitos", () => {
    const base = periodoAbril();
    const conCredito: PeriodoData = {
      ...base,
      remanenteAnterior: 2_000_000,
      fuenteRemanente: "accountant_confirmed_f29",
      remanenteConocido: true,
      totalDeclarado: null,
      ivaDeclarado: null,
      ppmDeclarado: null,
      retencionesDeclaradas: null,
    };
    const d = armar(conCredito);

    expect(d.contexto.estimated_vat_payable).toBe(0);
    expect(d.contexto.estimated_new_carryforward).toBe(1_171_650);
    expect(d.contexto.estimated_tax_total).toBe(150_000);
  });
});
