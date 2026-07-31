import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SectionCard } from "@/components/shared/SectionCard";
import {
  guardarConfiguracionTributariaFn,
  listarConfiguracionTributariaFn,
  revocarConfiguracionTributariaFn,
} from "@/lib/taxConfiguration.functions";
import type {
  ConceptoOpcional,
  RegistroConfiguracionOpcional,
} from "@/lib/mirror/optionalConfig";
import { formatCLP } from "@/utils/currency";

interface CampoOpcional {
  concept: ConceptoOpcional;
  titulo: string;
  ayuda: string;
  tipo: "porcentaje" | "monto" | "opcion" | "si_no";
  opciones?: { valor: string; etiqueta: string }[];
}

const CAMPOS: CampoOpcional[] = [
  {
    concept: "ppm_rate",
    titulo: "Tasa de PPM vigente",
    ayuda: "Si conoces tu tasa actual, la usamos en vez de la del formulario anterior.",
    tipo: "porcentaje",
  },
  {
    concept: "sales_type",
    titulo: "Tipo de ventas",
    ayuda: "Nos ayuda a interpretar mejor tus ventas exentas.",
    tipo: "opcion",
    opciones: [
      { valor: "afecto", etiqueta: "Solo ventas afectas" },
      { valor: "exento", etiqueta: "Solo ventas exentas" },
      { valor: "mixto", etiqueta: "Ventas afectas y exentas" },
    ],
  },
  {
    concept: "common_use_vat",
    titulo: "IVA de uso común recuperable",
    ayuda: "Porcentaje del IVA de uso común que efectivamente recuperas.",
    tipo: "porcentaje",
  },
  {
    concept: "withholdings_estimate",
    titulo: "Retenciones habituales del mes",
    ayuda: "Monto típico de retenciones, para meses sin formulario aún.",
    tipo: "monto",
  },
  {
    concept: "vat_advance_regime",
    titulo: "Cambio de sujeto o anticipo de IVA",
    ayuda: "Si no aplica a tu empresa, dejamos de estimarlo.",
    tipo: "si_no",
  },
  {
    concept: "vat_postponement",
    titulo: "Postergación de IVA",
    ayuda: "Solo para informarte en las fechas; no cambia el monto estimado.",
    tipo: "si_no",
  },
  {
    concept: "confirmed_carryforward",
    titulo: "Remanente confirmado",
    ayuda: "Úsalo si conoces el remanente con el que empiezas y no hay formulario.",
    tipo: "monto",
  },
];

function mesActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function valorVisible(
  campo: CampoOpcional,
  registro: RegistroConfiguracionOpcional | undefined,
): string {
  if (!registro) return "Sin declarar";
  if (campo.tipo === "porcentaje" && registro.value != null) {
    return `${(registro.value * 100).toFixed(2).replace(/\.?0+$/, "")} %`;
  }
  if (campo.tipo === "monto" && registro.value != null) return formatCLP(registro.value);
  if (campo.tipo === "si_no") return registro.valueText === "si" ? "Sí" : "No";
  const opcion = campo.opciones?.find((o) => o.valor === registro.valueText);
  return opcion?.etiqueta ?? (registro.valueText ?? "Sin declarar");
}

