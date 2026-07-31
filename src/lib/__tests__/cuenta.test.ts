import { describe, expect, it } from "vitest";

import {
  evaluarLimiteActualizaciones,
  permisosPorEstado,
  mesActualChile,
} from "@/lib/cuenta";

describe("permisosPorEstado", () => {
  it("una cuenta activa puede actualizar y configurar", () => {
    const p = permisosPorEstado("active");
    expect(p.puedeActualizar).toBe(true);
    expect(p.puedeConfigurar).toBe(true);
  });

  it("una cuenta suspendida conserva lectura pero no puede consultar", () => {
    const p = permisosPorEstado("suspended");
    expect(p.puedeLeer).toBe(true);
    expect(p.puedeActualizar).toBe(false);
    expect(p.puedeReactivar).toBe(true);
  });

  it("una cuenta cancelada mantiene el historial visible", () => {
    const p = permisosPorEstado("cancelled");
    expect(p.puedeLeer).toBe(true);
    expect(p.puedeActualizar).toBe(false);
  });

  it("un pago pendiente no bloquea de inmediato", () => {
    expect(permisosPorEstado("payment_pending").puedeActualizar).toBe(true);
  });
});

describe("evaluarLimiteActualizaciones", () => {
  const base = { incluidas: 6, usadas: 2, mesUso: "2026-07", mesActual: "2026-07" };

  it("permite mientras quedan actualizaciones incluidas", () => {
    const r = evaluarLimiteActualizaciones({ estado: "active", ...base });
    expect(r.permitido).toBe(true);
    expect(r.restantes).toBe(4);
    expect(r.titulo).toBe("Actualizaciones incluidas este mes");
  });

  it("bloquea al alcanzar el límite mensual", () => {
    const r = evaluarLimiteActualizaciones({
      estado: "active",
      ...base,
      usadas: 6,
    });
    expect(r.permitido).toBe(false);
    expect(r.titulo).toBe("Has alcanzado el límite de actualizaciones");
    expect(r.mensaje).toContain("Tu información guardada continúa disponible");
  });

  it("reinicia el contador al cambiar de mes", () => {
    const r = evaluarLimiteActualizaciones({
      estado: "active",
      ...base,
      usadas: 6,
      mesUso: "2026-06",
      mesActual: "2026-07",
    });
    expect(r.permitido).toBe(true);
    expect(r.usadas).toBe(0);
  });

  it("una empresa suspendida no puede actualizar aunque le queden incluidas", () => {
    const r = evaluarLimiteActualizaciones({ estado: "suspended", ...base });
    expect(r.permitido).toBe(false);
    expect(r.mensaje).toContain("continúa disponible");
  });

  it("nunca menciona créditos técnicos", () => {
    const textos = (["trial", "active", "suspended", "cancelled"] as const).flatMap(
      (estado) => {
        const r = evaluarLimiteActualizaciones({ estado, ...base });
        return [r.titulo, r.mensaje];
      },
    );
    for (const t of textos) expect(t.toLowerCase()).not.toContain("crédito");
  });
});

describe("mesActualChile", () => {
  it("entrega el mes en formato AAAA-MM", () => {
    expect(mesActualChile(new Date("2026-03-15T12:00:00Z"))).toBe("2026-03");
  });
});
