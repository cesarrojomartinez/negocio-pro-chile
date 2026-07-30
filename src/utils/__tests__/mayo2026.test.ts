import { describe, expect, it } from "vitest";

import { construirDashboard, determinarFuentePeriodo } from "@/lib/dashboardBuilder";
import {
  aplicarAntecedenteF29,
  descripcionOrigenEstimacion,
  interpretarAntecedenteF29,
  MENSAJE_PERIODO_SIN_SINCRONIZAR,
} from "@/lib/f29Antecedent";
import type { DocumentoTributario, PeriodoData } from "@/types/tax";
import type { Empresa } from "@/types/company";

/**
 * Caso real de mayo de 2026 (RUT 77.976.228-9) confirmado por el contador.
 * VENTAS   3 facturas · 9.958.279 neto · 1.892.073 IVA débito
 * COMPRAS 19 facturas con crédito ·   127.099 IVA crédito
 * F29      IVA determinado 1.764.974 · PPM 248.957 (2,5 %) · Total 2.013.931
 */

const EMPRESA: Empresa = {
  id: "bdc659fe-ef6e-4e14-82a5-33c8e32c86ba",
  rut: "77.976.228-9",
  razonSocial: "Explotación de Madera JMC SpA",
  nombreFantasia: "JMC",
  actividad: "Servicios de corta de madera",
  estadoConexionSii: "connected",
  ultimaSincronizacion: "2026-07-30T08:15:29.223Z",
  periodoActivo: "2026-05",
};

const F29_MAYO = {
  declaration_status: "filed",
  declared_vat: 1_764_974,
  declared_ppm: 248_957,
  declared_withholdings: 0,
  declared_total: 2_013_931,
  vat_carryforward: 0,
  source: "accountant",
  raw_data: {
    origin: "accountant_confirmed_f29",
    confirmation_status: "confirmed",
    ppm_rate: 0.025,
    ppm_tax_base: 9_958_279,
  },
};

function documentosMayo() {
  const ventas: DocumentoTributario[] = [
    { neto: 4_820_000, iva: 915_800 },
    { neto: 4_020_000, iva: 763_800 },
    { neto: 1_118_279, iva: 212_473 },
  ].map((v, i) => ({
    id: `v-${i}`,
    fecha: "2026-05-10",
    tipoDocumento: "factura" as const,
    folio: 40 + i,
    contraparte: "Agrícola Hacienda Huentelauquén Limitada",
    rutContraparte: "77.422.290-1",
    neto: v.neto,
    iva: v.iva,
    exento: 0,
    total: v.neto + v.iva,
    estado: "emitido" as const,
    periodo: "2026-05",
  }));

  // 19 facturas de compra con derecho a crédito: 18 × 6.689 + 1 × 6.697
  const compras: DocumentoTributario[] = Array.from({ length: 19 }, (_, i) => {
    const iva = i === 18 ? 6_697 : 6_689;
    const neto = Math.round(iva / 0.19);
    return {
      id: `c-${i}`,
      fecha: "2026-05-12",
      tipoDocumento: "factura" as const,
      folio: 100 + i,
      contraparte: "Proveedores varios",
      rutContraparte: "77.936.634-0",
      neto,
      iva,
      exento: 0,
      total: neto + iva,
      estado: "registrada" as const,
      periodo: "2026-05",
    };
  });

  return { ventas, compras };
}

function armarMayo(margenPorcentaje = 0) {
  const { ventas, compras } = documentosMayo();
  const antecedente = interpretarAntecedenteF29(F29_MAYO);
  // Configuración de la empresa: tasa 0,6 %, que el F29 confirmado debe reemplazar.
  const parametros = aplicarAntecedenteF29(
    {
      remanenteAnterior: 0,
      fuenteRemanente: "unknown",
      tasaPpm: 0.006,
      fuentePpm: "configured",
      retenciones: 0,
      fuenteRetenciones: "unknown",
    },
    antecedente,
  );

  const periodo: PeriodoData = {
    periodo: "2026-05",
    documentosVenta: ventas,
    documentosCompra: compras,
    remanenteAnterior: parametros.remanenteAnterior,
    fuenteRemanente: parametros.fuenteRemanente,
    tasaPpm: parametros.tasaPpm,
    fuentePpm: parametros.fuentePpm,
    retencionesEstimadas: parametros.retenciones,
    fuenteRetenciones: parametros.fuenteRetenciones,
    metaMensual: 0,
    dineroReservado: 0,
    diasTranscurridos: 31,
    diasTotales: 31,
    estadoPeriodo: "closed",
    confiabilidad: "alta",
  };

  return construirDashboard({
    empresa: EMPRESA,
    periodo,
    periodoAnterior: null,
    idPeriodoAnterior: null,
    margenPorcentaje,
    dineroReservado: 0,
    metaMensual: 0,
    diasDesdeSincronizacion: 0,
    configuradoManualmente: true,
    esDemo: false,
    f29Confirmado: !!antecedente?.confirmado,
  });
}

