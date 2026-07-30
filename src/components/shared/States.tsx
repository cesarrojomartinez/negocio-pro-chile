import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function LoadingCards({ items = 4 }: { items?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="card-surface p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-8 w-40" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function LoadingBlock({ alto = "h-64" }: { alto?: string }) {
  return <Skeleton className={`w-full rounded-2xl ${alto}`} />;
}

export function EmptyState({
  titulo,
  mensaje,
  icono,
}: {
  titulo: string;
  mensaje: string;
  icono?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/50 px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-card p-3 text-muted-foreground">
        {icono ?? <Inbox className="h-6 w-6" aria-hidden />}
      </div>
      <p className="font-semibold">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{mensaje}</p>
    </div>
  );
}

export function ErrorState({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-danger-soft p-5"
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" aria-hidden />
        <p className="font-semibold">Error de sincronización</p>
      </div>
      <p className="text-sm text-foreground">{mensaje}</p>
      {onReintentar && (
        <Button variant="outline" size="sm" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
