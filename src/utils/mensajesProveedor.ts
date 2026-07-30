/**
 * Mensajes visibles según el proveedor de datos.
 *
 * Solo presentación: no cambia la lógica de conexión ni los cálculos. Evita que
 * textos escritos para el proveedor demostrativo aparezcan cuando la consulta
 * se hizo con API Gateway.
 */
export type ProveedorSii = "mock" | "api_gateway";

/** Severidad visual sugerida para el mensaje. */
export type TonoMensaje = "info" | "warning" | "error" | "success";

const CODIGOS_AUTENTICACION = [
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "AUTH_EXPIRED",
  "ACCOUNT_BLOCKED",
  "NOT_AUTHORIZED",
];

const CODIGOS_PARCIALES = [
  "MALFORMED_RESPONSE",
  "INVALID_PROVIDER_RESPONSE",
  "PARTIAL_DATA",
  "REQUEST_BUDGET_REACHED",
];

export interface EntradaMensajeProveedor {
  proveedor: ProveedorSii;
  codigo?: string | null;
  /** Mensaje original devuelto por el backend, usado como respaldo. */
  mensaje?: string | null;
  /** Verdadero cuando ya se comprobaron RCV y F29 en esta ejecución. */
  productosVerificados?: boolean;
}

export interface MensajeProveedor {
  texto: string;
  tono: TonoMensaje;
}

/** Elimina el vocabulario del proveedor simulado cuando la fuente es real. */
function sinJergaDemo(texto: string): string {
  return texto
    .replace(/demostrativo/gi, "del proveedor autorizado")
    .replace(/demostrativa/gi, "con el proveedor autorizado");
}

export function mensajeProveedor(entrada: EntradaMensajeProveedor): MensajeProveedor {
  const { proveedor, codigo, productosVerificados } = entrada;
  const respaldo = entrada.mensaje?.trim() || "Consulta completada.";

  if (codigo && CODIGOS_AUTENTICACION.includes(codigo)) {
    return {
      texto:
        "No fue posible autenticar la consulta en el SII. Revisa el RUT autorizado y la Clave Tributaria.",
      tono: "error",
    };
  }

  if (codigo === "PERIOD_NOT_AVAILABLE") {
    return {
      texto: "El SII no registra movimientos para el periodo seleccionado.",
      tono: "info",
    };
  }

  if (codigo && CODIGOS_PARCIALES.includes(codigo)) {
    if (proveedor === "mock") {
      return {
        texto:
          "Recibimos información incompleta del proveedor demostrativo y no la usamos.",
        tono: "warning",
      };
    }
    if (!productosVerificados) {
      return {
        texto: "Los productos RCV y F29 todavía no fueron verificados en esta ejecución.",
        tono: "info",
      };
    }
    return {
      texto:
        "API Gateway entregó información parcial. Conservamos los datos válidos y omitimos los campos incompletos.",
      tono: "warning",
    };
  }

  return {
    texto: proveedor === "api_gateway" ? sinJergaDemo(respaldo) : respaldo,
    tono: codigo ? "error" : "success",
  };
}
