import { ejecutarValidacionDualPiloto } from "../src/lib/mirror/pilot.server";

const alias = process.argv[2] as "pilot_wood_company" | "pilot_bakery_company";
const salida = await ejecutarValidacionDualPiloto({ alias, persistir: false });
for (const r of salida.resultados) {
  for (const row of r.rows) {
    if (!row.blocking) continue;
    console.log(
      r.period,
      row.field,
      "legacy=", row.legacyValue,
      "compat=", row.compatibilityValue,
      "dif=", row.legacyVsCompatibilityDifference,
      "|", row.explanation,
    );
  }
}
