# Etapa 6.5 — Auditoría integral del motor tributario y diseño del Motor Espejo SII

Fecha: 31 de julio de 2026 · Alcance: diagnóstico y diseño. **Cero cambios de cálculo, de interfaz y de datos. Cero consultas reales al SII/API Gateway. Cero créditos consumidos.**

Fuentes usadas: código actual, base de datos (solo lectura), snapshots guardados, resúmenes RCV persistidos, extracciones F29, historial de F29, conciliaciones y suite de pruebas.

---

## A. Mapa completo del motor actual

```text
API Gateway V2 (o adaptador simulado)
   │  apiGatewayClient.ts → apiGatewaySiiProviderAdapter.ts
   ▼
RAW           tax_provider_snapshots.payload (sanitizado)
   │          módulos: rcv_sales_documents / rcv_purchases_* / f29_periods /
   │                   withholdings / f29_compact_pdf
   ▼
NORMALIZACIÓN rcvSummary.ts (resumen agregado)  ·  normalizeProviderData.ts (detalle)
   │          → tax_periods.rcv_summary (objeto ProviderRcvSummary casi 1:1)
   │          → tax_documents (solo si hay detalle)
   ▼
ANTECEDENTES  f29PdfExtraction.server.ts → f29PdfParser.ts → tax_f29_extractions.code_values
   │          f29Antecedent.ts (resolverRemanenteAnterior / resolverTasaPpm /
   │          evaluarCoherenciaPpmF29) · tax_f29_history
   ▼
CÁLCULO       taxCalculations.ts (motor 1) + taxContext.ts (motor 2) vía dashboardBuilder.ts
   │          anticipoIva.ts · vigenciaParametros.ts
   ▼
PERSISTENCIA  tax_monthly_summaries (62 columnas) · tax_period_comparisons ·
   │          tax_carryforward_reconciliations · tax_period_sync_state
   ▼
CONCILIACIÓN  f29Reconciliation.ts (sobrescribe el resumen visible con el F29) ·
   │          f29Precision.ts (desviación) · validacionOficial.ts (causas, sin persistir)
   ▼
UI            ResumenTributario · IndicadoresGrid · PrecisionEstimacion ·
              ConciliacionRemanente · CierreMensual · F29OficialPanel
```

Duplicidades detectadas (crítico): **dos motores paralelos** calculan la misma posición de IVA/PPM/total —
`construirResumenMensual` (`src/utils/taxCalculations.ts:899-1039`) y `construirContextoTributario`
(`src/lib/taxContext.ts:240-394`), este último alimentado con los resultados ya redondeados del primero desde
`src/lib/dashboardBuilder.ts:168-212`. Ambos resultados coexisten en `DashboardData` y pueden divergir.
También hay doble clasificación de DTE: en ingesta (`construirResumenRcv`) y otra vez en lectura
(`agregadosPorCategoria`, `rcvSummary.ts:295-380`).

## B. Archivos, funciones y tablas involucradas

- Cálculo: `src/utils/taxCalculations.ts` (1.232 líneas; `calculateVatDebit`, `calculateVatCredit`,
  `calculateVatPosition`, `calculatePpm`, `calculateTaxEstimate`, `calculatePreventiveReserve`,
  `construirResumenVentas/Compras/Mensual`), `src/lib/taxContext.ts`, `src/lib/anticipoIva.ts`,
  `src/lib/dashboardBuilder.ts`, `src/lib/vigenciaParametros.ts`, `src/lib/periodo.ts`.
- Ingesta: `src/integrations/sii/{contracts,rcvSummary,normalizeProviderData,apiGatewaySiiProviderAdapter,
  apiGatewayResourceMap,unwrapProviderCollection,sanitize}.ts`, `src/lib/siiSync.server.ts`, `src/lib/syncEconomica.ts`.
- F29: `src/lib/{f29Codes,f29PdfParser,f29PdfExtraction.server,f29Antecedent,f29Declaration,f29Reconciliation,
  f29Precision,validacionOficial}.ts`.
- Persistencia/ciclo: `src/lib/{taxRecalc.server,periodLifecycle.server,periodSyncState.server}.ts`,
  `src/services/cloudTaxDataService.ts`.
