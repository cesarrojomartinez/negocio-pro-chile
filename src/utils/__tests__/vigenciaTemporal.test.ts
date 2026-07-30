import { describe, expect, it } from "vitest";

import { construirDashboard } from "@/lib/dashboardBuilder";
import {
  aplicarAntecedenteF29,
  interpretarAntecedenteF29,
  resolverRemanenteAnterior,
  resolverTasaPpm,
} from "@/lib/f29Antecedent";
import {
  conciliarRemanente,
  hayHistorialDeVigencias,
  seleccionarParametroVigente,
} from "@/lib/vigenciaParametros";
import type { DocumentoTributario, PeriodoData } from "@/types/tax";
import type { Empresa } from "@/types/company";

/**
 * Vigencia temporal de los parámetros tributarios.
 * Caso real de marzo de 2026 (RUT 77.976.228-9).
 * IVA débito 759.639 · IVA crédito 664.047 · remanente anterior 208.968
 * IVA determinado 0 · nuevo remanente 113.376
 * PPM: base 3.998.100 × 1 % = 39.981 · Total a pagar 39.981
 * La tasa de 2,5 % rige recién desde abril y NO puede aplicarse a marzo.
 */

const EMPRESA: Empresa = {
  id: "bdc659fe-ef6e-4e14-82a5-33c8e32c86ba",
  rut: "77.976.228-9",
  razonSocial: "Explotación de Madera JMC SpA",
  nombreFantasia: "JMC",
  actividad: "Servicios de corta de madera",
  estadoConexionSii: "connected",
  ultimaSincronizacion: "2026-07-30T08:15:29.223Z",
  periodoActivo: "2026-03",
};

const PARAMETROS_PPM = [
  {
    value: 0.01,
    effective_from: "2026-03-01",
    effective_to: "2026-03-31",
    confirmed: true,
    source: "accountant_confirmed",
  },
  {
    value: 0.025,
    effective_from: "2026-04-01",
    effective_to: null,
    confirmed: true,
    source: "accountant_confirmed",
  },
];

const F29_MARZO = {
  declaration_status: "filed",
  declared_vat: 0,
  declared_ppm: 39_981,
  declared_withholdings: 0,
  declared_total: 39_981,
  vat_carryforward: 208_968,
  source: "accountant",
  raw_data: {
    origin: "accountant_confirmed_f29",
    confirmation_status: "confirmed",
    ppm_rate: 0.01,
    ppm_tax_base: 3_998_100,
  },
};

function documentosMarzo() {
  const ventas: DocumentoTributario[] = [
    {
      id: "v-1",
      fecha: "2026-03-20",
      tipoDocumento: "factura",
      folio: 28,
      contraparte: "Cliente Marzo",
      rutContraparte: "77.422.290-1",
      neto: 3_998_100,
      iva: 759_639,
      exento: 0,
      total: 4_757_739,
      estado: "emitido",
      periodo: "2026-03",
    },
  ];
  const compras: DocumentoTributario[] = [
    {
      id: "c-1",
      fecha: "2026-03-10",
      tipoDocumento: "factura",
      folio: 90,
      contraparte: "Proveedor Marzo",
      rutContraparte: "76.000.000-0",
      neto: 3_495_000,
      iva: 664_047,
      exento: 0,
      total: 4_159_047,
      estado: "registrada",
      periodo: "2026-03",
    },
  ];
  return { ventas, compras };
}

