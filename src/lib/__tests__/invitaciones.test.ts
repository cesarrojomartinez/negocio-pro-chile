import { describe, expect, it } from "vitest";

import { correoValido, evaluarInvitacion, fechaCaducidad } from "@/lib/invitaciones";

const ahora = new Date("2026-07-31T12:00:00Z");

describe("evaluarInvitacion", () => {
  it("acepta una invitación vigente", () => {
    const r = evaluarInvitacion(
      {
        status: "pending",
        expiresAt: "2026-08-05T12:00:00Z",
        acceptedAt: null,
        revokedAt: null,
      },
      ahora,
    );
    expect(r.valida).toBe(true);
  });

  it("rechaza una invitación caducada", () => {
    const r = evaluarInvitacion(
      {
        status: "pending",
        expiresAt: "2026-07-30T12:00:00Z",
        acceptedAt: null,
        revokedAt: null,
      },
      ahora,
    );
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motivo).toBe("caducada");
  });

  it("es de un solo uso", () => {
    const r = evaluarInvitacion(
      {
        status: "accepted",
        expiresAt: "2026-08-05T12:00:00Z",
        acceptedAt: "2026-07-30T10:00:00Z",
        revokedAt: null,
      },
      ahora,
    );
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motivo).toBe("usada");
  });

  it("respeta la revocación del propietario", () => {
    const r = evaluarInvitacion(
      {
        status: "revoked",
        expiresAt: "2026-08-05T12:00:00Z",
        acceptedAt: null,
        revokedAt: "2026-07-30T10:00:00Z",
      },
      ahora,
    );
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motivo).toBe("revocada");
  });
});

describe("fechaCaducidad", () => {
  it("caduca a los 7 días", () => {
    expect(fechaCaducidad(ahora).toISOString()).toBe("2026-08-07T12:00:00.000Z");
  });
});

describe("correoValido", () => {
  it("valida correos razonables", () => {
    expect(correoValido("contador@estudio.cl")).toBe(true);
    expect(correoValido("sin-arroba")).toBe(false);
    expect(correoValido("a@b")).toBe(false);
  });
});
