const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

export function formatCLP(valor: number): string {
  return clp.format(Math.round(valor || 0)).replace(/\s/g, "");
}

export function formatCLPSigned(valor: number): string {
  const v = Math.round(valor || 0);
  return (v > 0 ? "+" : "") + formatCLP(v);
}

export function formatNumero(valor: number): string {
  return numero.format(Math.round(valor || 0));
}

export function formatPorcentaje(valor: number | null, decimales = 1): string {
  if (valor === null || Number.isNaN(valor)) return "Sin información comparable";
  return `${valor.toLocaleString("es-CL", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}%`;
}

export function formatVariacion(valor: number | null): string {
  if (valor === null || Number.isNaN(valor)) return "Sin información comparable";
  if (Math.abs(valor) < 0.05) return "Sin variación";
  const signo = valor > 0 ? "+" : "−";
  return `${signo}${Math.abs(valor).toLocaleString("es-CL", {
    maximumFractionDigits: 1,
  })}%`;
}

export function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatFechaHora(iso: string | null): string {
  if (!iso) return "Sin sincronizar";
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseMonto(texto: string): number {
  const limpio = texto.replace(/[^\d]/g, "");
  return limpio ? parseInt(limpio, 10) : 0;
}
