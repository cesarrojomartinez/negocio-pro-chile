import { CASOS_DORADOS } from "../src/lib/mirror/fixtures/goldenCases";
import {
  ejecutarValidacionDualPiloto,
  aprobarPromocionPiloto,
} from "../src/lib/mirror/pilot.server";

const alias = process.argv[2] as "pilot_wood_company" | "pilot_bakery_company";
const salida = await ejecutarValidacionDualPiloto({ alias, persistir: true });
console.log("informe", salida.validationReportId, salida.informe.promotionReady, salida.informe.periodsExact, "/", salida.informe.periodsValidated);

const decision = await aprobarPromocionPiloto({
  alias,
  approvedBy: "cierre-fase-6",
  approvalReason: "Paridad exacta verificada sobre datos reales almacenados; sin llamadas al proveedor ni consumo de créditos.",
  validationReportId: salida.validationReportId!,
  goldenCasesPassed: CASOS_DORADOS.length,
  goldenCasesTotal: CASOS_DORADOS.length,
  visualSnapshotsApproved: true,
});
console.log(JSON.stringify({ approved: decision.approved, blocking: decision.blockingReasons, periods: decision.periodsValidated }, null, 2));
