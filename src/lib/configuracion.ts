/**
 * Tipos y estructuras de datos para el Centro de Configuración Global MASTER 2.0.
 * Organizado en 10 grupos temáticos sin alterar el motor tributario ni la seguridad.
 */

export interface ConfiguracionPlataforma {
  nombreComercial: string;
  logoUrl: string;
  logoOscuroUrl: string;
  faviconUrl: string;
  descripcion: string;
  correoSoporte: string;
  correoComercial: string;
  telefono: string;
  whatsapp: string;
  redesSociales: {
    linkedin: string;
    instagram: string;
    twitter: string;
    facebook: string;
  };
  modoMantenimiento: boolean;
  mensajeMantenimiento: string;
  versionActual: string;
  fechaDespliegue: string;
}

export interface ConfiguracionLanding {
  hero: {
    etiqueta: string;
    titulo: string;
    tituloDestacado: string;
    descripcion: string;
    botonPrimario: string;
    botonSecundario: string;
    videoDemoUrl: string;
    imagenHeroUrl: string;
  };
  caracteristicas: Array<{ titulo: string; descripcion: string }>;
  beneficios: Array<{ titulo: string; descripcion: string }>;
  faq: Array<{ pregunta: string; respuesta: string }>;
  footer: {
    descripcion: string;
    soporte: string;
    terminos: string;
    privacidad: string;
    legal: string;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string;
    openGraphImageUrl: string;
  };
}

export interface ConfiguracionBranding {
  colores: {
    primario: string;
    secundario: string;
    exito: string;
    advertencia: string;
    error: string;
  };
  tipografia: string;
  radioBordes: string;
  sombras: string;
  logoLoginUrl: string;
  logoDashboardUrl: string;
}

export interface ConfiguracionComercial {
  moneda: string;
  ivaPorDefecto: number;
  diasTrial: number;
  planPorDefecto: string;
  promocionActiva: boolean;
  codigoDescuento: string;
  valorDescuentoPorcentaje: number;
  fechaInicioPromocion: string;
  fechaTerminoPromocion: string;
}

export interface ConfiguracionGatewayApi {
  proveedorActual: string;
  estado: "operativo" | "degradado" | "mantenimiento" | "error";
  versionGateway: string;
  costoPorLlamadaClp: number;
  costoPromedioMensualClp: number;
  ultimaActualizacion: string;
  consumoDiarioLlamadas: number;
  consumoMensualLlamadas: number;
}

export interface ConfiguracionIaGateway {
  proveedor: string;
  modelo: string;
  costoEntradaPorMilTokensClp: number;
  costoSalidaPorMilTokensClp: number;
  margenPlataformaMultiplicador: number;
  costoPromedioConsultaClp: number;
  consumoMensualCreditos: number;
}

export interface PlantillaCorreo {
  asunto: string;
  cuerpoHtml: string;
  activado: boolean;
}

export interface ConfiguracionCorreos {
  bienvenida: PlantillaCorreo;
  invitacion: PlantillaCorreo;
  recuperacionPassword: PlantillaCorreo;
  pagoRecibido: PlantillaCorreo;
  pagoRechazado: PlantillaCorreo;
  suspension: PlantillaCorreo;
  renovacion: PlantillaCorreo;
  finTrial: PlantillaCorreo;
}

export interface CanalNotificacion {
  activo: boolean;
  prioridad: "alta" | "media" | "baja";
  destino?: string;
}

export interface ConfiguracionNotificaciones {
  email: CanalNotificacion;
  popup: CanalNotificacion;
  banner: CanalNotificacion;
  push: CanalNotificacion;
  webhook: CanalNotificacion;
}

export interface ConfiguracionSeguridad {
  timeoutSesionMinutos: number;
  maxIntentosLogin: number;
  longitudMinimaPassword: number;
  exigirDosFactoresAdmin: boolean;
  politicaContrasenasFormato: string;
}

export interface ConfiguracionSistema {
  versionPlataforma: string;
  ultimoDeploy: string;
  estadoBD: "saludable" | "degradado" | "error";
  estadoGateway: "saludable" | "degradado" | "error";
  estadoIA: "saludable" | "degradado" | "error";
  estadoLanding: "publicada" | "borrador";
  estadoMotor: "normal" | "modo_espejo" | "sombra";
  usoDiscoMb: number;
  usoAlmacenamientoMb: number;
  usuariosConectadosAhora: number;
}

