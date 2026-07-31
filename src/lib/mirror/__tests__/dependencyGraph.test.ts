import { describe, expect, it } from "vitest";

import {
  DependencyGraphError,
  dependenciasDe,
  ordenTopologico,
  propagarEstado,
  TAX_DEPENDENCY_GRAPH,
} from "../dependencyGraph";
import { esConceptoRegistrado, TAX_CONCEPT_REGISTRY } from "../conceptRegistry";
import { VERSIONED_TAX_RULES } from "../rules";
import type { ComponentStatus, MirrorConcept } from "../types";

describe("grafo de dependencias tributarias", () => {
  it("no tiene ciclos y ordena las dependencias antes que sus consumidores", () => {
    const orden = ordenTopologico();
    const posicion = new Map(orden.map((c, i) => [c, i]));
    for (const nodo of TAX_DEPENDENCY_GRAPH) {
      for (const dep of [...nodo.requires, ...nodo.optional]) {
        expect(posicion.get(dep)!).toBeLessThan(posicion.get(nodo.concept)!);
      }
    }
  });

  it("detecta ciclos", () => {
    expect(() =>
      ordenTopologico([
        { concept: "vat_debit", requires: ["vat_determined"], optional: [] },
        { concept: "vat_determined", requires: ["vat_debit"], optional: [] },
      ]),
    ).toThrow(DependencyGraphError);
  });

  it("detecta una dependencia no declarada", () => {
    expect(() =>
      ordenTopologico([
        { concept: "ppm_amount", requires: ["ppm_base"], optional: [] },
      ]),
    ).toThrow(/no declarada/);
  });

  it("cada concepto del grafo está en el registro único", () => {
    for (const nodo of TAX_DEPENDENCY_GRAPH) {
      expect(esConceptoRegistrado(nodo.concept)).toBe(true);
    }
    expect(TAX_DEPENDENCY_GRAPH.length).toBe(TAX_CONCEPT_REGISTRY.length);
  });

  it("toda regla versionada declara sus dependencias", () => {
    for (const regla of VERSIONED_TAX_RULES) {
      expect(dependenciasDe(regla.concept)).not.toBeNull();
    }
  });

  it("no existen dos reglas activas para el mismo concepto y periodo", () => {
    const periodo = "2026-06";
    const vistos = new Map<MirrorConcept, string>();
    for (const r of VERSIONED_TAX_RULES) {
      if (periodo < r.validFrom) continue;
      if (r.validTo && periodo > r.validTo) continue;
      expect(vistos.has(r.concept)).toBe(false);
      vistos.set(r.concept, r.ruleId);
    }
  });

  const resueltos = (
    entradas: [MirrorConcept, number | null, ComponentStatus][],
  ) => ({
    resueltos: new Map(
      entradas.map(([c, amount, status]) => [c, { amount, status }]),
    ),
  });

  it("bloquea un componente cuando falta una dependencia obligatoria", () => {
    const r = propagarEstado(
      "ppm_amount",
      resueltos([
        ["ppm_base", 1000, "estimated"],
        ["ppm_rate", null, "unavailable"],
      ]),
    );
    expect(r.bloqueadoPor).toEqual(["ppm_rate"]);
    expect(r.estadoPropagado).toBe("unavailable");
  });

  it("una dependencia opcional ausente degrada pero no bloquea", () => {
    const r = propagarEstado(
      "recoverable_vat_credit",
      resueltos([
        ["vat_total_purchases", 500, "official"],
        ["vat_common_use", null, "unavailable"],
      ]),
    );
    expect(r.bloqueadoPor).toEqual([]);
    expect(r.degradadoPor).toContain("vat_common_use");
    expect(r.estadoPropagado).toBeNull();
  });

  it("propaga requires_confirmation y unsupported", () => {
    expect(
      propagarEstado(
        "tax_total_before_surcharges",
        resueltos([
          ["vat_determined", null, "requires_confirmation"],
          ["ppm_amount", 100, "estimated"],
        ]),
      ).estadoPropagado,
    ).toBe("requires_confirmation");

    expect(
      propagarEstado(
        "tax_total_before_surcharges",
        resueltos([
          ["vat_determined", null, "unsupported"],
          ["ppm_amount", null, "unavailable"],
        ]),
      ).estadoPropagado,
    ).toBe("unsupported");
  });

  it("not_applicable no bloquea el total", () => {
    const r = propagarEstado(
      "tax_total_before_surcharges",
      resueltos([
        ["vat_determined", null, "not_applicable"],
        ["ppm_amount", 0, "official"],
      ]),
    );
    expect(r.bloqueadoPor).toEqual([]);
  });
});
