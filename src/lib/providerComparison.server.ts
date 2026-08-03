/**
 * Servicio de Comparación Dual y Telemetría de Proveedores Tributarios.
 *
 * Ejecuta ambos proveedores (Gateway vs SimpleAPI) en modo "compare",
 * calcula los totales de RCV (ventas/compras/IVA), evalúa discrepancias
 * y registra la telemetría sin modificar el motor tributario existente.
 */
import { simpleApiSiiProviderAdapter } from "@/integrations/sii/simpleApiProviderAdapter";
import { apiGatewaySiiProviderAdapter } from "@/integrations/sii/apiGatewaySiiProviderAdapter";
import { mockSiiProviderAdapter } from "@/integrations/sii/mockSiiProviderAdapter";
import type { SiiProviderAdapter, ProviderQuery } from "@/integrations/sii/contracts";
import type { HealthCheckResult } from "@/integrations/sii/taxProviderRegistry";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface MetricasProveedor {
  proveedor: string;
  id: string;
  tiempoMs: number;
  tiempoSegundosText: string;
  estado: "exito" | "error" | "mantenimiento" | "credenciales_invalidas";
  costoEstimadoCreditos: number;
  costoEstimadoClp: number;
  cantidadDocumentosVentas: number;
  cantidadDocumentosCompras: number;
  ivaDebitoClp: number;
  ivaCreditoClp: number;
  remanenteEstimadoClp: number;
  errorMensaje?: string;
}

export interface ResultadoComparacionProveedores {
  periodo: string;
  empresaRut: string;
  empresaId: string;
  ejecutadoEn: string;
  coinciden: boolean;
  diferenciaIvaDebitoClp: number;
  diferenciaIvaCreditoClp: number;
  diferenciaDocumentos: number;
  gateway: MetricasProveedor;
  simpleApi: MetricasProveedor;
  resumenComparativo: string;
}

export interface LogProveedorTributario {
  proveedor: string;
  companyId: string;
  periodo: string;
  fecha: string;
  tiempoMs: number;
  estado: string;
  resultado: string;
  error?: string | null;
}

export async function consultarSaludSimpleApi(): Promise<HealthCheckResult> {
  return simpleApiSiiProviderAdapter.healthCheck();
}

async function ejecutarYMedir(
  adapter: SiiProviderAdapter,
  query: ProviderQuery,
  nombre: string,
): Promise<MetricasProveedor> {
  const inicio = Date.now();
  try {
    const [ventas, compras] = await Promise.all([
      adapter.fetchSalesRcv(query).catch((err) => {
        console.error(`[Comparador] Error en ventas ${nombre}:`, err);
        return null;
      }),
      adapter.fetchPurchasesRcv(query).catch((err) => {
        console.error(`[Comparador] Error en compras ${nombre}:`, err);
        return null;
      }),
    ]);

    const tiempoMs = Date.now() - inicio;

    const cantVentas = ventas?.summary?.documentCount ?? 0;

    let cantCompras = 0;
    let totalIvaCredito = 0;
    if (compras?.rcvSummaryByStatus?.registered) {
      cantCompras = compras.rcvSummaryByStatus.registered.documentCount;
      totalIvaCredito = compras.rcvSummaryByStatus.registered.vatAmount;
    } else if (compras?.byStatus?.registered) {
      cantCompras = compras.byStatus.registered.length;
      totalIvaCredito = compras.byStatus.registered.reduce((acc, doc) => acc + (doc.vatAmount ?? 0), 0);
    }

    const totalIvaDebito = ventas?.rcvSummary?.vatAmount ?? (
      ventas?.documents ? ventas.documents.reduce((acc, doc) => acc + ((doc.vatAmount ?? 0) * (doc.taxEffect ?? 1)), 0) : 0
    );

    const remanente = Math.max(0, totalIvaCredito - totalIvaDebito);

    return {
      proveedor: nombre,
      id: adapter.id,
      tiempoMs,
      tiempoSegundosText: `${(tiempoMs / 1000).toFixed(2)} s`,
      estado: "exito",
      costoEstimadoCreditos: adapter.id === "api_gateway" ? 0.31 : 0.20,
      costoEstimadoClp: adapter.id === "api_gateway" ? 124 : 80,
      cantidadDocumentosVentas: cantVentas,
      cantidadDocumentosCompras: cantCompras,
      ivaDebitoClp: totalIvaDebito,
      ivaCreditoClp: totalIvaCredito,
      remanenteEstimadoClp: remanente,
    };
  } catch (e: any) {
    const tiempoMs = Date.now() - inicio;
    return {
      proveedor: nombre,
      id: adapter.id,
      tiempoMs,
      tiempoSegundosText: `${(tiempoMs / 1000).toFixed(2)} s`,
      estado: "error",
      costoEstimadoCreditos: 0,
      costoEstimadoClp: 0,
      cantidadDocumentosVentas: 0,
      cantidadDocumentosCompras: 0,
      ivaDebitoClp: 0,
      ivaCreditoClp: 0,
      remanenteEstimadoClp: 0,
      errorMensaje: e instanceof Error ? e.message : "Error durante la consulta",
    };
  }
}

