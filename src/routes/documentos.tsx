import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shared/AppShell";
import { CentroDocumental } from "@/components/documents/CentroDocumental";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos tributarios | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Revisa cada factura, boleta y nota del periodo y guarda su PDF o XML oficial cuando lo necesites.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Documentos tributarios | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Centro documental de tus facturas, boletas y notas, con descarga bajo demanda del archivo oficial.",
      },
    ],
  }),
  component: Documentos,
});

function Documentos() {
  const { companyId, periodoId } = useTaxDashboard();

  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Documentos tributarios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta el detalle de cada documento del periodo y guarda su archivo oficial
            solo cuando lo necesites.
          </p>
        </header>

        <CentroDocumental companyId={companyId} periodo={periodoId} />

        <p className="text-xs text-muted-foreground">
          Estimación informativa. El resultado definitivo debe ser confirmado por tu contador.
        </p>
      </div>
    </AppShell>
  );
}
