/**
 * Invitaciones de usuarios a una empresa. Módulo puro.
 * Un token solo se guarda como huella (hash); nunca en texto plano.
 */

import type { RolEmpresa } from "@/lib/permisos";

export type EstadoInvitacion = "pending" | "accepted" | "revoked" | "expired";

export interface InvitacionEvaluable {
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export type ResultadoInvitacion =
  | { valida: true }
  | { valida: false; motivo: "usada" | "revocada" | "caducada"; mensaje: string };

export const DIAS_VIGENCIA_INVITACION = 7;

export const ROLES_INVITABLES: { valor: RolEmpresa; etiqueta: string; detalle: string }[] = [
  {
    valor: "business_user",
    etiqueta: "Administrador",
    detalle: "Opera la empresa y puede actualizar. No puede transferir la propiedad.",
  },
  {
    valor: "accountant",
    etiqueta: "Contador",
    detalle: "Revisa cálculos y confirma antecedentes. Puede actualizar si lo autorizas.",
  },
  {
    valor: "viewer",
    etiqueta: "Solo lectura",
    detalle: "Ve la información guardada. No puede actualizar ni cambiar configuración.",
  },
];

export function evaluarInvitacion(
  inv: InvitacionEvaluable,
  ahora: Date = new Date(),
): ResultadoInvitacion {
  if (inv.revokedAt || inv.status === "revoked")
    return {
      valida: false,
      motivo: "revocada",
      mensaje: "Esta invitación fue anulada por el propietario de la empresa.",
    };
  if (inv.acceptedAt || inv.status === "accepted")
    return {
      valida: false,
      motivo: "usada",
      mensaje: "Esta invitación ya fue utilizada.",
    };
  if (new Date(inv.expiresAt).getTime() <= ahora.getTime())
    return {
      valida: false,
      motivo: "caducada",
      mensaje: "Esta invitación caducó. Pídele al propietario que te envíe una nueva.",
    };
  return { valida: true };
}

export function fechaCaducidad(desde: Date = new Date()): Date {
  return new Date(desde.getTime() + DIAS_VIGENCIA_INVITACION * 24 * 60 * 60 * 1000);
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}
