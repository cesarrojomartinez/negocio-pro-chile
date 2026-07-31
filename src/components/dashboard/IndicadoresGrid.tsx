import { Receipt, ShoppingCart, Store, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { FlipStatCard } from "@/components/shared/FlipStatCard";
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
      <FlipStatCard
        tituloFrente="Compras"
        montoFrente={formatCLP(resumen.comprasTotales)}
        descripcionFrente="Compras consideradas durante el periodo."
        tituloReverso="Compras netas"
        montoReverso={formatCLP(resumen.comprasNetas)}
        descripcionReverso="Monto sin IVA que sirve de base para el crédito."
        notaReverso="El IVA crédito se calcula sobre el neto afecto, no sobre el total. Las compras exentas no generan crédito."
        variacion={comparacion.variacionCompras}
        interpretarComoPositivo={false}
        icono={<ShoppingCart className="h-4.5 w-4.5" aria-hidden />}
        destacado
      />
    </div>
  );
}
