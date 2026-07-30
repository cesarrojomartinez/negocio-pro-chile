import type {
  ComparacionMensual,
  DocumentoTributario,
  MetaComercial,
  PeriodoData,
  Proyeccion,
  ResumenCompras,
  ResumenMensual,
  ResumenVentas,
} from "@/types/tax";

export const TASA_IVA = 0.19;

/** IVA estimado = IVA débito − IVA crédito utilizable − remanente anterior */
export function calcularIva(
  ivaDebito: number,
  ivaCredito: number,
  remanenteAnterior: number,
): { ivaEstimado: number; nuevoRemanente: number } {
  const resultado = ivaDebito - ivaCredito - remanenteAnterior;
  if (resultado > 0) return { ivaEstimado: Math.round(resultado), nuevoRemanente: 0 };
  return { ivaEstimado: 0, nuevoRemanente: Math.round(Math.abs(resultado)) };
}

/** Total tributario estimado = IVA estimado + PPM + retenciones */
export function calcularTotalTributario(
  ivaEstimado: number,
  ppm: number,
  retenciones: number,
): number {
  return Math.round(ivaEstimado + ppm + retenciones);
}

/** Margen preventivo en pesos a partir de un porcentaje (0, 5, 10 o personalizado) */
export function calcularMargenPreventivo(
  totalTributario: number,
  porcentaje: number,
): number {
  return Math.round(totalTributario * (porcentaje / 100));
}

/** Reserva recomendada = total tributario estimado + margen preventivo */
export function calcularReservaRecomendada(
  totalTributario: number,
  margen: number,
): number {
  return Math.round(totalTributario + margen);
}

export type SemaforoReserva = "verde" | "ambar" | "rojo";

export function evaluarReserva(
  reservaRecomendada: number,
  dineroReservado: number,
): { estado: SemaforoReserva; faltante: number; cobertura: number } {
  const faltante = Math.max(0, Math.round(reservaRecomendada - dineroReservado));
  const cobertura =
    reservaRecomendada > 0
      ? Math.min(100, (dineroReservado / reservaRecomendada) * 100)
      : 100;
  const estado: SemaforoReserva =
    cobertura >= 100 ? "verde" : cobertura >= 70 ? "ambar" : "rojo";
  return { estado, faltante, cobertura };
}

export const MENSAJE_SEMAFORO: Record<SemaforoReserva, string> = {
  verde: "Tu reserva cubre la estimación actual.",
  ambar: "Estás cerca, pero todavía falta una parte.",
  rojo: "Conviene reservar dinero adicional para evitar sorpresas al cierre.",
};

function esVentaVigente(d: DocumentoTributario) {
  return d.estado !== "anulado";
}

function creditoUtilizable(d: DocumentoTributario) {
  return d.estado === "registrada";
}

