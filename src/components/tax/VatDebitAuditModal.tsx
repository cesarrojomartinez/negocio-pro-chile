import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCLP } from "@/utils/currency";
import type { ComponentAuditTrace, DocumentAuditEntry } from "@/types/engine";

export interface VatDebitAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculationTrace?: ComponentAuditTrace | null;
  periodo?: string;
}

function labelTipoDocumento(tipo: string): string {
  switch (tipo) {
    case "33":
    case "factura":
      return "Factura Electrónica (33)";
    case "34":
      return "Factura Exenta (34)";
    case "61":
    case "notaCredito":
      return "Nota de Crédito (61)";
    case "56":
    case "notaDebito":
      return "Nota de Débito (56)";
    case "39":
    case "boleta":
      return "Boleta Electrónica (39)";
    case "41":
      return "Boleta Exenta (41)";
    default:
      return tipo;
  }
}

export function VatDebitAuditModal({
  open,
  onOpenChange,
  calculationTrace,
  periodo,
}: VatDebitAuditModalProps) {
  if (!calculationTrace) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Auditoría de IVA Débito</DialogTitle>
            <DialogDescription>
              No hay traza de cálculo disponible para este período.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const {
    engineVersion,
    ruleVersion,
    calculatedAt,
    formula,
    finalAmount,
    consideredDocuments = [],
    excludedDocuments = [],
  } = calculationTrace;

  // Resumen matemático
  const ivaPositivo = consideredDocuments
    .filter((d) => d.efectoTributario === 1)
    .reduce((sum, d) => sum + d.montoIva, 0);

  const notasCredito = consideredDocuments
    .filter((d) => d.efectoTributario === -1)
    .reduce((sum, d) => sum + d.montoIva, 0);

  const resultadoMatematico = finalAmount ?? ivaPositivo - notasCredito;

  const fechaFormateada = new Date(calculatedAt).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "medium",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Auditoría de IVA Débito
          </DialogTitle>
          <DialogDescription>
            Desglose paso a paso generado por el Motor Tributario Espejo.
          </DialogDescription>
        </DialogHeader>

        {/* Metadatos Generales */}
        <div className="grid gap-2 rounded-xl bg-secondary/60 p-4 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <span className="block text-xs text-muted-foreground">Período</span>
              <span className="font-semibold">{periodo ?? "No especificado"}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Motor</span>
              <span className="font-mono text-xs">{engineVersion}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Regla</span>
              <span className="font-mono text-xs">v{ruleVersion}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Calculado En</span>
              <span className="text-xs">{fechaFormateada}</span>
            </div>
          </div>

          <div className="mt-2 border-t pt-2">
            <span className="block text-xs text-muted-foreground">Fórmula Aplicada</span>
            <code className="block text-xs font-semibold text-primary">{formula}</code>
          </div>

          <div className="mt-1 flex items-baseline justify-between border-t pt-2">
            <span className="text-sm font-semibold">Resultado IVA Débito:</span>
            <span className="text-lg font-bold text-primary">
              {formatCLP(resultadoMatematico)}
            </span>
          </div>
        </div>

        {/* Resumen Matemático */}
        <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
            Resumen Matemático
          </h4>
          <div className="flex justify-between">
            <span>IVA positivo (Facturas / Boletas):</span>
            <span className="font-mono font-medium">{formatCLP(ivaPositivo)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Notas de crédito:</span>
            <span className="font-mono font-medium">-{formatCLP(notasCredito)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold text-foreground">
            <span>Resultado:</span>
            <span className="font-mono">{formatCLP(resultadoMatematico)}</span>
          </div>
        </div>

        {/* Tablas de Documentos */}
        <Tabs defaultValue="considerados" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="considerados">
              Considerados ({consideredDocuments.length})
            </TabsTrigger>
            <TabsTrigger value="excluidos">
              Excluidos ({excludedDocuments.length})
            </TabsTrigger>
          </TabsList>

          {/* Sección: Documentos Considerados */}
          <TabsContent value="considerados" className="space-y-3 pt-2">
            {consideredDocuments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay documentos de venta considerados en este período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2">Folio</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">RUT Contraparte</th>
                      <th className="p-2 text-right">Neto</th>
                      <th className="p-2 text-right">IVA</th>
                      <th className="p-2 text-center">Efecto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {consideredDocuments.map((doc: DocumentAuditEntry, idx) => (
                      <tr key={doc.id || idx} className="hover:bg-muted/30">
                        <td className="p-2 font-mono">{doc.folio ?? "-"}</td>
                        <td className="p-2">{labelTipoDocumento(doc.tipoDocumento)}</td>
                        <td className="p-2 font-mono">{doc.rutContraparte || "-"}</td>
                        <td className="p-2 text-right font-mono">{formatCLP(doc.montoNeto)}</td>
                        <td className="p-2 text-right font-mono font-semibold">
                          {formatCLP(doc.montoIva)}
                        </td>
                        <td className="p-2 text-center font-bold">
                          <span
                            className={
                              doc.efectoTributario === 1
                                ? "text-success"
                                : "text-destructive"
                            }
                          >
                            {doc.efectoTributario === 1 ? "+1" : "-1"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Sección: Documentos Excluidos */}
          <TabsContent value="excluidos" className="space-y-3 pt-2">
            {excludedDocuments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay documentos excluidos en este período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2">Tipo Documento</th>
                      <th className="p-2 text-right">IVA</th>
                      <th className="p-2">Motivo Exclusión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {excludedDocuments.map((doc: DocumentAuditEntry, idx) => (
                      <tr key={doc.id || idx} className="hover:bg-muted/30">
                        <td className="p-2 font-medium">{labelTipoDocumento(doc.tipoDocumento)}</td>
                        <td className="p-2 text-right font-mono text-muted-foreground">
                          {formatCLP(doc.montoIva)}
                        </td>
                        <td className="p-2 text-destructive font-medium">
                          {doc.motivoExclusion || "Excluido por regla de negocio"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
