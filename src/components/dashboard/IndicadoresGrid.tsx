import { Receipt, ShoppingCart, Store, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { formatCLP } from "@/utils/currency";
import type { ComparacionMensual, ResumenMensual, ResumenVentas } from "@/types/tax";

export function IndicadoresGrid({
  resumen,
  ventas,
  comparacion,
}: {
  resumen: ResumenMensual;
  ventas: ResumenVentas;
  comparacion: ComparacionMensual;
}) {
  const proporcionFacturas =
    ventas.ventasFacturas + ventas.ventasBoletas > 0
      ? Math.round(
          (ventas.ventasFacturas / (ventas.ventasFacturas + ventas.ventasBoletas)) *
            100,
        )
      : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        titulo="Ventas totales"
        monto={formatCLP(resumen.ventasTotales)}
        descripcion="Total registrado durante el mes."
        variacion={comparacion.variacionVentas}
        icono={<Store className="h-4.5 w-4.5" aria-hidden />}
        destacado
      />
      <StatCard
        titulo="Facturado"
        monto={formatCLP(resumen.ventasFacturas)}
        descripcion="Ventas respaldadas mediante facturas."
        icono={<Receipt className="h-4.5 w-4.5" aria-hidden />}
        contexto={`Representa el ${proporcionFacturas}% de tus ventas del periodo.`}
      />
      <StatCard
        titulo="Ventas con boleta"
        monto={formatCLP(resumen.ventasBoletas)}
        descripcion="Boletas y resúmenes de venta registrados."
        icono={<Wallet className="h-4.5 w-4.5" aria-hidden />}
        contexto={`${ventas.cantidadBoletas} resúmenes diarios registrados.`}
      />
      <StatCard
        titulo="Compras"
        monto={formatCLP(resumen.comprasTotales)}
        descripcion="Compras consideradas durante el periodo."
        variacion={comparacion.variacionCompras}
        interpretarComoPositivo={false}
        icono={<ShoppingCart className="h-4.5 w-4.5" aria-hidden />}
        contexto="Más compras pueden significar más crédito de IVA, pero también más gasto. Revisa el contexto."
      />
    </div>
  );
}
