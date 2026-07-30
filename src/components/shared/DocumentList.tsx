import { useMemo, useState } from "react";
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
import { EmptyState } from "@/components/shared/States";
import { formatCLP, formatFecha } from "@/utils/currency";
import type { DocumentoTributario } from "@/types/tax";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  boleta: "Boleta",
  notaCredito: "Nota de crédito",
};

const ESTADO_LABEL: Record<string, string> = {
  emitido: "Emitido",
  anulado: "Anulado",
  registrada: "Registrada",
  pendiente: "Pendiente",
  reclamada: "Reclamada",
  noIncluir: "No incluir",
};

const ESTADO_CLASE: Record<string, string> = {
  emitido: "bg-success-soft text-success",
  anulado: "bg-muted text-muted-foreground",
  registrada: "bg-success-soft text-success",
  pendiente: "bg-warning-soft text-warning-foreground",
  reclamada: "bg-danger-soft text-destructive",
  noIncluir: "bg-muted text-muted-foreground",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        ESTADO_CLASE[estado] ?? "bg-muted text-muted-foreground",
      )}
    >
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

interface Props {
  documentos: DocumentoTributario[];
  tipos: string[];
  estados: string[];
  etiquetaContraparte: string;
  vacio: { titulo: string; mensaje: string };
}

export function DocumentList({
  documentos,
  tipos,
  estados,
  etiquetaContraparte,
  vacio,
}: Props) {
  const [tipo, setTipo] = useState("todos");
  const [estado, setEstado] = useState("todos");
  const [desde, setDesde] = useState("");

  const filtrados = useMemo(
    () =>
      documentos.filter(
        (d) =>
          (tipo === "todos" || d.tipoDocumento === tipo) &&
          (estado === "todos" || d.estado === estado) &&
          (!desde || d.fecha >= desde),
      ),
    [documentos, tipo, estado, desde],
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="filtro-tipo">Tipo de documento</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger id="filtro-tipo" className="mt-1 h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABEL[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filtro-estado">Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger id="filtro-estado" className="mt-1 h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {estados.map((e) => (
                <SelectItem key={e} value={e}>
                  {ESTADO_LABEL[e] ?? e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filtro-fecha">Desde la fecha</Label>
          <Input
            id="filtro-fecha"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 h-11"
          />
        </div>
      </div>

      {(tipo !== "todos" || estado !== "todos" || desde) && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => {
            setTipo("todos");
            setEstado("todos");
            setDesde("");
          }}
        >
          Limpiar filtros
        </Button>
      )}

      {filtrados.length === 0 ? (
        <div className="mt-4">
          <EmptyState titulo={vacio.titulo} mensaje={vacio.mensaje} />
        </div>
      ) : (
        <>
          {/* Escritorio */}
          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Listado de documentos demostrativos del periodo
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Tipo</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Folio</th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {etiquetaContraparte}
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Neto</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">IVA</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Exento</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Total</th>
                  <th scope="col" className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id} className="border-b border-border/70">
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {formatFecha(d.fecha)}
                    </td>
                    <td className="py-2.5 pr-3">{TIPO_LABEL[d.tipoDocumento]}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{d.folio}</td>
                    <td className="py-2.5 pr-3">
                      <span className="block">{d.contraparte}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.rutContraparte}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatCLP(d.neto)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatCLP(d.iva)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatCLP(d.exento)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                      {formatCLP(d.total)}
                    </td>
                    <td className="py-2.5">
                      <EstadoBadge estado={d.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="mt-4 space-y-3 lg:hidden">
            {filtrados.map((d) => (
              <li key={d.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{d.contraparte}</p>
                    <p className="text-xs text-muted-foreground">
                      {TIPO_LABEL[d.tipoDocumento]} N° {d.folio} ·{" "}
                      {formatFecha(d.fecha)}
                    </p>
                  </div>
                  <EstadoBadge estado={d.estado} />
                </div>
                <p className="num-md mt-3 text-lg">{formatCLP(d.total)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Neto {formatCLP(d.neto)} · IVA {formatCLP(d.iva)} · Exento{" "}
                  {formatCLP(d.exento)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
