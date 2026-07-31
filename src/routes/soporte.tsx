import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/shared/AppShell";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCompany } from "@/hooks/useCompany";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import {
  CATEGORIAS_SOPORTE,
  CORREO_SOPORTE,
  PREGUNTAS_FRECUENTES,
  type CategoriaSoporte,
} from "@/lib/soporte";
import { crearTicketSoporteFn } from "@/lib/cuenta.functions";

export const Route = createFileRoute("/soporte")({
  head: () => ({
    meta: [
      { title: "Ayuda y soporte | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Preguntas frecuentes, contacto con soporte y condiciones de uso de Mi Negocio al Día.",
      },
      { property: "og:title", content: "Ayuda y soporte | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Resuelve dudas sobre tus estimaciones, tu plan y la seguridad de tu información.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SoportePage,
});

function SoportePage() {
  const { empresaActiva, modo } = useCompany();
  const { periodoId } = useTaxDashboard();
  const [categoria, setCategoria] = useState<CategoriaSoporte>(
    CATEGORIAS_SOPORTE[0].valor,
  );
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    const r = await crearTicketSoporteFn({
      data: {
        companyId: modo === "cloud" ? (empresaActiva?.id ?? null) : null,
        periodo: periodoId,
        categoria,
        mensaje,
        syncRunId: null,
        codigo: null,
      },
    });
    setEnviando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setMensaje("");
    toast.success("Recibimos tu mensaje. Te responderemos por correo.");
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-bold sm:text-2xl">Ayuda y soporte</h1>
          <p className="text-sm text-muted-foreground">
            Resuelve dudas frecuentes o escríbenos si algo no te calza.
          </p>
        </header>

        <SectionCard titulo="Preguntas frecuentes">
          <Accordion type="single" collapsible>
            {PREGUNTAS_FRECUENTES.map((p, i) => (
              <AccordionItem key={p.pregunta} value={`p-${i}`}>
                <AccordionTrigger className="text-left text-sm">
                  {p.pregunta}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {p.respuesta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SectionCard>

        <SectionCard
          titulo="Reportar un problema"
          descripcion="Cuéntanos qué viste y qué esperabas ver. No incluyas claves ni contraseñas."
          acciones={
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LifeBuoy className="h-4 w-4" aria-hidden /> Soporte
            </span>
          }
        >
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo de problema</Label>
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as CategoriaSoporte)}
              >
                <SelectTrigger aria-label="Tipo de problema">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_SOPORTE.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="mensaje-soporte" className="text-xs">
                ¿Qué ocurrió?
              </Label>
              <Textarea
                id="mensaje-soporte"
                rows={5}
                value={mensaje}
                placeholder="Ejemplo: el IVA de septiembre no coincide con lo que declaró mi contador."
                onChange={(e) => setMensaje(e.target.value)}
              />
            </div>
            <Button
              disabled={enviando || mensaje.trim().length < 5}
              onClick={() => void enviar()}
            >
              {enviando ? "Enviando" : "Enviar reporte"}
            </Button>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Antes de guardar tu mensaje eliminamos automáticamente cualquier clave o
              código de acceso que hayas escrito por error.
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              También puedes escribirnos a {CORREO_SOPORTE}.
            </p>
          </div>
        </SectionCard>

        <SectionCard titulo="Condiciones de uso y privacidad">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Mi Negocio al Día entrega <strong>estimaciones informativas</strong> a
              partir de la información disponible de tu empresa. No es una declaración
              oficial ante el SII y <strong>no reemplaza a tu contador</strong>.
            </p>
            <p>
              La aplicación <strong>nunca almacena tu Clave Tributaria ni tu Clave
              Única</strong>. Las conexiones se realizan a través de un servicio
              autorizado y solo se guarda el resultado de la consulta.
            </p>
            <p>
              Usamos tu información únicamente para mostrarte tus indicadores y calcular
              tus estimaciones. No la vendemos ni la compartimos con terceros ajenos al
              servicio.
            </p>
            <p>
              Conservamos tu historial tributario aunque canceles tu cuenta, porque
              existen obligaciones legales de conservación. Puedes descargar una copia
              cuando quieras desde Mi cuenta.
            </p>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
