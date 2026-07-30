import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCLP, parseMonto } from "@/utils/currency";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion: string;
  etiqueta: string;
  valor: number;
  onGuardar: (valor: number) => void;
}

export function MoneyDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  etiqueta,
  valor,
  onGuardar,
}: Props) {
  const [texto, setTexto] = useState(String(valor));

  useEffect(() => {
    if (open) setTexto(String(valor));
  }, [open, valor]);

  const numero = parseMonto(texto);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="monto-dialog">{etiqueta}</Label>
          <Input
            id="monto-dialog"
            inputMode="numeric"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-12 text-lg"
          />
          <p className="text-sm text-muted-foreground">
            Valor a guardar: <strong>{formatCLP(numero)}</strong>
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onGuardar(numero);
              onOpenChange(false);
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
