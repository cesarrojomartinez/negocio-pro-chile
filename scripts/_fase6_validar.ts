import { ejecutarValidacionDualPiloto, activarValidacionDualPiloto } from "../src/lib/mirror/pilot.server";

const alias = process.argv[2] as "pilot_wood_company" | "pilot_bakery_company";
await activarValidacionDualPiloto({ alias, actor: "fase6-cierre" });
const salida = await ejecutarValidacionDualPiloto({ alias, persistir: false });
console.log(JSON.stringify({
  alias,
  informe: salida.informe,
  periodos: salida.resultados.map(r => ({ p: r.period, exact: r.exact, dif: r.compatibilityDifferences, block: r.blockingReasons.slice(0,4) })),
}, null, 2));