- Tablas: `tax_provider_snapshots`, `tax_periods` (incl. `rcv_summary`), `tax_documents`,
  `tax_monthly_summaries`, `tax_f29_extractions`, `tax_f29_history`, `tax_period_comparisons`,
  `tax_carryforward_reconciliations`, `tax_company_tax_parameters`, `tax_period_ppm_overrides`,
  `tax_period_sync_state`, `tax_sync_runs/plans/plan_amendments`, `tax_validation_runs`.

## C. Fuente exacta de cada cifra visible

| Cifra | Componente | Fuente → cálculo | Persistencia | Sobrescribible por F29 |
|---|---|---|---|---|
| Total de ventas | IndicadoresGrid | RCV resumen `ventas.totalAmount` → `construirResumenVentas` | `sales_total` | No |
| Ventas exentas | ResumenTributario | `exemptAmount` del resumen | `exempt_sales` | No (código 142 no se extrae) |
| Total de compras | IndicadoresGrid | `compras.totalAmount` | `purchases_total` | No |
| Cantidad de documentos | Ventas/Compras | `documentCount` por línea | — | No |
| IVA débito | ResumenTributario | `ventas.vatAmount − ivaRetenidoPorComprador(DTE 46)` | `vat_debit` (`vat_debit_source`) | Sí (538) |
| IVA crédito | ResumenTributario | `compras.vatAmount` (**IVA total**, sin restar uso común / no recuperable) | `vat_credit` | Sí (537) |
| Remanente anterior | ResumenTributario | F29 504 → periodo previo → 0 `unknown` | `previous_vat_carryforward` + `carryforward_known` | Sí |
| IVA determinado | ResumenTributario | `débito + otros − (crédito + remanente + especiales)`, piso 0, menos anticipo | `estimated_vat_payable` | Sí (89) |
| Base PPM | PpmSelector | base confirmada F29 563 → `ventasNetas + exentas` | `ppm_tax_base` | Sí |
| Tasa PPM | PpmSelector | F29 115 coherente → parámetro vigente → configuración → F29 anterior → `unknown` | `ppm_rate`, `ppm_source` | Sí |
| PPM | ResumenTributario | `round(base × tasa)`; `unknown` ⇒ 0 y `ppmPendiente` | `estimated_ppm` | Sí (62) |
| Retenciones | ResumenTributario | F29 48/151/153/50/39 → parámetro → valor previo → 0 | `estimated_withholdings` | Sí |
| Recargos (92/93) | — | **No existe** | — | — |
| Total tributario | ResumenTributario | `max(0,IVA) + max(0,PPM) + max(0,retenciones)` | `estimated_tax_total` | Sí (547/91) |
| Código 91 declarado | F29OficialPanel / Precisión | `tax_f29_extractions.code_values.91` | `declared_tax_total` | — |
| Dinero a favor | — | Solo como `estimated_new_carryforward`; no hay devolución | `estimated_new_carryforward` | Sí (77) |
| Reserva recomendada | ReservaCard | `total + total×margen%` | `recommended_reserve` | Indirecto |

## D. Cobertura real del resumen RCV

`FilaResumenRcv` (`rcvSummary.ts:20-30`) lee solo 9 campos: tipo de DTE, nombre, cantidad, neto, IVA, exento,
total, IVA uso común, IVA no recuperable.

Ventas: cantidad por tipo ✔ · neto ✔ · exento ✔ · IVA ✔ · total ✔ · NC (60/61/112) ✔ agregado con signo ·
boletas 35/38/39 ✔ agregado · comprobantes 48 ✔ agregado · facturas ✔ · **no gravado ✖** ·
**otros impuestos ✖** · **liquidación factura 43 sin categoría propia** · **anulaciones ✖** ·
**notas de débito 55/56/111 sin categoría propia** (suman como factura; el signo es correcto).

Compras REGISTRO: cantidad/neto/exento/IVA total ✔ · IVA uso común ✔ · IVA no recuperable ✔ ·
**IVA recuperable: inferido, nunca calculado** · **activo fijo ✖** · **bienes raíces ✖** · **supermercado ✖** ·
**fuera de plazo ✖** · NC ✔ · ND parcial.