export async function compararProveedoresTributarios(entrada: {
  companyId: string;
  rutEmpresa: string;
  periodo: string;
  usarMockParaGateway?: boolean;
}): Promise<ResultadoComparacionProveedores> {
  const query: ProviderQuery = {
    rut: entrada.rutEmpresa,
    period: entrada.periodo,
    providerConnectionRef: `cmp_${entrada.companyId}_${Date.now()}`,
  };

  const gatewayAdapter = entrada.usarMockParaGateway
    ? mockSiiProviderAdapter
    : apiGatewaySiiProviderAdapter;

  const [gatewayRes, simpleApiRes] = await Promise.all([
    ejecutarYMedir(gatewayAdapter, query, "Gateway SII"),
    ejecutarYMedir(simpleApiSiiProviderAdapter, query, "SimpleAPI Chile"),
  ]);

  const difIvaDebito = Math.abs(gatewayRes.ivaDebitoClp - simpleApiRes.ivaDebitoClp);
  const difIvaCredito = Math.abs(gatewayRes.ivaCreditoClp - simpleApiRes.ivaCreditoClp);
  const difDocs = Math.abs(
    (gatewayRes.cantidadDocumentosVentas + gatewayRes.cantidadDocumentosCompras) -
    (simpleApiRes.cantidadDocumentosVentas + simpleApiRes.cantidadDocumentosCompras)
  );

  const coinciden = difIvaDebito === 0 && difIvaCredito === 0 && difDocs === 0;

  const resultado: ResultadoComparacionProveedores = {
    periodo: entrada.periodo,
    empresaRut: entrada.rutEmpresa,
    empresaId: entrada.companyId,
    ejecutadoEn: new Date().toISOString(),
    coinciden,
    diferenciaIvaDebitoClp: difIvaDebito,
    diferenciaIvaCreditoClp: difIvaCredito,
    diferenciaDocumentos: difDocs,
    gateway: gatewayRes,
    simpleApi: simpleApiRes,
    resumenComparativo: coinciden
      ? "✔ Los resultados de Gateway y SimpleAPI coinciden al 100% en IVA Débito, IVA Crédito y documentos."
      : `❌ Se encontraron diferencias: $${difIvaDebito.toLocaleString("es-CL")} en IVA Débito y $${difIvaCredito.toLocaleString("es-CL")} en IVA Crédito.`,
  };

  // Log de auditoría
  await registrarLogProveedor({
    proveedor: "compare_mode",
    companyId: entrada.companyId,
    periodo: entrada.periodo,
    fecha: resultado.ejecutadoEn,
    tiempoMs: Math.max(gatewayRes.tiempoMs, simpleApiRes.tiempoMs),
    estado: coinciden ? "coinciden" : "diferencia",
    resultado: resultado.resumenComparativo,
    error: gatewayRes.errorMensaje || simpleApiRes.errorMensaje || null,
  });

  return resultado;
}

export async function registrarLogProveedor(log: LogProveedorTributario): Promise<void> {
  try {
    await supabaseAdmin.from("tax_activity_logs").insert({
      company_id: log.companyId,
      action: `tax_provider.${log.proveedor}.executed`,
      entity_type: "tax_provider",
      metadata: {
        proveedor: log.proveedor,
        periodo: log.periodo,
        tiempoMs: log.tiempoMs,
        estado: log.estado,
        resultado: log.resultado,
        error: log.error,
        fecha: log.fecha,
      },
    });
  } catch (err) {
    console.error("[Telemetría Proveedor] No se pudo guardar el log de auditoría:", err);
  }
}
