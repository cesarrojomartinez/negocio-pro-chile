import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Linter tributario: ningún módulo del Motor Espejo puede convertir un
 * desconocido en cero sin dejarlo justificado en el propio código.
 */

const RAIZ = join(process.cwd(), "src/lib/mirror");
const PATRON = /(\?\?|\|\|)\s*0(?![.\d])/;

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "__tests__" || e.name === "fixtures") return [];
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta);
    return e.name.endsWith(".ts") ? [ruta] : [];
  });
}

function esComentario(linea: string): boolean {
  const t = linea.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

describe("prohibición de ceros implícitos", () => {
  const infracciones: string[] = [];

  for (const ruta of archivos(RAIZ)) {
    const lineas = readFileSync(ruta, "utf8").split("\n");
    lineas.forEach((linea, i) => {
      if (esComentario(linea) || !PATRON.test(linea)) return;
      const contexto = lineas.slice(Math.max(0, i - 3), i + 1).join("\n");
      if (contexto.includes("TAX_ZERO_JUSTIFIED")) return;
      infracciones.push(`${ruta.replace(process.cwd() + "/", "")}:${i + 1} → ${linea.trim()}`);
    });
  }

  it("todo `?? 0` del motor espejo está justificado", () => {
    expect(infracciones).toEqual([]);
  });
});