**¿Bastan los resúmenes para IVA débito y crédito en casos normales? Sí, con una excepción demostrada.**
Evidencia (Panadería 2026-06): resumen `ventas.vatAmount` = 2.904.793; menos DTE 46 (14.707) = 2.890.086 =
**código 538 exacto**. `compras.vatAmount` = 1.584.565 + remanente 504 (15.046) = 1.599.611 = **código 537
exacto**. Débito − crédito = 1.290.475 = **código 89 exacto**.
La excepción es estructural: `siiSync.server.ts:1244-1257` persiste `vat_credit = resumenCompras.vatAmount`
(IVA **total**) sin restar `vatCommonUse` ni `vatNonRecoverable`. En empresas con uso común o crédito no
recuperable el crédito queda **sobreestimado**. Hoy no se observa porque ambas empresas reales traen esos
campos en 0.

Señal de alerta ya presente: el resumen guarda `unclassifiedAmount` (Panadería 2026-06: ventas −14.709,
compras 247.352; JMC 2026-06 compras 169.892). Es un residuo real entre líneas y totales oficiales que hoy
**no se muestra ni bloquea nada**.

## E. Datos que se pierden al no consultar detalles

Contraparte y RUT, folio y fecha por documento, estados PENDIENTE/RECLAMADO/NO_INCLUIR (el modo económico
solo pide REGISTRO, `syncEconomica.ts:18`), vínculo NC→factura, anulaciones, impuestos adicionales por línea
del DTE. Ninguno de estos altera el IVA de un caso normal; sí impiden auditoría documento a documento.

## F. Ceros artificiales encontrados

Estructural: en `tax_monthly_summaries` **todas** las columnas monetarias son `NOT NULL DEFAULT 0`
(`vat_debit`, `vat_credit`, `previous_vat_carryforward`, `estimated_*`, `other_vat_*`, `special_*`).
Solo `ppm_rate`, `declared_tax_total` y las columnas `pre_f29_*` admiten `null`. El esquema **no puede
representar "desconocido"**; se compensa con columnas paralelas de fuente (`*_source`, `carryforward_known`,
`missing_components`).

En código (clasificación resumida):

| Ubicación | Caso | Clasificación |
|---|---|---|
| `dashboardBuilder.ts:183-187` | `otrosDebitosIva/otrosCreditosIva/debitosEspeciales/creditosEspeciales/anticipoIvaDisponible ?? 0` | **Cero peligroso** — destruye el `null` antes de entrar al motor |
| `taxCalculations.ts:953` | `anticipoIvaDisponible ?? 0` | **Cero peligroso** (cambio de sujeto no informado) |
| `taxCalculations.ts:977` | `Math.max(0, redondear(retencionesEstimadas))` | **Cero peligroso** (no distingue null de 0) |
| `taxCalculations.ts:1009` | remanente anterior sin acceso a `remanenteConocido` | **Cero peligroso** |
| `taxRecalc.server.ts:335-336` | `retencionesParametro ?? estimated_withholdings ?? 0` | **Cero peligroso** (colapsa desconocido) |
| `taxCalculations.ts:140,143` | `Math.max(0, vatDebit)` | **Cero peligroso** (débito negativo por NC > ventas se trunca) |
| `taxCalculations.ts:262-264` | `Math.max(0, ...)` en los tres componentes del total | Peligroso parcial (oculta entradas negativas) |
| `taxContext.ts:244` | `previousVatCarryforward ?? 0` con `remanenteConocido` aparte | Técnico mitigado |
| `anticipoIva.ts:42,66,137,177` | códigos F29 ausentes / máximos | Cero oficial o matemático válido |
| `taxCalculations.ts:71,290,313,333` | `seguro()`, clamps de reserva | Cero técnico / matemático válido |

Densidad de `?? 0 / || 0` en producción: `taxCalculations.ts` 38 · `periodLifecycle.server.ts` 23 ·
`dteFiles.server.ts` 9 · `taxContext.ts` 8 · `normalizeProviderData.ts` 8.

## G. Supuestos implícitos (con evidencia)

1. Ausencia de `exento` ⇒ venta 100 % afecta (`montoFirmado` con `seguro()`), aunque las exentas sí se
   modelan cuando llegan.
2. Todo IVA de compras en estado REGISTRO/aceptada es 100 % recuperable; no hay proporcionalidad ni control
   de giro (`calculateVatCredit:157-189`), y no se resta uso común ni no recuperable (§D).