export type GrupoConfiguracion =
  | "plataforma"
  | "landing"
  | "branding"
  | "comercial"
  | "gateway_api"
  | "ia_gateway"
  | "correos"
  | "notificaciones"
  | "seguridad"
  | "sistema";

export interface ConfiguracionGlobal {
  plataforma: ConfiguracionPlataforma;
  landing: ConfiguracionLanding;
  branding: ConfiguracionBranding;
  comercial: ConfiguracionComercial;
  gateway_api: ConfiguracionGatewayApi;
  ia_gateway: ConfiguracionIaGateway;
  correos: ConfiguracionCorreos;
  notificaciones: ConfiguracionNotificaciones;
  seguridad: ConfiguracionSeguridad;
  sistema: ConfiguracionSistema;
}

export interface RegistroHistorialConfig {
  id: string;
  usuarioEmail: string;
  grupo: string;
  accion: string;
  fecha: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
}

export const CONFIGURACION_POR_DEFECTO: ConfiguracionGlobal = {
  plataforma: {
    nombreComercial: "Mi Negocio al Día",
    logoUrl: "/brand/logo-light.svg",
    logoOscuroUrl: "/brand/logo-dark.svg",
    faviconUrl: "/favicon.ico",
    descripcion: "Plataforma de inteligencia financiera e impuestos F29/SII para PyMEs en Chile.",
    correoSoporte: "soporte@minegocioaldia.cl",
    correoComercial: "contacto@minegocioaldia.cl",
    telefono: "+56 9 8765 4321",
    whatsapp: "+56 9 8765 4321",
    redesSociales: {
      linkedin: "https://linkedin.com/company/minegocioaldia",
      instagram: "https://instagram.com/minegocioaldia",
      twitter: "https://twitter.com/minegocioaldia",
      facebook: "https://facebook.com/minegocioaldia",
    },
    modoMantenimiento: false,
    mensajeMantenimiento: "Estamos realizando mejoras programadas. Volveremos en breve.",
    versionActual: "v2.5.0-MASTER",
    fechaDespliegue: "2026-08-01 12:00:00 UTC",
  },
  landing: {
    hero: {
      etiqueta: "Plataforma SaaS Chile 2026",
      titulo: "Tus números claros,",
      tituloDestacado: "tu negocio creciendo",
      descripcion: "Visualiza ventas, anticipa tu IVA F29 y calcula tu reserva mensual sin sorpresas.",
      botonPrimario: "Demostración Interactiva",
      botonSecundario: "Planes y Tarifas",
      videoDemoUrl: "https://youtube.com/watch?v=demo",
      imagenHeroUrl: "/assets/hero-dashboard.png",
    },
    caracteristicas: [
      { titulo: "Cálculo F29 Espejo", descripcion: "Paridad completa con los formularios oficiales del SII." },
      { titulo: "Consumo Inteligente IA", descripcion: "Análisis financiero automático de documentos DTE." },
    ],
    beneficios: [
      { titulo: "Información Actualizada", descripcion: "Sincronizaciones diarias automáticas sin ingresar claves." },
      { titulo: "Reportes Ejecutivos", descripcion: "Descarga informes y resúmenes para tu contador en 1 clic." },
    ],
    faq: [
      { pregunta: "¿Se conecta directo con el SII?", respuesta: "Sí, a través de nuestro Gateway Oficial seguro." },
      { pregunta: "¿Necesito tarjeta para probar?", respuesta: "No, la demo es gratuita y sin compromiso." },
    ],
    footer: {
      descripcion: "Mi Negocio al Día es una solución tecnológica informativa de gestión tributaria.",
      soporte: "Atención personalizada de Lunes a Viernes de 9:00 a 18:00 hrs.",
      terminos: "Términos del servicio y acuerdos de nivel de servicio SLA.",
      privacidad: "Tratamiento de datos personales según la Ley 19.628 de Chile.",
      legal: "© 2026 Mi Negocio al Día · Todos los derechos reservados.",
    },
    seo: {
      metaTitle: "Mi Negocio al Día | Gestión Tributaria e Impuestos F29 Chile",
      metaDescription: "Anticipa tu IVA, controla tus ventas y gestiona tus impuestos SII sin complicaciones.",
      keywords: "IVA, F29, SII, impuestos, pyme, chile, contabilidad, facturas, dte",
      openGraphImageUrl: "https://minegocioaldia.cl/og-image.jpg",
    },
  },
  branding: {
    colores: {
      primario: "#0D9488",
      secundario: "#0F172A",
      exito: "#10B981",
      advertencia: "#F59E0B",
      error: "#EF4444",
    },
    tipografia: "Inter, system-ui, sans-serif",
    radioBordes: "0.75rem",
    sombras: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    logoLoginUrl: "/brand/logo-login.png",
    logoDashboardUrl: "/brand/logo-dashboard.png",
  },
  comercial: {
    moneda: "CLP",
    ivaPorDefecto: 19,
    diasTrial: 14,
    planPorDefecto: "pro",
    promocionActiva: false,
    codigoDescuento: "LANZAMIENTO2026",
    valorDescuentoPorcentaje: 20,
    fechaInicioPromocion: "2026-08-01",
    fechaTerminoPromocion: "2026-08-31",
  },
  gateway_api: {
    proveedorActual: "SII Gateway Core (Dual Engine v2.4)",
    estado: "operativo",
    versionGateway: "v2.4.12",
    costoPorLlamadaClp: 0.004,
    costoPromedioMensualClp: 18400,
    ultimaActualizacion: "2026-08-02 20:30:00",
    consumoDiarioLlamadas: 1420,
    consumoMensualLlamadas: 42600,
  },
  ia_gateway: {
    proveedor: "Google Gemini 2.5 Flash / Anthropic Claude 3.5",
    modelo: "gemini-2.5-flash",
    costoEntradaPorMilTokensClp: 0.15,
    costoSalidaPorMilTokensClp: 0.45,
    margenPlataformaMultiplicador: 1.3,
    costoPromedioConsultaClp: 12.5,
    consumoMensualCreditos: 18500,
  },
  correos: {
    bienvenida: { asunto: "¡Bienvenido a Mi Negocio al Día!", cuerpoHtml: "Hola {{nombre}}, tu cuenta está lista.", activado: true },
    invitacion: { asunto: "Te han invitado a colaborar en {{empresa}}", cuerpoHtml: "Acepta la invitación aquí.", activado: true },
    recuperacionPassword: { asunto: "Instrucciones para restablecer tu contraseña", cuerpoHtml: "Haz clic en el enlace para cambiar la clave.", activado: true },
    pagoRecibido: { asunto: "Comprobante de Pago Recibido - {{factura}}", cuerpoHtml: "Gracias por tu pago.", activado: true },
    pagoRechazado: { asunto: "Aviso de Pago No Procesado", cuerpoHtml: "Tu tarjeta o transferencia no pudo completarse.", activado: true },
    suspension: { asunto: "Notificación de Suspensión de Servicio", cuerpoHtml: "Tu cuenta ha sido pausada temporalmente.", activado: true },
    renovacion: { asunto: "Tu suscripción ha sido renovada con éxito", cuerpoHtml: "Se ha cargado el período actual.", activado: true },
    finTrial: { asunto: "Tu período de prueba está por finalizar", cuerpoHtml: "Elige un plan para continuar sin interrupciones.", activado: true },
  },
  notificaciones: {
    email: { activo: true, prioridad: "alta" },
    popup: { activo: true, prioridad: "media" },
    banner: { activo: true, prioridad: "media" },
    push: { activo: false, prioridad: "baja" },
    webhook: { activo: false, prioridad: "alta", destino: "https://api.minegocioaldia.cl/webhooks/events" },
  },
  seguridad: {
    timeoutSesionMinutos: 60,
    maxIntentosLogin: 5,
    longitudMinimaPassword: 8,
    exigirDosFactoresAdmin: false,
    politicaContrasenasFormato: "Alfanumérico con al menos 1 número y 8 caracteres.",
  },
  sistema: {
    versionPlataforma: "v2.5.0-MASTER",
    ultimoDeploy: "2026-08-02 18:45:00 UTC",
    estadoBD: "saludable",
    estadoGateway: "saludable",
    estadoIA: "saludable",
    estadoLanding: "publicada",
    estadoMotor: "normal",
    usoDiscoMb: 1240,
    usoAlmacenamientoMb: 4850,
    usuariosConectadosAhora: 42,
  },
};
