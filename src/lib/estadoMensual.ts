/**
 * Estado mensual visible para el cliente (Etapa 7).
 *
 * Función pura de presentación: traduce el resumen ya calculado y su contexto
 * tributario a UN solo estado del mes, con el monto principal, el texto que lo
 * explica y la acción recomendada. No calcula impuestos ni crea reglas nuevas:
 * solo decide qué mostrar con lo que el motor ya entregó.
 */
import type { ContextoTributario } from "@/lib/taxContext";
import { estadoDelPeriodo } from "@/utils/taxCalculations";
import type { FuentePeriodo, ResumenMensual } from "@/types/tax";

export type EstadoMensual =
  | "reserva_recomendada"
  | "declaracion_pendiente"
  | "total_declarado"
  | "total_pagado"
  | "dinero_a_favor"
  | "sin_monto_por_pagar"
  | "estimacion_incompleta";

export type TonoEstado = "primary" | "success" | "warning" | "neutral";

export interface EntradaEstadoMensual {
  resumen: ResumenMensual;
  contexto?: ContextoTributario;
  fuentePeriodo?: FuentePeriodo;
  /** El pago del F29 fue confirmado por la persona o su contador. */
  pagoConfirmado?: boolean;
  /** Instante de referencia (permite pruebas deterministas). */
  ahora?: Date;
}

export interface ResultadoEstadoMensual {
  estado: EstadoMensual;
  titulo: string;
  /** Monto principal de la tarjeta. */
  monto: number;
  etiquetaMonto: string;
  mensaje: string;
  tono: TonoEstado;
  /** Acción concreta sugerida para este mes. */
  accion: string;
  /** De dónde vienen las cifras mostradas. */
  origen: string;
  /** Antecedentes que faltan por confirmar, si los hay. */
  faltantes: string[];
}

const ORIGEN: Record<FuentePeriodo, string> = {
  mock: "Datos simulados para pruebas. No corresponden a información obtenida del SII.",
  rcv_real: "Calculado con tus documentos del Registro de Compras y Ventas.",
  accountant_confirmed: "Calculado con los antecedentes confirmados por tu contador.",
  rcv_real_plus_accountant:
    "Calculado con tus documentos del RCV y los antecedentes confirmados por tu contador.",
  not_synchronized: "Este periodo todavía no tiene información actualizada.",
};

export function resolverEstadoMensual(
  entrada: EntradaEstadoMensual,
): ResultadoEstadoMensual {
  const { resumen, contexto } = entrada;
  const ahora = entrada.ahora ?? new Date();
  const declarado = contexto?.declared_tax_total ?? null;
  const incompleto = contexto?.calculation_status === "incomplete";
  const remanente = Math.max(0, resumen.nuevoRemanente ?? 0);
  const total = Math.max(0, resumen.totalTributarioEstimado ?? 0);
  const mesTerminado = estadoDelPeriodo(resumen.periodo, ahora) === "closed";
  const origen = ORIGEN[entrada.fuentePeriodo ?? "rcv_real"];
  const faltantes = (contexto?.missing_components ?? []).map((c) => c.detalle);

  // D — el pago ya está confirmado: manda sobre cualquier otro estado.
  if (declarado != null && entrada.pagoConfirmado) {
    return {
      estado: "total_pagado",
      titulo: "Total pagado del mes",
      monto: declarado,
      etiquetaMonto: "Pagado según el Formulario 29",
      mensaje: "Este mes ya está declarado y pagado. No queda nada por hacer.",
      tono: "success",
      accion: "Guarda el comprobante de pago junto al Formulario 29 del mes.",
      origen,
      faltantes: [],
    };
  }

  // C — hay Formulario 29 presentado para el periodo.
  if (declarado != null) {
    return {
      estado: "total_declarado",
      titulo: declarado > 0 ? "Total declarado del mes" : "Mes declarado sin pago",
      monto: declarado,
      etiquetaMonto: "Declarado en el Formulario 29",
      mensaje:
        declarado > 0
          ? "Este es el total a pagar que quedó en el Formulario 29 del periodo."
          : "El Formulario 29 de este periodo quedó en $0 a pagar.",
      tono: declarado > 0 ? "primary" : "success",
      accion:
        declarado > 0
          ? "Confirma con tu contador que el pago del Formulario 29 ya fue realizado."
          : "No hay pago asociado a este mes. Solo guarda el formulario.",
      origen,
      faltantes,
    };
  }

  // G — faltan antecedentes: el monto mostrado es un mínimo conocido.
  if (incompleto) {
    return {
      estado: "estimacion_incompleta",
      titulo: "Estimación incompleta",
      monto: resumen.reservaRecomendada,
      etiquetaMonto: "Monto mínimo conocido",
      mensaje:
        "Faltan antecedentes por confirmar, así que esta cifra podría aumentar cuando se completen.",
      tono: "warning",
      accion:
        "Actualiza el periodo o pide a tu contador confirmar los antecedentes que faltan.",
      origen,
      faltantes,
    };
  }

  // E — no hay impuestos por pagar y quedó crédito para el mes siguiente.
  if (total <= 0 && remanente > 0) {
    return {
      estado: "dinero_a_favor",
      titulo: "Dinero a tu favor",
      monto: remanente,
      etiquetaMonto: "Remanente de IVA para el próximo mes",
      mensaje:
        "Con la información de este mes no habría impuestos por pagar y te queda crédito de IVA.",
      tono: "success",
      accion: "No necesitas reservar dinero este mes.",
      origen,
      faltantes,
    };
  }

  // F — nada por pagar y sin crédito acumulado.
  if (total <= 0) {
    return {
      estado: "sin_monto_por_pagar",
      titulo: "Sin monto por pagar",
      monto: 0,
      etiquetaMonto: "Estimación del mes",
      mensaje: "Con la información de este mes no habría impuestos por pagar.",
      tono: "success",
      accion: "Revisa que todos tus documentos del mes estén informados.",
      origen,
      faltantes,
    };
  }

  // B — el mes ya terminó y todavía no hay Formulario 29.
  if (mesTerminado) {
    return {
      estado: "declaracion_pendiente",
      titulo: "Declaración pendiente",
      monto: total,
      etiquetaMonto: "Total tributario estimado del mes",
      mensaje:
        "Este mes ya terminó y aún no registramos su Formulario 29. La cifra sigue siendo una estimación.",
      tono: "warning",
      accion:
        "Presenta o confirma el Formulario 29 de este periodo con tu contador.",
      origen,
      faltantes,
    };
  }

  // A — mes en curso: lo relevante es cuánto conviene reservar.
  return {
    estado: "reserva_recomendada",
    titulo: "Reserva recomendada",
    monto: resumen.reservaRecomendada,
    etiquetaMonto: "Dinero que conviene mantener separado",
    mensaje:
      "Incluye tus impuestos estimados del mes más un margen preventivo. Es una estimación informativa.",
    tono: "primary",
    accion:
      resumen.dineroReservado >= resumen.reservaRecomendada
        ? "Ya tienes cubierta la reserva de este mes."
        : "Separa el monto que te falta para llegar a la reserva recomendada.",
    origen,
    faltantes,
  };
}
