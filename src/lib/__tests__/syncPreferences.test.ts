import { describe, expect, it } from "vitest";

import {
  PREFERENCIAS_POR_DEFECTO,
  evaluarPresupuesto,
  evaluarRecordatorio,
  puedeActivarAutomatizacion,
  referenciaAutorizacionEsSegura,
  type SyncPreferences,
} from "@/lib/syncPreferences";

const base: SyncPreferences = { ...PREFERENCIAS_POR_DEFECTO, companyId: "e1" };

describe("preferencias de sincronización", () => {
  it("por defecto: modo seguro, automatización no disponible, recordatorio activo", () => {
    expect(base.syncMode).toBe("manual_secure");
    expect(base.automationStatus).toBe("unavailable");
    expect(base.authorizationMethod).toBe("none");
    expect(base.reminderEnabled).toBe(true);
  });

  it("no permite activar la automatización sin método verificado", () => {
    expect(puedeActivarAutomatizacion(base)).toBe(false);
    expect(
      puedeActivarAutomatizacion({
        ...base,
        authorizationMethod: "digital_mandate",
        authorizationReference: "ref-opaca-123",
      }),
    ).toBe(true);
  });

  it("rechaza referencias que parezcan credenciales", () => {
    expect(referenciaAutorizacionEsSegura("ref-opaca-123")).toBe(true);
    expect(referenciaAutorizacionEsSegura("clave: 1234")).toBe(false);
    expect(referenciaAutorizacionEsSegura("mi_password")).toBe(false);
    expect(referenciaAutorizacionEsSegura("clave_tributaria")).toBe(false);
    expect(referenciaAutorizacionEsSegura("x".repeat(201))).toBe(false);
  });
});

describe("recordatorios", () => {
  const ahora = new Date("2026-08-02T14:00:00.000Z"); // día 2 en Chile

  it("avisa al inicio del mes", () => {
    const r = evaluarRecordatorio({
      ahora,
      ultimaSincronizacion: "2026-07-05T12:00:00.000Z",
      preferencias: base,
    });
    expect(r.estado).toBe("due");
    expect(r.mensaje).toContain("Ya puedes actualizar");
  });

  it("no avisa si ya se sincronizó hoy", () => {
    const r = evaluarRecordatorio({
      ahora,
      ultimaSincronizacion: "2026-08-02T09:00:00.000Z",
      preferencias: base,
    });
    expect(r.estado).toBe("completed");
    expect(r.mensaje).toBeNull();
  });

  it("no repite el aviso todos los días", () => {
    const r = evaluarRecordatorio({
      ahora,
      ultimaSincronizacion: null,
      preferencias: { ...base, lastReminderAt: "2026-08-01T14:00:00.000Z" },
    });
    expect(r.estado).toBe("scheduled");
    expect(r.mensaje).toBeNull();
  });

  it("respeta el descarte del usuario", () => {
    const r = evaluarRecordatorio({
      ahora,
      ultimaSincronizacion: null,
      preferencias: { ...base, reminderDismissedAt: "2026-08-01T14:00:00.000Z" },
    });
    expect(r.estado).toBe("dismissed");
  });

  it("vuelve a avisar cuando puede existir el F29 del mes anterior", () => {
    const r = evaluarRecordatorio({
      ahora: new Date("2026-08-12T14:00:00.000Z"),
      ultimaSincronizacion: "2026-08-01T12:00:00.000Z",
      preferencias: base,
    });
    expect(r.estado).toBe("due");
  });

  it("queda deshabilitado si el usuario lo apaga", () => {
    const r = evaluarRecordatorio({
      ahora,
      ultimaSincronizacion: null,
      preferencias: { ...base, reminderEnabled: false },
    });
    expect(r.estado).toBe("disabled");
  });
});

describe("presupuesto interno de créditos", () => {
  it("sin presupuesto configurado no bloquea", () => {
    expect(evaluarPresupuesto(base).estado).toBe("sin_limite");
  });

  it("advierte al 80% y bloquea al 100%", () => {
    const p = { ...base, monthlyCreditBudget: 10 };
    expect(evaluarPresupuesto({ ...p, creditsUsedCurrentMonth: 5 }).estado).toBe(
      "normal",
    );
    expect(evaluarPresupuesto({ ...p, creditsUsedCurrentMonth: 8 }).estado).toBe(
      "advertencia",
    );
    expect(evaluarPresupuesto({ ...p, creditsUsedCurrentMonth: 10 }).estado).toBe(
      "bloqueado",
    );
  });
});