3. Toda nota de crédito rebaja débito sin excepción (`TIPOS_EFECTO_NEGATIVO`, `taxCalculations.ts:82`;
   `DTE_EFECTO_NEGATIVO`, `rcvSummary.ts:18`).
4. Una tasa PPM leída de un F29 anterior se arrastra hacia adelante **sin fecha de término**
   (`resolverTasaPpm`, prioridad 5, sobre `.limit(12)` de antecedentes). Sí hay vigencias para parámetros
   configurados (`vigenciaParametros.ts`), pero esa ruta no las respeta.
5. El remanente se traslada **nominal, sin reajuste UTM**; no existe ninguna referencia a UTM en el motor.
6. `declaration_status = "filed"` se trata como antecedente firme: **F29 presentado = pagado**. No hay campo
   de pago real en ninguna tabla; el código 91 se usa como "total declarado", y la UI lo presenta como monto
   a pagar sin evidencia de entero efectivo.
7. Código F29 ausente ⇒ 0 en la ruta de cálculo, aunque `f29PdfExtraction.server.ts:886` documenta lo
   contrario ("solo un cero explícito del formulario confirma ausencia"). La intención existe; la cadena la
   pierde en `dashboardBuilder` y `taxRecalc`.
8. Un periodo cerrado no se recalcula solo: `confirmarAntecedentesF29` recalcula únicamente ese mes.
9. Toda rectificatoria nueva reemplaza a la anterior si el parser no lanza excepción, incluso con estado
   `partial`/`needs_review` y confianza baja (`f29PdfExtraction.server.ts:834-937`).

## H. Parches particulares

No hay condiciones productivas por `company_id`, RUT, nombre de empresa, folio ni monto. Los literales de
periodo ("2026-06", etc.) viven en `src/data/mockTaxData.ts` (datos demostrativos) y en pruebas — **legítimos**.
Único hardcode a vigilar: `src/lib/apiGateway.server.ts:250`, credencial ficticia de sondeo
(`clave: "sondeo-sin-valor"`) — es un diagnóstico deliberado sin valor real, clasificado como **fallback
aceptable**, no parche tributario. Veredicto: el código productivo **no depende de una empresa, folio,
monto ni periodo particular**.

## I. Tratamiento de ventas

Clasificación exclusivamente por código de DTE del RCV (30/32/33/34/43/45/46/48/110 → factura;
35/38/39/41 → boleta; 55/56/111 → nota de débito; 60/61/112 → nota de crédito). **No se clasifica por nombre
de producto ni glosa** — confirmado: no existe ninguna heurística textual sobre productos en el motor.
Exentos se mantienen separados; el IVA oficial nunca se recalcula cuando llega informado (la inferencia 19 %
solo actúa si `vatAmount` es nulo, y queda marcada en `raw_metadata.ivaInferido`). DTE 46 se excluye del
débito (`ivaRetenidoPorCompradorEnVentas`, `rcvSummary.ts:238-245`). Faltan: ventas no gravadas,
exportaciones, liquidación factura y anulaciones como categorías propias.

## J. Tratamiento de compras y K. crédito fiscal

- A) El resumen REGISTRO **no entrega** un campo "IVA recuperable"; entrega IVA total, uso común y no recuperable.
- B) El motor usa el **IVA total** como crédito.
- C) No recalcula 19 % desde el neto cuando el IVA viene informado.
- D) Las NC de compra se aplican con `taxEffect = −1` correctamente.
- E) Activo fijo: **no se separa** (no hay campo ni código; en `f29Codes.ts` el 524 está rotulado como NC
  recibidas y el 525 no existe).
- F) Uso común: llega en el resumen, **no se usa** en el cálculo.
- G) La ausencia de clasificación se trata como crédito completo.
- H) Sí, el flujo económico pierde información necesaria en escenarios mixtos: proporcionalidad, activo fijo,
  supermercado y fuera de plazo. En empresas 100 % afectas (los dos casos reales actuales) no hay pérdida.

## L. Remanente

