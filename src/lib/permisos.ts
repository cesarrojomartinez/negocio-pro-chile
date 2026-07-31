/**
 * Capacidades por rol dentro de una empresa, combinadas con el estado de la cuenta.
 * Módulo puro de presentación y control de acceso en la interfaz.
 * La autoridad final sigue estando en el servidor y en las políticas RLS.
 */

import { permisosPorEstado, type EstadoCuenta } from "@/lib/cuenta";

export type RolEmpresa = "owner" | "business_user" | "accountant" | "viewer";

export const ETIQUETA_ROL: Record<RolEmpresa, string> = {
  owner: "Propietario",
  business_user: "Administrador",
  accountant: "Contador",
  viewer: "Solo lectura",
};

export const DESCRIPCION_ROL: Record<RolEmpresa, string> = {
  owner:
    "Administra la empresa, actualiza la información, gestiona el plan e invita usuarios.",
  business_user:
    "Opera la empresa y puede actualizar. No puede transferir la propiedad.",
  accountant:
    "Revisa cálculos y confirma antecedentes. Puede actualizar si el propietario lo autoriza.",
  viewer:
    "Solo ve la información guardada. No puede actualizar ni cambiar la configuración.",
};

export interface CapacidadesRol {
  verDatos: boolean;
  actualizarProveedor: boolean;
  confirmarAntecedentes: boolean;
  cambiarConfiguracion: boolean;
  invitarUsuarios: boolean;
  gestionarPlan: boolean;
  transferirPropiedad: boolean;
  eliminarCuenta: boolean;
}

const BASE: Record<RolEmpresa, CapacidadesRol> = {
  owner: {
    verDatos: true,
    actualizarProveedor: true,
    confirmarAntecedentes: true,
    cambiarConfiguracion: true,
    invitarUsuarios: true,
    gestionarPlan: true,
    transferirPropiedad: true,
    eliminarCuenta: true,
  },
  business_user: {
    verDatos: true,
    actualizarProveedor: true,
    confirmarAntecedentes: true,
    cambiarConfiguracion: true,
    invitarUsuarios: false,
    gestionarPlan: false,
    transferirPropiedad: false,
    eliminarCuenta: false,
  },
  accountant: {
    verDatos: true,
    actualizarProveedor: false,
    confirmarAntecedentes: true,
    cambiarConfiguracion: false,
    invitarUsuarios: false,
    gestionarPlan: false,
    transferirPropiedad: false,
    eliminarCuenta: false,
  },
  viewer: {
    verDatos: true,
    actualizarProveedor: false,
    confirmarAntecedentes: false,
    cambiarConfiguracion: false,
    invitarUsuarios: false,
    gestionarPlan: false,
    transferirPropiedad: false,
    eliminarCuenta: false,
  },
};

/**
 * @param rol rol del usuario en la empresa
 * @param estado estado comercial de la cuenta
 * @param contadorAutorizado el propietario autorizó al contador a actualizar
 */
export function capacidades(
  rol: RolEmpresa,
  estado: EstadoCuenta = "active",
  contadorAutorizado = false,
): CapacidadesRol {
  const base = { ...BASE[rol] };
  if (rol === "accountant" && contadorAutorizado) base.actualizarProveedor = true;

  const cuenta = permisosPorEstado(estado);
  if (!cuenta.puedeActualizar) base.actualizarProveedor = false;
  if (!cuenta.puedeConfigurar) {
    base.cambiarConfiguracion = false;
    base.invitarUsuarios = false;
    base.confirmarAntecedentes = false;
  }
  return base;
}