export function construirResumenVentas(docs: DocumentoTributario[]): ResumenVentas {
  const vigentes = docs.filter(esVentaVigente);
  const facturas = vigentes.filter((d) => d.tipoDocumento === "factura");
  const boletas = vigentes.filter((d) => d.tipoDocumento === "boleta");
  const notas = vigentes.filter((d) => d.tipoDocumento === "notaCredito");

  const suma = (arr: DocumentoTributario[]) => arr.reduce((a, d) => a + d.total, 0);
  const ventasFacturas = suma(facturas);
  const ventasBoletas = suma(boletas);
  const notasCredito = suma(notas);
  const ventasExentas = vigentes.reduce(
    (a, d) => a + (d.tipoDocumento === "notaCredito" ? 0 : d.exento),
    0,
  );
  const ventasTotales = ventasFacturas + ventasBoletas - notasCredito;

  const porDia = new Map<string, number>();
  for (const d of [...facturas, ...boletas]) {
    porDia.set(d.fecha, (porDia.get(d.fecha) ?? 0) + d.total);
  }
  const serieDiaria = [...porDia.entries()]
    .map(([fecha, monto]) => ({ fecha, monto }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const cantidadDocumentos = facturas.length + boletas.length;

  return {
    ventasTotales,
    ventasFacturas,
    ventasBoletas,
    ventasExentas,
    notasCredito,
    cantidadDocumentos,
    cantidadFacturas: facturas.length,
    cantidadBoletas: boletas.length,
    ticketPromedio: cantidadDocumentos
      ? Math.round((ventasFacturas + ventasBoletas) / cantidadDocumentos)
      : 0,
    serieDiaria,
  };
}

export function construirResumenCompras(docs: DocumentoTributario[]): ResumenCompras {
  const consideradas = docs.filter(creditoUtilizable);
  const comprasTotales = consideradas.reduce((a, d) => a + d.total, 0);
  const comprasNetas = consideradas.reduce((a, d) => a + d.neto, 0);
  const ivaCredito = consideradas.reduce((a, d) => a + d.iva, 0);

  const porProveedor = new Map<string, { monto: number; documentos: number }>();
  for (const d of consideradas) {
    const prev = porProveedor.get(d.contraparte) ?? { monto: 0, documentos: 0 };
    porProveedor.set(d.contraparte, {
      monto: prev.monto + d.total,
      documentos: prev.documentos + 1,
    });
  }

  return {
    comprasTotales,
    comprasNetas,
    ivaCredito,
    documentosRegistrados: consideradas.length,
    documentosPendientes: docs.filter((d) => d.estado === "pendiente").length,
    documentosReclamados: docs.filter((d) => d.estado === "reclamada").length,
    documentosNoIncluir: docs.filter((d) => d.estado === "noIncluir").length,
    proveedoresPrincipales: [...porProveedor.entries()]
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5),
  };
}

export function construirResumenMensual(
  data: PeriodoData,
  opciones: { margenPorcentaje: number; dineroReservado: number },
): ResumenMensual {
  const ventas = construirResumenVentas(data.documentosVenta);
  const compras = construirResumenCompras(data.documentosCompra);

  const vigentes = data.documentosVenta.filter(esVentaVigente);
  const ivaVentas = vigentes.reduce(
    (a, d) => a + (d.tipoDocumento === "notaCredito" ? -d.iva : d.iva),
    0,
  );
  const ivaDebito = Math.max(0, Math.round(ivaVentas));

  const { ivaEstimado, nuevoRemanente } = calcularIva(
    ivaDebito,
    compras.ivaCredito,
    data.remanenteAnterior,
  );

  const ppmEstimado = Math.round(
    (ventas.ventasFacturas + ventas.ventasBoletas - ventas.notasCredito) /
      (1 + TASA_IVA) *
      data.tasaPpm,
  );

  const totalTributarioEstimado = calcularTotalTributario(
    ivaEstimado,
    ppmEstimado,
    data.retencionesEstimadas,
  );
  const margenPreventivo = calcularMargenPreventivo(
    totalTributarioEstimado,
    opciones.margenPorcentaje,
  );
  const reservaRecomendada = calcularReservaRecomendada(
    totalTributarioEstimado,
    margenPreventivo,
  );

  return {
    periodo: data.periodo,
    ventasTotales: ventas.ventasTotales,
    ventasFacturas: ventas.ventasFacturas,
    ventasBoletas: ventas.ventasBoletas,
    ventasExentas: ventas.ventasExentas,
    notasCreditoVentas: ventas.notasCredito,
    comprasTotales: compras.comprasTotales,
    comprasNetas: compras.comprasNetas,
    comprasExentas: data.documentosCompra
      .filter(creditoUtilizable)
      .reduce((a, d) => a + d.exento, 0),
    ivaDebito,
    ivaCredito: compras.ivaCredito,
    remanenteAnterior: data.remanenteAnterior,
    ivaEstimado,
    nuevoRemanente,
    ppmEstimado,
    retencionesEstimadas: data.retencionesEstimadas,
    totalTributarioEstimado,
    margenPreventivo,
    reservaRecomendada,
    dineroReservado: opciones.dineroReservado,
  };
}

export function construirMeta(
  data: PeriodoData,
  ventasAcumuladas: number,
  metaMensual: number,
): MetaComercial {
  const diasRestantes = Math.max(0, data.diasTotales - data.diasTranscurridos);
  const montoFaltante = Math.max(0, metaMensual - ventasAcumuladas);
  const promedioDiarioActual = data.diasTranscurridos
    ? Math.round(ventasAcumuladas / data.diasTranscurridos)
    : 0;
  return {
    metaMensual,
    ventasAcumuladas,
    porcentajeCumplimiento: metaMensual
      ? Math.round((ventasAcumuladas / metaMensual) * 1000) / 10
      : 0,
    montoFaltante,
    diasRestantes,
    diasTranscurridos: data.diasTranscurridos,
    diasTotales: data.diasTotales,
    promedioDiarioNecesario: diasRestantes
      ? Math.round(montoFaltante / diasRestantes)
      : 0,
    promedioDiarioActual,
    proyeccionCierre: Math.round(promedioDiarioActual * data.diasTotales),
  };
}

export type EstadoMeta = "buenDesempeno" | "ritmoAdecuado" | "necesitaImpulso";

export function evaluarMeta(meta: MetaComercial): {
  estado: EstadoMeta;
  titulo: string;
  mensaje: string;
} {
  if (meta.proyeccionCierre >= meta.metaMensual * 1.05) {
    return {
      estado: "buenDesempeno",
      titulo: "Buen desempeño",
      mensaje: "Vas por delante del ritmo necesario para alcanzar tu meta.",
    };
  }
  if (meta.proyeccionCierre >= meta.metaMensual * 0.95) {
    return {
      estado: "ritmoAdecuado",
      titulo: "Ritmo adecuado",
      mensaje: "Manteniendo tu promedio actual podrías alcanzar la meta.",
    };
  }
  return {
    estado: "necesitaImpulso",
    titulo: "Necesita impulso",
    mensaje: `Necesitas vender aproximadamente ${new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    })
      .format(meta.promedioDiarioNecesario)
      .replace(/\s/g, "")} diarios durante los próximos ${meta.diasRestantes} días.`,
  };
}

export function construirProyeccion(
  resumen: ResumenMensual,
  meta: MetaComercial,
  cargaTributaria: number,
): Proyeccion {
  const probable = meta.proyeccionCierre;
  const conservadora = Math.round(probable * 0.95);
  const alta = Math.round(probable * 1.06);
  return {
    ventasActuales: resumen.ventasTotales,
    promedioDiario: meta.promedioDiarioActual,
    conservadora,
    probable,
    alta,
    impuestosMin: Math.round(conservadora * cargaTributaria),
    impuestosMax: Math.round(alta * cargaTributaria),
  };
}

export function construirComparacion(
  periodoActual: string,
  actual: { resumen: ResumenMensual; ventas: ResumenVentas },
  anterior: { resumen: ResumenMensual; ventas: ResumenVentas } | null,
  periodoAnterior: string | null,
): ComparacionMensual {
  const variacion = (a: number, b: number): number | null =>
    !anterior || b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10;

  const porSemana = new Map<string, number>();
  for (const d of actual.ventas.serieDiaria) {
    const dia = new Date(d.fecha).getDate();
    const semana = Math.ceil(dia / 7);
    const key = `Semana ${semana}`;
    porSemana.set(key, (porSemana.get(key) ?? 0) + d.monto);
  }
  const mejorSemanaEntry = [...porSemana.entries()].sort((a, b) => b[1] - a[1])[0];
  const mejorDiaEntry = [...actual.ventas.serieDiaria].sort(
    (a, b) => b.monto - a.monto,
  )[0];

  return {
    periodoActual,
    periodoAnterior,
    ventasActuales: actual.resumen.ventasTotales,
    ventasAnteriores: anterior?.resumen.ventasTotales ?? 0,
    variacionVentas: variacion(
      actual.resumen.ventasTotales,
      anterior?.resumen.ventasTotales ?? 0,
    ),
    comprasActuales: actual.resumen.comprasTotales,
    comprasAnteriores: anterior?.resumen.comprasTotales ?? 0,
    variacionCompras: variacion(
      actual.resumen.comprasTotales,
      anterior?.resumen.comprasTotales ?? 0,
    ),
    ivaActual: actual.resumen.ivaEstimado,
    ivaAnterior: anterior?.resumen.ivaEstimado ?? 0,
    variacionIva: variacion(
      actual.resumen.ivaEstimado,
      anterior?.resumen.ivaEstimado ?? 0,
    ),
    ticketPromedio: actual.ventas.ticketPromedio,
    ticketPromedioAnterior: anterior?.ventas.ticketPromedio ?? 0,
    cantidadFacturas: actual.ventas.cantidadFacturas,
    cantidadBoletas: actual.ventas.cantidadBoletas,
    mejorDia: mejorDiaEntry ?? null,
    mejorSemana: mejorSemanaEntry
      ? { etiqueta: mejorSemanaEntry[0], monto: mejorSemanaEntry[1] }
      : null,
  };
}

export interface ResultadoSimulacion {
  ventaAdicional: number;
  ivaIncluido: number;
  neto: number;
  ppmAdicional: number;
  reservaAdicional: number;
  restanteAntesDeCostos: number;
}

export function simularVentaAdicional(
  monto: number,
  tasaPpm: number,
  margenPorcentaje: number,
): ResultadoSimulacion {
  const neto = Math.round(monto / (1 + TASA_IVA));
  const ivaIncluido = monto - neto;
  const ppmAdicional = Math.round(neto * tasaPpm);
  const reservaAdicional = Math.round(
    (ivaIncluido + ppmAdicional) * (1 + margenPorcentaje / 100),
  );
  return {
    ventaAdicional: monto,
    ivaIncluido,
    neto,
    ppmAdicional,
    reservaAdicional,
    restanteAntesDeCostos: monto - reservaAdicional,
  };
}