Origen: código 504 del F29 del propio periodo; el que deja el mes es el 77. Prioridad: F29 propio →
`estimated_new_carryforward` del mes previo → 0 con `carryforward_known = false` y fuente `unknown`.
Sin reajuste UTM. Periodos **aislados**: solo `recalculateCompanyHistory` (24-36 meses ascendentes) encadena.
Las diferencias se registran en `tax_carryforward_reconciliations` y se muestran en `ConciliacionRemanente`
sin corregir nada — comportamiento correcto y deliberado.
Simulación conceptual (sin tocar datos): una corrección del remanente de enero **no** se propaga a febrero,
marzo ni abril salvo recálculo explícito del historial; con F29 oficial en el mes siguiente la cadena se
**interrumpe y se confirma** con el 504 declarado, por lo que el error histórico queda contenido en el mes
corregido y en los meses sin F29 posteriores.

## M. PPM

Base = 563 confirmado, si no `ventasNetas + exentas` (asume que toda venta neta es base imponible).
Tasa = 115 del F29 coherente → parámetro con vigencia → configuración → F29 anterior → `unknown` (PPM = 0 y
`ppmPendiente = true`). `evaluarCoherenciaPpmF29` exige `563 × 115 ≈ 62` y descarta tasas > 50 %:
por eso junio 2026 de la panadería (115 = 10 %, 62 = 15.288) conserva el F29 pero **no propaga la tasa**.
El parser incluso prueba tasa/100, tasa y tasa×100 para reproducir el 62 (`conciliarTasaPpm`).
No hay tratamiento de suspensión, pérdidas, crédito de PPM (64/66 catalogados pero sin uso), tasa reducida ni
cambio de régimen. Origen por periodo hoy: Panadería 2025-06 a 2026-06 → **F29 oficial** en todos;
JMC 2026-01/03/05/06 → **F29 vía contador**, 2026-02 y 2026-07 → **configuración**, 2025-12 y 2026-04 →
**desconocido** (`ppm_rate = null`, PPM = 0).

## N. Retenciones e impuestos adicionales

Retenciones: suma de 48/151/153/50/39 del F29; si falta, parámetro `usual_withholdings`; si falta, valor
previo; si falta, 0 con fuente `unknown`. En los datos reales la panadería arrastra 6.298 constantes desde
2026-01 (valor heredado del F29, no re-estimado). **Impuestos adicionales y recargos (92/93) no existen**:
ni código, ni columna, ni cálculo. Escenarios no calculables solo con RCV + F29 histórico: ILA y específicos,
retenciones de honorarios no declaradas aún, postergación de IVA (756 catalogado, sin uso).

## O. Conciliación F29

Sobrescribe la pantalla campo por campo (`f29Reconciliation.ts:72-145`) y esos valores **se persisten en las
columnas `estimated_*`** — nombre semánticamente engañoso: con F29 presente contienen la cifra oficial.
La estimación previa sí se conserva en `pre_f29_*`, y la desviación en `f29_deviation_amount/pct/measured_at`
(solo total, no por componente). `validacionOficial.ts::compararConMotor` produce causas por concepto pero
**no se persiste desde ningún módulo de servidor** (lógica huérfana). No distingue declarado de pagado.
Una rectificatoria ilegible conserva el F29 anterior; una rectificatoria legible pero de baja confianza lo
reemplaza igual.

## P/Q. Resultado histórico por empresa y periodo (recálculo local, sin consultas)

Panadería (ROSA HAYDEE …) — estimación previa vs. F29 (código 91):

| Periodo | Pre-F29 | Declarado 91 | Δ | Δ% | Causa |
|---|---|---|---|---|---|
| 2025-06 | 358.847 | 358.843 | 4 | 0,0 | redondeo |
| 2025-07 | 396.910 | 393.453 | 3.457 | 0,9 | retenciones/redondeo PPM |
| 2025-08 | 405.077 | 400.968 | 4.109 | 1,0 | ídem |
| 2025-09 | 408.071→108.071 | 102.963 | 5.108 | 5,0 | tasa PPM 1 % del mes |
| 2025-10 | 318.570 | 308.713 | 9.857 | 3,2 | IVA determinado 89 = 96.455 no anticipado |
| 2025-11 | 293.099 | 293.099 | 0 | 0 | exacto |
| 2025-12 | 292.770 | 292.766 | 4 | 0,0 | redondeo |
| 2026-01 | 344.622 | 336.509 | 8.113 | 2,4 | retenciones 151 |
| 2026-02 | 249.928 | 249.924 | 4 | 0,0 | redondeo |
| 2026-03 | 433.316 | 429.411 | 3.905 | 0,9 | retenciones |
| 2026-04 | 272.253 | 272.253 | 0 | 0 | exacto |
| 2026-05 | 299.119 | 299.112 | 7 | 0,0 | redondeo |
| 2026-06 | 1.038.944 | 748.454 | 290.490 | 38,8 | anticipo IVA (556/557) + tasa 115 incoherente |
| 2026-07 | 190.444 | — | — | — | periodo abierto |