export function PrecisionTributariaPanel({ companyId }: { companyId: string | null }) {
  const listar = useServerFn(listarConfiguracionTributariaFn);
  const guardar = useServerFn(guardarConfiguracionTributariaFn);
  const revocar = useServerFn(revocarConfiguracionTributariaFn);

  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<ConceptoOpcional | null>(null);
  const [registros, setRegistros] = useState<RegistroConfiguracionOpcional[]>([]);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [vigencias, setVigencias] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      const r = await listar({ data: { companyId } });
      if (r.ok) setRegistros(r.data);
    } finally {
      setCargando(false);
    }
  }, [companyId, listar]);

  useEffect(() => {
    if (abierto) void cargar();
  }, [abierto, cargar]);

  const activos = useMemo(() => {
    const mapa = new Map<ConceptoOpcional, RegistroConfiguracionOpcional>();
    for (const r of registros) {
      if (r.status !== "active") continue;
      const previo = mapa.get(r.concept);
      if (!previo || r.validFrom > previo.validFrom) mapa.set(r.concept, r);
    }
    return mapa;
  }, [registros]);

  if (!companyId) return null;

  const onGuardar = async (campo: CampoOpcional) => {
    const bruto = borrador[campo.concept] ?? "";
    if (!bruto) {
      toast.error("Ingresa un valor antes de guardar.");
      return;
    }
    const validFrom = vigencias[campo.concept] || mesActual();
    let value: number | null = null;
    let valueText: string | null = null;
    if (campo.tipo === "porcentaje") value = Number(bruto.replace(",", ".")) / 100;
    else if (campo.tipo === "monto") value = Number(bruto.replace(/\D/g, ""));
    else valueText = bruto;

    if (value != null && Number.isNaN(value)) {
      toast.error("Revisa el valor ingresado.");
      return;
    }

    setGuardando(campo.concept);
    try {
      const r = await guardar({
        data: { companyId, concept: campo.concept, value, valueText, validFrom },
      });
      if (r.ok) {
        setRegistros(r.data);
        setBorrador((p) => ({ ...p, [campo.concept]: "" }));
        toast.success("Dato guardado. Lo usaremos desde la vigencia indicada.");
      } else {
        toast.error(r.error);
      }
    } finally {
      setGuardando(null);
    }
  };

  const onRevocar = async (registro: RegistroConfiguracionOpcional) => {
    if (!registro.id) return;
    setGuardando(registro.concept);
    try {
      const r = await revocar({ data: { companyId, id: registro.id } });
      if (r.ok) {
        setRegistros(r.data);
        toast.success("Dejamos de usar ese dato. Su historial se conserva.");
      } else {
        toast.error(r.error);
      }
    } finally {
      setGuardando(null);
    }
  };

  return (
    <SectionCard
      titulo="Mejorar precisión de los cálculos"
      descripcion="Opcional. Si no completas nada, la aplicación funciona igual que hoy."
      acciones={<ShieldCheck className="h-5 w-5 text-primary" aria-hidden />}
    >
      <Collapsible open={abierto} onOpenChange={setAbierto}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between sm:w-auto">
            {abierto ? "Ocultar antecedentes" : "Agregar antecedentes opcionales"}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`}
              aria-hidden
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-3">
          <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
            Estos datos los declaras tú y quedan registrados con su fecha de
            vigencia. Cuando el formulario oficial informa el mismo dato, siempre
            manda el formulario. Esto es una estimación informativa y no reemplaza a
            tu contador.
          </p>

          {cargando && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando tus antecedentes
            </p>
          )}

          {CAMPOS.map((campo) => {
            const activo = activos.get(campo.concept);
            return (
              <div
                key={campo.concept}
                className="rounded-xl border border-border px-3 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Label
                    htmlFor={`campo-${campo.concept}`}
                    className="text-sm font-semibold"
                  >
                    {campo.titulo}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Actual: {valorVisible(campo, activo)}
                    {activo ? ` · desde ${activo.validFrom.slice(0, 7)}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{campo.ayuda}</p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    {campo.tipo === "opcion" || campo.tipo === "si_no" ? (
                      <Select
                        value={borrador[campo.concept] ?? ""}
                        onValueChange={(v) =>
                          setBorrador((p) => ({ ...p, [campo.concept]: v }))
                        }
                      >
                        <SelectTrigger id={`campo-${campo.concept}`}>
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            campo.opciones ?? [
                              { valor: "si", etiqueta: "Sí" },
                              { valor: "no", etiqueta: "No" },
                            ]
                          ).map((o) => (
                            <SelectItem key={o.valor} value={o.valor}>
                              {o.etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`campo-${campo.concept}`}
                        inputMode="decimal"
                        placeholder={campo.tipo === "porcentaje" ? "Ej: 1,5" : "Ej: 50000"}
                        value={borrador[campo.concept] ?? ""}
                        onChange={(e) =>
                          setBorrador((p) => ({
                            ...p,
                            [campo.concept]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                  <div className="sm:w-40">
                    <Label
                      htmlFor={`vigencia-${campo.concept}`}
                      className="text-xs text-muted-foreground"
                    >
                      Vigente desde
                    </Label>
                    <Input
                      id={`vigencia-${campo.concept}`}
                      type="month"
                      value={vigencias[campo.concept] ?? mesActual()}
                      onChange={(e) =>
                        setVigencias((p) => ({
                          ...p,
                          [campo.concept]: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => void onGuardar(campo)}
                      disabled={guardando === campo.concept}
                    >
                      {guardando === campo.concept && (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      )}
                      Guardar
                    </Button>
                    {activo && (
                      <Button
                        variant="outline"
                        onClick={() => void onRevocar(activo)}
                        disabled={guardando === campo.concept}
                      >
                        Dejar de usar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </SectionCard>
  );
}
