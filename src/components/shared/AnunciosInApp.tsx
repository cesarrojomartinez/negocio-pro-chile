import { useEffect, useState } from "react";
import { AlertCircle, Bell, ExternalLink, Info, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { comunicadosParaEmpresaFn } from "@/lib/master.functions";
import type { Comunicado } from "@/lib/master";
import { cn } from "@/lib/utils";

interface AnunciosInAppProps {
  companyId?: string | null;
}

export function AnunciosInApp({ companyId }: AnunciosInAppProps) {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const res = await comunicadosParaEmpresaFn({ data: { companyId } });
        if (activo && res.ok && Array.isArray(res.data)) {
          const ahora = new Date().toISOString();
          const vigentes = res.data.filter((c) => {
            if (!c.visible) return false;
            if (c.inicia && c.inicia > ahora) return false;
            if (c.termina && c.termina < ahora) return false;
            return true;
          });
          setComunicados(vigentes);
        }
      } catch (err) {
        console.error("[AnunciosInApp] Error cargando comunicados:", err);
      }
    };

    void cargar();
    return () => {
      activo = false;
    };
  }, [companyId]);

  const visibles = comunicados.filter((c) => !cerrados.has(c.id));
  if (visibles.length === 0) return null;

  const cerrar = (id: string) => {
    setCerrados((prev) => new Set([...prev, id]));
  };

  return (
    <div className="space-y-3 mb-4">
      {visibles.map((c) => {
        const esAlta = c.prioridad === "alta";

        return (
          <div
            key={c.id}
            className={cn(
              "relative flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border shadow-sm transition-all",
              esAlta
                ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
                : "bg-primary/5 border-primary/20 text-foreground",
            )}
          >
            <div className="flex items-start gap-3 flex-1 min-w-[240px]">
              {esAlta ? (
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              ) : (
                <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              )}
              <div className="space-y-0.5 text-xs">
                <h4 className="font-bold text-sm leading-tight">{c.titulo}</h4>
                <p className="opacity-90 leading-relaxed">{c.mensaje}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {c.textoBoton && c.enlaceBoton && (
                <Button size="sm" variant={esAlta ? "destructive" : "default"} asChild className="h-8 text-xs gap-1.5">
                  <a href={c.enlaceBoton} target="_blank" rel="noopener noreferrer">
                    {c.textoBoton}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}

              <button
                type="button"
                onClick={() => cerrar(c.id)}
                className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity"
                title="Descartar anuncio"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