Descomposición de junio 2026 (verificada contra códigos): 538 = 2.890.086; 537 = 1.599.611 (incluye 504 =
15.046); 89 = 1.290.475; 62 = 15.288 (tasa leída 10 %, incoherente); 91 = 748.454. La diferencia
1.290.475 + 15.288 − 748.454 = **557.309** corresponde al anticipo de IVA por cambio de sujeto, hoy estimado
por mediana y no siempre acertado. Es el único mes con desviación material tras las correcciones de la etapa
anterior; los demás quedan ≤ 5 %.

JMC (explotación de madera) — solo un F29 en PDF (2026-02, extracción **parcial**, 12 códigos); el resto son
antecedentes cargados por el contador:

| Periodo | Estimado total | Declarado (historial) | Estado | Observación |
|---|---|---|---|---|
| 2025-12 | 2.191.842 | — | incomplete | remanente, tasa PPM y retenciones desconocidos |
| 2026-01 | 617.475 | 617.475 | closed | coincide (IVA 574.605 + PPM 42.870) |
| 2026-02 | 0 | 0 | closed | remanente siguiente 209.180 |
| 2026-03 | 39.981 | 39.981 | closed | coincide |
| 2026-04 | 828.350 | 863.997 | incomplete | Δ 35.647; `declared_tax_total` **no persistido** |
| 2026-05 | 2.013.931 | 2.013.931 | incomplete | coincide, pero sin `pre_f29` ni desviación registrada |
| 2026-06 | 1.125.729 | 1.125.729 | incomplete | ídem |
| 2026-07 | 2.837.005 | — | estimated_complete | periodo abierto |

Hallazgo: para JMC, abril–junio 2026 tienen F29 del contador en `tax_f29_history` pero
`declared_tax_total`, `pre_f29_*` y `f29_deviation_*` están en `null` en `tax_monthly_summaries`, y el estado
sigue `incomplete` con las columnas de fuente vacías. **La medición de precisión no cubre la ruta
"antecedente del contador", solo la ruta PDF.**

## R/S/T/U. Matriz de escenarios

| Escenario | Estado |
|---|---|
| Ventas solo afectas | Soportado y exacto (probado con dos empresas reales) |
| Ventas exentas | Soportado con estimación (se separan montos, pero sin código 142 ni verificación) |
| Ventas mixtas | Requiere información adicional (sin proporcionalidad) |
| Remanente | Soportado con estimación (sin reajuste UTM) |
| Notas de crédito | Soportado y exacto |
| Notas de débito | Soportado en monto; sin categoría propia |
| Activo fijo | **No soportado** |
| IVA uso común | **Potencialmente incorrecto** (dato disponible, no aplicado) |
| Crédito no recuperable | **Potencialmente incorrecto** (ídem) |
| Proporcionalidad | **No soportado** |
| Retenciones | Soportado con estimación / configuración opcional |
| Impuestos adicionales | **No soportado** |
| Rectificatoria | Soportado con riesgo (baja confianza reemplaza igual) |
| Cambio de tasa PPM | Soportado con vigencias, salvo ruta `previous_f29` |
| Sin F29 anterior | Soportado con marca de incompleto |
| F29 incompleto | Soportado (estado `partial`), sin bloqueo de cifras |
| Postergación de IVA | **No soportado** (756 catalogado, sin uso) |
| Exportadora | **No soportado** |

## V. Riesgos críticos

1. **Crédito fiscal sobreestimado** en empresas con uso común o IVA no recuperable (dato disponible y no usado).
2. **Doble motor de cálculo** (taxCalculations + taxContext) con reglas de "desconocido" distintas.
3. **Ceros artificiales estructurales**: esquema `NOT NULL DEFAULT 0` + `?? 0` en dashboardBuilder/taxRecalc.
4. **`estimated_*` contiene valores oficiales** tras conciliar: la trazabilidad depende de `pre_f29_*`, que
   solo se llena en la ruta PDF.
