import { describe, expect, it } from "vitest";

import { capacidades } from "@/lib/permisos";

describe("capacidades por rol", () => {
  it("el propietario administra todo", () => {
    const c = capacidades("owner");
    expect(c.invitarUsuarios).toBe(true);
    expect(c.gestionarPlan).toBe(true);
    expect(c.transferirPropiedad).toBe(true);
    expect(c.eliminarCuenta).toBe(true);
  });

  it("el administrador opera pero no transfiere la propiedad", () => {
    const c = capacidades("business_user");
    expect(c.actualizarProveedor).toBe(true);
    expect(c.transferirPropiedad).toBe(false);
    expect(c.gestionarPlan).toBe(false);
  });

  it("el contador revisa y confirma, y solo actualiza si está autorizado", () => {
    expect(capacidades("accountant").actualizarProveedor).toBe(false);
    expect(capacidades("accountant").confirmarAntecedentes).toBe(true);
    expect(capacidades("accountant", "active", true).actualizarProveedor).toBe(true);
  });

  it("lectura no puede llamar al proveedor ni cambiar configuración", () => {
    const c = capacidades("viewer");
    expect(c.verDatos).toBe(true);
    expect(c.actualizarProveedor).toBe(false);
    expect(c.cambiarConfiguracion).toBe(false);
  });

  it("una cuenta suspendida bloquea la actualización de cualquier rol", () => {
    expect(capacidades("owner", "suspended").actualizarProveedor).toBe(false);
    expect(capacidades("business_user", "suspended").actualizarProveedor).toBe(false);
    expect(capacidades("accountant", "suspended", true).actualizarProveedor).toBe(false);
    expect(capacidades("owner", "suspended").verDatos).toBe(true);
  });
});
