/**
 * Contenido editable de la landing pública.
 *
 * Solo textos y visibilidad: no toca el motor tributario, la sincronización
 * ni el dashboard. Los planes y testimonios viven en la base de datos.
 */

export interface ItemTexto {
  titulo: string;
  descripcion: string;
}

export interface ContenidoLanding {
  hero: {
    etiqueta: string;
    titulo: string;
    tituloDestacado: string;
    descripcion: string;
    beneficios: string[];
    botonPrimario: string;
    botonSecundario: string;
    notaPie: string;
  };
  problema: {
    visible: boolean;
    titulo: string;
    descripcion: string;
    items: ItemTexto[];
  };
  testimonios: {
    visible: boolean;
    titulo: string;
    nota: string;
  };
  beneficios: {
    visible: boolean;
    titulo: string;
    items: ItemTexto[];
    sellos: string[];
  };
  planes: {
    visible: boolean;
    titulo: string;
    subtitulo: string;
    nota: string;
    textoBoton: string;
  };
  cierre: {
    visible: boolean;
    titulo: string;
    descripcion: string;
    botonPrimario: string;
    botonSecundario: string;
  };
  footer: {
    descripcion: string;
    soporte: string;
    terminos: string;
    privacidad: string;
    legal: string;
  };
  /** Orden de las secciones intermedias de la landing. */
  orden: SeccionLanding[];
}

export const SECCIONES = [
  "problema",
  "testimonios",
  "beneficios",
  "planes",
  "cierre",
] as const;

export type SeccionLanding = (typeof SECCIONES)[number];

export const ETIQUETA_SECCION: Record<SeccionLanding, string> = {
  problema: "Problema y solución",
  testimonios: "Testimonios",
  beneficios: "Beneficios principales",
  planes: "Planes",
  cierre: "Llamado final",
};

