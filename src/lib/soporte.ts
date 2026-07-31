/**
 * Ayuda y soporte. Módulo puro.
 * Sanitiza cualquier reporte antes de enviarlo: nunca viaja una Clave Tributaria,
 * un token, una cookie ni un cuerpo de autenticación.
 */

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

export const PREGUNTAS_FRECUENTES: PreguntaFrecuente[] = [
  {
    pregunta: "¿Guardan mi Clave Tributaria?",
    respuesta:
      "No. Tu Clave Tributaria se usa solo durante la actualización y no queda almacenada en la aplicación. Nadie del equipo puede verla ni recuperarla.",
  },
  {
    pregunta: "No pude conectarme al SII",
    respuesta:
      "Revisa tu conexión a internet y vuelve a intentar la actualización. Si el problema continúa, repórtalo desde esta misma página.",
  },
  {
    pregunta: "Dice que mi Clave Tributaria es incorrecta",
    respuesta:
      "Vuelve a escribirla con calma o usa el gestor de contraseñas de tu dispositivo. Si la cambiaste en el SII, usa la nueva.",
  },
  {
    pregunta: "Mi sesión venció durante la actualización",
    respuesta:
      "Es normal: la sesión con el SII dura poco. Vuelve a iniciar la actualización; no se pierde la información ya guardada.",
  },
  {
    pregunta: "Aparece información incompleta",
    respuesta:
      "Significa que faltan antecedentes de ese mes. La aplicación te indica exactamente qué falta y muestra un monto mínimo conocido en vez de inventar cifras.",
  },
  {
    pregunta: "No aparece el F29 de un mes",
    respuesta:
      "Puede que aún no esté presentado o que no esté disponible en el SII. Mientras tanto verás una estimación informativa.",
  },
  {
    pregunta: "Actualicé y no consumió actualizaciones",
    respuesta:
      "Cuando la información del mes ya está al día, reutilizamos lo guardado y no pedimos datos otra vez. Eso te ahorra actualizaciones incluidas.",
  },
  {
    pregunta: "¿Cómo contacto al equipo?",
    respuesta:
      "Escríbenos a soporte@minegocioaldia.cl o envía un reporte desde esta página indicando la empresa y el periodo.",
  },
];

export const CORREO_SOPORTE = "soporte@minegocioaldia.cl";

export const CATEGORIAS_SOPORTE = [
  { valor: "conexion", etiqueta: "Problema de conexión" },
  { valor: "clave", etiqueta: "Clave Tributaria incorrecta" },
  { valor: "sesion", etiqueta: "Sesión vencida" },
  { valor: "incompleta", etiqueta: "Información incompleta" },
  { valor: "f29", etiqueta: "F29 no disponible" },
  { valor: "cobro", etiqueta: "Plan o facturación" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

export type CategoriaSoporte = (typeof CATEGORIAS_SOPORTE)[number]["valor"];

/** Palabras que, seguidas de un valor, se eliminan por completo. */
const CLAVES_PROHIBIDAS = [
  "clave",
  "clave tributaria",
  "contrasena",
  "contraseña",
  "password",
  "pass",
  "pwd",
  "token",
  "access_token",
  "refresh_token",
  "bearer",
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "api_key",
  "secret",
];

/**
 * Elimina credenciales, tokens y cuerpos de autenticación de un texto libre.
 * Siempre se aplica antes de guardar o enviar un reporte de soporte.
 */
export function sanitizarTexto(texto: string): string {
  let salida = texto;

  for (const clave of CLAVES_PROHIBIDAS) {
    const re = new RegExp(
      `${clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:=]?\\s*\\S+`,
      "gi",
    );
    salida = salida.replace(re, "[dato omitido por seguridad]");
  }

  // Tokens tipo JWT y cadenas largas sin espacios que parezcan credenciales.
  salida = salida.replace(
    /\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{6,}\b/g,
    "[dato omitido por seguridad]",
  );

  return salida.trim();
}

export interface ReporteSoporte {
  companyId: string | null;
  periodo: string | null;
  categoria: CategoriaSoporte;
  mensaje: string;
  syncRunId: string | null;
  codigoSanitizado: string | null;
  adjunto?: string | null;
}

/** Construye el reporte listo para guardar: sin credenciales de ningún tipo. */
export function prepararReporte(entrada: ReporteSoporte): ReporteSoporte {
  return {
    companyId: entrada.companyId,
    periodo: entrada.periodo,
    categoria: entrada.categoria,
    mensaje: sanitizarTexto(entrada.mensaje).slice(0, 4000),
    syncRunId: entrada.syncRunId,
    codigoSanitizado: entrada.codigoSanitizado
      ? sanitizarTexto(entrada.codigoSanitizado).slice(0, 120)
      : null,
    adjunto: entrada.adjunto ?? null,
  };
}