function periodoMarzo(): PeriodoData {
  const { ventas, compras } = documentosMarzo();
  const antecedente = interpretarAntecedenteF29(F29_MARZO);
  const vigente = seleccionarParametroVigente(PARAMETROS_PPM, "2026-03");
  const remanente = resolverRemanenteAnterior({
    esDemo: false,
    antecedentePeriodo: antecedente,
    remanenteCalculadoPrevio: null,
    periodoAnteriorConfirmado: false,
  });
  const tasa = resolverTasaPpm({
    esDemo: false,
    antecedentePeriodo: antecedente,
    tasaParametroVigente: vigente?.valor ?? null,
    hayHistorialVigencias: hayHistorialDeVigencias(PARAMETROS_PPM),
    // Tasa global de la configuración: 2,5 %. No debe aplicarse a marzo.
    tasaConfigurada: 0.025,
    configuracionConfirmada: true,
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
    periodo: "2026-03",
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
    diasTranscurridos: 31,
    diasTotales: 31,
    estadoPeriodo: "closed",
    confiabilidad: "alta",
  };
}

describe("vigencia temporal de parámetros", () => {
  it("no aplica una tasa que empieza en abril a un periodo de marzo", () => {
    expect(seleccionarParametroVigente(PARAMETROS_PPM, "2026-03")?.valor).toBe(0.01);
    expect(seleccionarParametroVigente(PARAMETROS_PPM, "2026-04")?.valor).toBe(0.025);
    expect(seleccionarParametroVigente(PARAMETROS_PPM, "2026-06")?.valor).toBe(0.025);
  });

  it("deja el periodo sin tasa cuando ninguna vigencia lo cubre", () => {
    expect(seleccionarParametroVigente(PARAMETROS_PPM, "2026-02")).toBeNull();
    const tasa = resolverTasaPpm({
      esDemo: false,
      antecedentePeriodo: null,
      tasaParametroVigente: null,
      hayHistorialVigencias: true,
      tasaConfigurada: 0.025,
      configuracionConfirmada: true,
      tasaConfirmadaPrevia: null,
    });
    expect(tasa.tasaPpm).toBeNull();
    expect(tasa.fuentePpm).toBe("unknown");
  });

  it("usa la configuración sin fecha solo si no hay historial de vigencias", () => {
    const tasa = resolverTasaPpm({
      esDemo: false,
      antecedentePeriodo: null,
      tasaParametroVigente: null,
      hayHistorialVigencias: false,
      tasaConfigurada: 0.025,
      configuracionConfirmada: true,
      tasaConfirmadaPrevia: null,
    });
    expect(tasa.tasaPpm).toBe(0.025);
    expect(tasa.fuentePpm).toBe("configured");
  });
});

describe("conciliación de remanentes", () => {
  it("registra la diferencia sin corregir ningún valor", () => {
    const c = conciliarRemanente(113_376, 114_353);
    expect(c).toEqual({
      remanenteCalculadoPrevio: 113_376,
      remanenteDeclarado: 114_353,
      diferencia: 977,
    });
  });

  it("no genera conciliación cuando coinciden o falta un dato", () => {
    expect(conciliarRemanente(113_376, 113_376)).toBeNull();
    expect(conciliarRemanente(null, 113_376)).toBeNull();
    expect(conciliarRemanente(113_376, null)).toBeNull();
  });
});

describe("marzo 2026 con la tasa vigente del periodo", () => {
  const d = construirDashboard({
    empresa: EMPRESA,
    periodo: periodoMarzo(),
    periodoAnterior: null,
    idPeriodoAnterior: null,
    margenPorcentaje: 10,
    dineroReservado: 0,
    metaMensual: 0,
    esDemo: false,
    f29Confirmado: true,
    calculadoEn: "2026-07-30T00:00:00.000Z",
  });

  it("aplica el remanente anterior confirmado", () => {
    expect(d.contexto.vat_debit).toBe(759_639);
    expect(d.contexto.current_period_vat_credit).toBe(664_047);
    expect(d.contexto.previous_vat_carryforward).toBe(208_968);
    expect(d.contexto.carryforward_known).toBe(true);
    expect(d.contexto.estimated_vat_payable).toBe(0);
    expect(d.contexto.estimated_new_carryforward).toBe(113_376);
  });

  it("calcula el PPM con la tasa de 1 % vigente en marzo", () => {
    expect(d.contexto.ppm_tax_base).toBe(3_998_100);
    expect(d.contexto.ppm_rate).toBe(0.01);
    expect(d.contexto.estimated_ppm).toBe(39_981);
  });

  it("totaliza 39.981 y coincide con el F29 confirmado", () => {
    expect(d.contexto.estimated_tax_total).toBe(39_981);
    expect(d.contexto.declared_tax_total).toBe(39_981);
    expect(d.contexto.declared_difference).toBe(0);
    expect(d.contexto.calculation_status).not.toBe("incomplete");
  });
});
