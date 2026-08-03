import { History, ShieldCheck, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RegistroHistorialConfig } from "@/lib/configuracion";

export function ModalHistorialConfig({
  abierto,
  onOpenChange,
  historial,
}: {
  abierto: boolean;
  onOpenChange: (open: boolean) => void;
  historial: RegistroHistorialConfig[];
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Historial de Cambios de Configuración
          </DialogTitle>
          <DialogDescription className="text-xs">
            Registro inmutable de auditoría de modificaciones realizadas por administradores.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-3 mt-4">
          {historial.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No hay registros de cambios de configuración recientes.
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((item) => (
                <div key={item.id} className="p-3 rounded-xl border bg-card text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" /> {item.usuarioEmail}
                    </span>
                    <span className="text-muted-foreground">{new Date(item.fecha).toLocaleString("es-CL")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {item.grupo}
                    </Badge>
                    <span className="text-muted-foreground font-mono text-[11px]">{item.accion}</span>
                  </div>
                  {item.valorNuevo && (
                    <details className="mt-2 text-[11px] text-muted-foreground cursor-pointer">
                      <summary className="font-semibold text-primary hover:underline">Ver detalle de diff JSON</summary>
                      <pre className="mt-1 p-2 rounded bg-muted/60 font-mono overflow-x-auto text-[10px]">
                        {item.valorNuevo}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