5. **Remanente sin reajuste UTM** y sin propagación automática de correcciones.
6. **Tasa PPM sin caducidad** en la ruta `previous_f29`.
7. **F29 = pagado**: no existe evidencia de entero efectivo en el modelo.
8. **Rectificatoria de baja confianza** puede reemplazar cifras buenas.
9. **`unclassifiedAmount` ignorado**: residuo real del resumen oficial sin efecto ni alerta.
10. **Causas de diferencia no persistidas** (`compararConMotor` huérfano).
11. **Códigos ausentes del registro**: 142, 525, uso común, impuestos adicionales, 92/93.

## W. Arquitectura del Motor Tributario Espejo SII (diseño, no implementado)

```text
RawTaxSnapshot            payload íntegro + endpoint + adapterVersion + sha256 + granularity
        ↓                 inmutable, nunca se corrige para cuadrar
NormalizedTaxFact[]       { period, ledger, documentType, documentNature, documentCount,
                            taxEffect, taxableNet, exemptAmount, nonTaxableAmount, vatAmount,
                            vatCommonUse, vatNonRecoverable, otherTaxes, totalAmount,
                            granularity, source, sourceStatus }
        ↓                 taxEffect proviene de una tabla cerrada de tipos DTE
HistoricalOfficialContext F29 vigentes previos: 504/77/115/563/62/91, folio, vigencia
        ↓
OptionalTaxSettings       { value, source:"user_confirmed", validFrom, validTo, confirmedAt,
                            confirmedBy } — siempre opcional
        ↓
PeriodTaxContext          se construye SIEMPRE, incluso con configuración vacía
        ↓
VersionedTaxRuleRegistry  TaxRule { ruleId, version, validFrom, validTo, requiredInputs,
                            calculate, rounding, legalBasis, testCases }
        ↓
DeterministicCalculation  ComponentCalculation { concept, amount, status, ruleId, ruleVersion,
                            sources[], calculation, missingInputs[] }
        ↓
CalculationCompleteness   official | confirmed | estimated | requires_confirmation |
                            unsupported | unavailable
        ↓
F29OfficialReconciliation ReconciliationResult por componente; jamás borra la estimación
        ↓
Dashboard sencillo        una cifra + una frase + estado de certeza
```

Principios que hereda: prioridad de fuentes F29 propio → RCV propio → F29 anterior → historial vigente →
configuración confirmada → estimación identificada → desconocido; **nunca dato ausente ⇒ cero definitivo**;
la IA solo explica, nunca calcula, decide IVA, elige tasas ni corrige resultados.

Distancia respecto del motor actual: existen ya `*_source`, `carryforward_known`, `missing_components`,
`calculation_status` y `pre_f29_*` — es decir, ~40 % de la arquitectura objetivo está insinuada en el esquema.
Falta: identidad y versión de regla, componentes independientes con `missingInputs`, tipos `null`-capaces en
la base y la separación estricta raw/normalizado.

## X. Configuración opcional mínima recomendada (no implementada)

Apartado "Mejorar precisión de los cálculos", siempre omitible:

| Dato | Mejora | ¿Inferible? | Riesgo | Frecuencia | Si no se completa |
|---|---|---|---|---|---|
| Tasa PPM vigente + `validFrom` | PPM de meses sin F29 | Sí, del F29 anterior | Tasa vencida | Anual (abril) | PPM marcado `requires_confirmation` |
| Proporción de crédito de uso común | IVA crédito en ventas mixtas | No | Alto si se infiere | Anual | Crédito marcado `requires_confirmation` |
| ¿Realiza ventas exentas o exportaciones? | Habilita reglas de exentas | Parcial (RCV) | Medio | Rara | Se asume solo afectas, marcado |
| Retenciones recurrentes (honorarios) | Total de meses sin F29 | Sí, mediana del F29 | Bajo | Semestral | Retenciones `unknown`, no cero |
| ¿Cambio de sujeto / anticipo IVA? | Corrige el caso junio 2026 | Sí (556/557) | Medio | Rara | Estimación por mediana, marcada |
| Postergación de IVA | Fecha de pago y total | No | Bajo | Mensual | No soportado, marcado |

## Y. Impacto sobre créditos de API Gateway

Ninguna limitación detectada obliga a reactivar el detalle documental. Prioridad: F29 → historial →
configuración opcional → desconocido → consulta adicional solo si el beneficio la justifica.