describe("mayo 2026 — cifras confirmadas por el F29", () => {
  it("determina IVA, PPM y total del periodo", () => {
    const d = armarMayo();
    expect(d.resumen.ivaDebito).toBe(1_892_073);
    expect(d.resumen.ivaCredito).toBe(127_099);
    expect(d.resumen.remanenteAnterior).toBe(0);
    expect(d.resumen.ivaEstimado).toBe(1_764_974);
    expect(d.resumen.basePpm).toBe(9_958_279);
    expect(d.resumen.tasaPpm).toBe(0.025);
    expect(d.resumen.ppmEstimado).toBe(248_957);
    expect(d.resumen.retencionesEstimadas).toBe(0);
    expect(d.resumen.totalTributarioEstimado).toBe(2_013_931);
  });

  it("con margen preventivo 0 % la reserva recomendada es el total", () => {
    const d = armarMayo(0);
    expect(d.resumen.margenPreventivo).toBe(0);
    expect(d.resumen.reservaRecomendada).toBe(2_013_931);
  });

  it("cuenta 3 facturas de venta y 19 compras con crédito", () => {
    const d = armarMayo();
    expect(d.ventas.cantidadFacturas).toBe(3);
    expect(d.compras.documentosRegistrados).toBe(19);
  });

  it("no arrastra la tasa de PPM de otro periodo ni la configurada", () => {
    const d = armarMayo();
    expect(d.resumen.fuentePpm).toBe("accountant_confirmed_f29");
    expect(d.resumen.tasaPpm).not.toBe(0.006);
  });

  it("declara el origen real del periodo", () => {
    const d = armarMayo();
    expect(d.fuentePeriodo).toBe("rcv_real_plus_accountant");
    expect(descripcionOrigenEstimacion(d.fuentePeriodo)).toContain(
      "antecedentes del F29 confirmados por el contador",
    );
    expect(descripcionOrigenEstimacion(d.fuentePeriodo)).not.toContain("demostrativos");
  });
});

describe("origen del periodo", () => {
  it("una empresa real sin datos no cae en modo demostrativo", () => {
    const fuente = determinarFuentePeriodo({
      esDemo: false,
      hayDocumentos: false,
      f29Confirmado: false,
    });
    expect(fuente).toBe("not_synchronized");
    expect(descripcionOrigenEstimacion(fuente)).toBe(MENSAJE_PERIODO_SIN_SINCRONIZAR);
  });

  it("distingue cada combinación de origen", () => {
    expect(
      determinarFuentePeriodo({ esDemo: true, hayDocumentos: true, f29Confirmado: true }),
    ).toBe("mock");
    expect(
      determinarFuentePeriodo({
        esDemo: false,
        hayDocumentos: true,
        f29Confirmado: false,
      }),
    ).toBe("rcv_real");
    expect(
      determinarFuentePeriodo({
        esDemo: false,
        hayDocumentos: false,
        f29Confirmado: true,
      }),
    ).toBe("accountant_confirmed");
  });

  it("la etiqueta cambia según el periodo seleccionado", () => {
    expect(descripcionOrigenEstimacion("rcv_real")).toContain("Registro de Compras");
    expect(descripcionOrigenEstimacion("accountant_confirmed")).toBe(
      "Estimación calculada con antecedentes del F29 confirmados por el contador.",
    );
    expect(descripcionOrigenEstimacion("mock")).toContain("datos demostrativos");
  });
});
