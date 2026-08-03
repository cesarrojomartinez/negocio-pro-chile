import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "historial_periodos",
  title: "Historial de periodos",
  description:
    "Lista los últimos periodos calculados de una empresa con su total estimado, total declarado y nivel de confianza.",
  inputSchema: {
    company_id: z.string().uuid().describe("Identificador de la empresa."),
    limite: z
      .number()
      .int()
      .min(1)
      .max(24)
      .default(12)
      .describe("Cantidad máxima de periodos a devolver."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, limite }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tax_monthly_summaries")
      .select(
        "period, invoice_sales, net_purchases, estimated_tax_total, declared_tax_total, f29_deviation_pct, confidence_level, calculation_status",
      )
      .eq("company_id", company_id)
      .order("period", { ascending: false })
      .limit(limite ?? 12);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    const aviso =
      "Estimaciones informativas. No reemplazan a tu contador ni son información oficial del SII.";
    return {
      content: [{ type: "text", text: JSON.stringify({ periodos: data ?? [], aviso }) }],
      structuredContent: { periodos: data ?? [], aviso },
    };
  },
});