| Dato faltante | Impacto | Frecuencia | Fuente alternativa | Endpoint | Necesidad |
|---|---|---|---|---|---|
| IVA recuperable neto | Crédito sobreestimado | Media en mixtas | Ya viene en el resumen (basta usarlo) | **Ninguno** | Nula, es un cambio de cálculo |
| Activo fijo / supermercado | Crédito mal clasificado | Baja | F29 del mes | Ninguno | Baja |
| Estados PENDIENTE/RECLAMADO | Crédito potencial | Media | — | `rcv_purchases_pending/claimed` | Solo bajo petición |
| Anulaciones / folio | Auditoría documental | Baja | — | `rcv_*_documents` | Solo bajo petición |
| Impuestos adicionales | Total incompleto | Muy baja | F29 | `dte xml` | Nula por ahora |

## Z. Orden recomendado de implementación (fases posteriores)

1. **Normalización de hechos** (`NormalizedTaxFact` + tabla propia). Riesgo bajo; migración aditiva; rollback trivial.
2. **Eliminación de ceros artificiales**: columnas `null`-capaces y fin de `?? 0` en dashboardBuilder/taxRecalc. Riesgo medio (UI debe tolerar `null`).
3. **Componentes independientes** con `ComponentCalculation`. Riesgo medio; unifica los dos motores paralelos.
4. **Estados de certeza** en la UI (incluye no mostrar cifras definitivas cuando falta un antecedente).
5. **Reglas versionadas** (`ruleId`, `version`, `validFrom`). Riesgo bajo, alto valor de trazabilidad.
6. **Cadena de remanentes** con reajuste y propagación explícita. Riesgo alto: recálculo histórico.
7. **PPM con vigencias estrictas** (caducidad de `previous_f29`).
8. **Crédito fiscal y clasificaciones** (uso común, no recuperable, activo fijo).
9. **Conciliación oficial** por componente + persistencia de causas + declarado ≠ pagado.
10. **Casos dorados** por componente (uno por F29 real; hoy 14 formularios disponibles).
11. **Configuración opcional progresiva**.
12. **Casos especiales** (proporcionalidad, exportaciones, postergación, impuestos adicionales).

## AA. Pruebas y casos revisados

`bunx vitest run`: **26 archivos, 274 pruebas, 0 fallos, 105,6 s**. Casos dorados: existen cifras reales en
`mayo2026`, `junio2026`, `f29Precision`, `f29Pdf`, `conciliacionF29`, `validacionOficial`, pero la cobertura
es **por total**, no por componente: `TASA_IVA`, `VAT_RATE` y `PROJECTION_FACTORS` no se prueban directamente,
y no hay pruebas que fijen simultáneamente 538/537/504/77/563/115/62/91 de un mismo F29 real. Conclusión: una
corrección que arregle un mes **puede romper otro sin que la suite lo detecte**, salvo en el total.

Estructura propuesta (no implementada): `GoldenTaxCase { company, period, rawSnapshotRef, expected:
{ salesTaxable, salesExempt, vatDebit, vatCredit, previousCarryforward, nextCarryforward, vatDetermined,
ppmBase, ppmRate, ppm, withholdings, surcharges, code91 }, tolerance }` — un archivo por F29 real, 14 casos
disponibles hoy.

## AB. Confirmación de cero consultas reales

No se ejecutó ninguna llamada a API Gateway ni al SII. Toda la evidencia proviene de lectura de código,
consultas `SELECT` a la base de datos y ejecución local de la suite. **Cero créditos consumidos, cero
documentos descargados, cero datos modificados.**

## AC. Veredicto de confiabilidad actual

**Confiable para el caso normal chileno (empresa 100 % afecta, sin proporcionalidad y con RCV completo);
frágil fuera de él.** Trece de catorce periodos reales cierran con desviación ≤ 5 % frente al código 91, y
el IVA débito/crédito reproduce exactamente los códigos 538/537/89. El riesgo no está en la aritmética sino
en la representación: el motor no puede decir "no sé" (ceros por defecto), tiene dos rutas de cálculo
paralelas, no aplica el uso común ni el IVA no recuperable que ya recibe, no reajusta el remanente y trata
un F29 presentado como pagado. Esas cinco debilidades —no la exactitud— son las que justifican el Motor
Espejo SII.