export const CONTENIDO_LANDING_POR_DEFECTO: ContenidoLanding = {
  hero: {
    etiqueta: "Hecho en Chile",
    titulo: "Tus números claros,",
    tituloDestacado: "tu negocio creciendo",
    descripcion:
      "Deja de perder tiempo en el SII. Entiende tus ventas, compras, IVA e impuestos en segundos y toma mejores decisiones.",
    beneficios: [
      "Información actualizada cada mes",
      "Todo en simple y en lenguaje fácil",
      "100% en línea y seguro",
    ],
    botonPrimario: "Ver demo",
    botonSecundario: "Ver planes",
    notaPie: "Tus datos están seguros · Hecho en Chile",
  },
  problema: {
    visible: true,
    titulo: "Entiende tu IVA fácilmente",
    descripcion:
      "Sabemos que llevar un negocio ya es suficiente trabajo. Nosotros ordenamos los números por ti.",
    items: [
      {
        titulo: "Compara mes a mes",
        descripcion:
          "Ve tus ventas, compras e IVA del mes actual y de los anteriores en gráficos simples.",
      },
      {
        titulo: "Calculamos tu IVA",
        descripcion:
          "Estimamos tu IVA del mes para que sepas cuánto podrías pagar o tener a favor.",
      },
      {
        titulo: "Reserva lo correcto",
        descripcion:
          "Te sugerimos cuánto guardar para tus impuestos y llegar tranquilo a fin de mes.",
      },
      {
        titulo: "F29 y RCV claros",
        descripcion:
          "Revisa tus formularios, pagos y créditos de forma simple y ordenada.",
      },
    ],
  },
  testimonios: {
    visible: true,
    titulo: "Nos hizo la vida más fácil",
    nota: "Testimonios de demostración. No corresponden a clientes reales.",
  },
  beneficios: {
    visible: true,
    titulo: "Todo lo que necesitas para llegar tranquilo a fin de mes",
    items: [
      {
        titulo: "Sin entrar al SII",
        descripcion:
          "Revisa tu información del mes desde un solo lugar, sin formularios complicados.",
      },
      {
        titulo: "Decisiones con datos",
        descripcion:
          "Metas de venta, margen y proyecciones para saber cómo vas antes de que termine el mes.",
      },
      {
        titulo: "Menos sorpresas",
        descripcion:
          "Estimaciones informativas del IVA y del PPM para que nada te tome desprevenido.",
      },
    ],
    sellos: [
      "Decisiones basadas en datos reales",
      "Sin entrar al SII",
      "Menos sorpresas, más tranquilidad",
    ],
  },
  planes: {
    visible: true,
    titulo: "Planes simples para cada etapa de tu negocio",
    subtitulo: "Parte gratis y cambia de plan cuando lo necesites.",
    nota: "Cancela cuando quieras. Sin contratos ni permanencias.",
    textoBoton: "Comenzar",
  },
  cierre: {
    visible: true,
    titulo: "Empieza hoy y toma el control de tu negocio",
    descripcion: "Prueba la demostración sin registrarte. Sin tarjeta de crédito.",
    botonPrimario: "Ver demo",
    botonSecundario: "Regístrate gratis",
  },
  footer: {
    descripcion:
      "Mi Negocio al Día es un visor informativo. Las cifras son estimaciones y no reemplazan a tu contador.",
    soporte: "¿Necesitas ayuda? Escríbenos desde la sección de soporte.",
    terminos:
      "Términos: el servicio entrega información estimada con fines de apoyo a la gestión.",
    privacidad:
      "Privacidad: tus datos son tuyos, se usan solo para mostrarte tu información y nunca se comparten con terceros.",
    legal: "Mi Negocio al Día · Hecho en Chile",
  },
  orden: ["problema", "testimonios", "beneficios", "planes", "cierre"],
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Fusiona el contenido guardado con los valores por defecto (tolerante a campos faltantes). */
export function fusionarContenido(parcial: unknown): ContenidoLanding {
  const base = CONTENIDO_LANDING_POR_DEFECTO;
  if (!esObjeto(parcial)) return base;

  const mezcla = <T extends Record<string, unknown>>(
    defecto: T,
    entrada: unknown,
  ): T => {
    if (!esObjeto(entrada)) return defecto;
    const salida: Record<string, unknown> = { ...defecto };
    for (const clave of Object.keys(defecto)) {
      const valor = entrada[clave];
      if (valor === undefined || valor === null) continue;
      const actual = defecto[clave];
      if (Array.isArray(actual)) {
        if (Array.isArray(valor)) salida[clave] = valor;
      } else if (esObjeto(actual)) {
        salida[clave] = mezcla(actual as Record<string, unknown>, valor);
      } else if (typeof valor === typeof actual) {
        salida[clave] = valor;
      }
    }
    return salida as T;
  };

  const fusionado = mezcla(base as unknown as Record<string, unknown>, parcial);
  const contenido = fusionado as unknown as ContenidoLanding;
  const orden = contenido.orden.filter((s): s is SeccionLanding =>
    (SECCIONES as readonly string[]).includes(s),
  );
  const faltantes = SECCIONES.filter((s) => !orden.includes(s));
  return { ...contenido, orden: [...orden, ...faltantes] };
}

export interface PlanPublico {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precioClp: number | null;
  periodicidad: string;
  caracteristicas: string[];
  destacado: boolean;
  publico: boolean;
  activo: boolean;
  orden: number;
}

export interface TestimonioLanding {
  id: string;
  nombre: string;
  rubro: string;
  testimonio: string;
  imagenUrl: string | null;
  orden: number;
  visible: boolean;
  destacado: boolean;
}

export interface LandingPublica {
  contenido: ContenidoLanding;
  planes: PlanPublico[];
  testimonios: TestimonioLanding[];
}

export interface VersionLanding {
  id: string;
  version: number;
  estado: "draft" | "published" | "archived";
  nota: string | null;
  actualizado: string;
}

/** Precio legible para la landing. */
export function precioVisible(plan: PlanPublico): string {
  if (plan.precioClp === null) return "Por confirmar";
  if (plan.precioClp === 0) return "Gratis";
  return `$${plan.precioClp.toLocaleString("es-CL")}`;
}
