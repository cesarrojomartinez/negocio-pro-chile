## Objetivo

Poder saber, con datos reales y no con supuestos, cuánto se desvía la estimación de la app respecto del F29 que entrega el contador.

## Hallazgo que motiva el plan

Al conciliar un periodo con el F29 oficial, la app reemplaza el total estimado por el total declarado. El valor original de la estimación se pierde, así que no queda registro de la desviación.

Evidencia en la base actual: 19 periodos tienen a la vez estimación y F29; 18 muestran diferencia exactamente $0 y solo uno conserva una diferencia real (abril 2026: estimado $828.350 vs declarado $863.997, –4,1%).

## Qué se construye

**1. Conservar la estimación previa a la conciliación**
- Se agregan columnas al resumen mensual para guardar el total estimado y sus componentes (IVA, PPM, retenciones) tal como estaban **antes** de aplicar el F29.
- La conciliación sigue mostrando la cifra oficial en pantalla; solo deja de borrar el histórico.

**2. Registrar la desviación de cada periodo**
- Al conciliar, se guarda la diferencia en monto y en porcentaje, y de qué componente vino (IVA, PPM o retenciones).

**3. Vista de precisión histórica**
- Una sección en la pantalla de impuestos que muestre, por los últimos meses: estimado, F29 real, diferencia y porcentaje.
- Un resumen arriba: "En los últimos N meses la estimación se desvió en promedio X% (rango entre A% y B%)".
- Si hay menos de 3 periodos con dato, se indica que aún no hay historial suficiente.

**4. Reconstrucción del pasado (mejor esfuerzo)**
- Para periodos ya conciliados, se intenta recomponer la estimación desde los componentes guardados (IVA + PPM + retenciones) y se marca como "reconstruida", distinguiéndola de las mediciones nuevas.

## Detalle técnico

- Migración: columnas nuevas en `tax_monthly_summaries` (`pre_f29_tax_total`, `pre_f29_vat_payable`, `pre_f29_ppm`, `pre_f29_withholdings`, `f29_deviation_amount`, `f29_deviation_pct`), sin romper filas existentes.
- `src/lib/f29Reconciliation.ts`: antes de sobrescribir con el total oficial, copiar los valores estimados a los campos `pre_f29_*` y calcular la desviación.
- Nuevo componente `PrecisionEstimacion.tsx` en la ruta de impuestos, alimentado por una consulta al resumen mensual.
- Pruebas unitarias del cálculo de desviación (con F29, sin F29, F29 en cero).

## Fuera de alcance

No se cambia la fórmula de la estimación ni la reserva recomendada. Este paso solo mide. Con dos o tres meses de mediciones reales recién tiene sentido calibrar.
