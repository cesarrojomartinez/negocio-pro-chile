# Etapa 6.8.2 — Validación dual piloto y promoción controlada

Este documento describe cómo se validan las empresas piloto contra el núcleo
unificado y cómo se regeneran los snapshots sanitizados. **Ningún paso llama al
SII ni a API Gateway, ninguno descarga documentos y ninguno consume créditos.**

## Alias técnicos

Las empresas piloto se identifican solo por alias:

| Alias | Descripción |
| --- | --- |
| `pilot_wood_company` | Explotación de madera |
| `pilot_bakery_company` | Panadería |

La correspondencia con la empresa real vive únicamente en la tabla
`tax_pilot_companies`, accesible solo desde el servidor. Los alias son lo único
que puede aparecer en el repositorio, en pruebas, en snapshots y en informes.

## Módulos

| Archivo | Rol |
| --- | --- |
| `src/lib/mirror/pilot.ts` | Alias, `crearSnapshotParidadProductiva`, revisión de sanitización |
| `src/lib/mirror/pilotValidation.ts` | Comparación campo a campo, filas persistibles, informe piloto |
| `src/lib/mirror/pilotPromotion.ts` | `aprobarPromocionCompatibility` (aprobación explícita) |
| `src/lib/mirror/pilot.server.ts` | Ejecución en servidor: lectura de datos guardados, persistencia, modo, rollback |
| `src/lib/mirror/fixtures/pilotSnapshots.ts` | Fixtures sanitizados versionados |

## Tablas

- `tax_pilot_companies` — alias ↔ empresa (solo servidor).
- `tax_parity_snapshots` — fotografía sanitizada por empresa, periodo y huella.
- `tax_parity_results` — comparación por campo con categoría, explicación y bloqueo.
- `tax_pilot_validation_reports` — informe previo a la promoción.
- `tax_engine_promotions` — ahora incluye versión de motor, versión de proyección,
  razón de aprobación e informe asociado.

Todas tienen RLS activa y **ningún** permiso para `anon` ni `authenticated`: el
cliente no puede leerlas ni modificarlas, y por lo tanto no puede alterar
`unified_engine_mode`, `promotion_status`, `calculation_engine` ni las versiones.

## Procedimiento

1. Registrar el alias: `registrarEmpresaPiloto({ alias, companyId })`.
2. Cambiar la empresa a validación dual:
   `activarValidacionDualPiloto({ alias, actor })`.
3. Ejecutar la validación sobre lo ya almacenado:
   `ejecutarValidacionDualPiloto({ alias, expectedPeriods })`.
   Lee `tax_periods` y `tax_monthly_summaries`, ejecuta el orquestador único,
   compara `legacy_original` contra `compatibility_projection` y persiste
   snapshots, filas de paridad e informe.
4. Revisar el informe: `promotion_ready`, `blocking_reasons`, `provider_calls = 0`,
   `credits_used = 0`.
5. Backfill: primero `dryRun: true` con `stopOnDifference: true`; solo con
   paridad exacta se ejecuta `dryRun: false`.
6. Promoción explícita de **una sola** empresa:
   `aprobarPromocionPiloto({ alias, approvedBy, approvalReason, validationReportId, ... })`.
7. Rollback en cualquier momento: `ejecutarRollbackPiloto({ alias, reason })`.
   Vuelve a `shadow` sin borrar cálculos, comparaciones ni informes.

## Regeneración de snapshots sanitizados

Los fixtures versionados se derivan de los snapshots del servidor:

1. Ejecutar `ejecutarValidacionDualPiloto` para la empresa y el rango deseado.
2. Leer `tax_parity_snapshots` filtrando por `company_alias`.
3. Copiar únicamente alias, periodo, montos, estados, fuentes abstractas,
   hashes y versiones a `src/lib/mirror/fixtures/pilotSnapshots.ts`.
4. Verificar con `revisarSanitizacionSnapshot`: la prueba A de
   `src/lib/mirror/__tests__/pilotoEtapa682.test.ts` rechaza RUT, UUID, folios
   completos, nombres, documentos y payloads.

Nunca se copian RUT, razón social, folios completos, PDF, credenciales, terceros
ni glosas comerciales.

## Reglas de bloqueo

La promoción se bloquea (`PILOT_PROMOTION_BLOCKED`) ante cualquier diferencia
monetaria distinta de cero, estado visible distinto, etiqueta principal distinta,
fuente visible distinta, fallback no registrado, error sin clasificar, periodo sin
cálculo completo, run fallido, huella faltante, comparación no persistida o
invocación legada en `compatibility`. No existe tolerancia de $1.

## Cierre Fase 6 — hallazgo crítico y reversión

Al conectar los metadatos productivos se detectó que la validación dual
comparaba el motor antiguo **consigo mismo**: fuera de modo `compatibility`,
`calculateTaxPeriod` devolvía la cifra antigua en `productive`, y
`pilot.server.ts` la usaba también como cifra del núcleo unificado. Por eso los
informes anteriores reportaban paridad exacta.

Correcciones aplicadas:

- `calculationOrchestrator.ts` expone `compatibility`, la cifra real del núcleo,
  independiente del modo.
- `pilot.server.ts` valida contra `compatibility`.
- `engineConfig.server.ts` ya no falla en silencio: valida el formato de
  `changed_by` / `approved_by` y lanza error si la escritura no queda guardada.
- `persistirCorridaProductiva` registra la corrida del núcleo y enlaza
  `calculation_run_id`, `certainty_status` y `legacy_fallback_count` en el
  resumen mensual.

Resultado de la validación honesta (sin llamadas al proveedor, 0 créditos):

| Empresa | Periodos | Exactos | Diferencias |
| --- | --- | --- | --- |
| pilot_wood_company | 13 | 5 | 38 |
| pilot_bakery_company | 14 | 2 | 28 |

Ninguna empresa cumple los criterios de promoción. Ambas quedaron en modo
`shadow` y sus cifras visibles fueron restauradas con el motor antiguo
(enero 2026 de la maderera: IVA 574.605 y total 617.475, coincidente con el F29).
