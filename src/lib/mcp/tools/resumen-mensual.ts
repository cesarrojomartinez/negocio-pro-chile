import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "resumen_mensual",
  title: "Resumen mensual estimado",
  description:
    "Entrega la estimación informativa de un periodo (ventas, compras, IVA, PPM, retenciones y total estimado) para una empresa. No reemplaza a tu contador.",
  inputSchema: {
    company_id: z.string().uuid().describe("Identificador de la empresa."),
    periodo: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .describe("Periodo en formato AAAA-MM, por ejemplo 2026-06."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, periodo }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tax_monthly_summaries")
      .select(
        "period, invoice_sales, exempt_sales, net_purchases, exempt_purchases, estimated_vat_payable, estimated_ppm, estimated_withholdings, estimated_tax_total, declared_tax_total, estimated_new_carryforward, confidence_level, calculation_status, calculated_at",
      )
      .eq("company_id", company_id)
      .eq("period", `${periodo}-01`)
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return {
        content: [
          {
            type: "text",
            text: `No hay resumen calculado para el periodo ${periodo}.`,
          },
        ],
        isError: true,
      };
    const aviso =
      "Estimación informativa. No reemplaza a tu contador ni constituye información oficial del SII.";
    return {
      content: [{ type: "text", text: JSON.stringify({ ...data, aviso }) }],
      structuredContent: { resumen: data, aviso },
    };
  },
});
