import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_empresas",
  title: "Listar empresas",
  description:
    "Lista las empresas a las que tiene acceso la persona conectada, con su RUT, periodo activo y estado de conexión.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tax_companies")
      .select("id, business_name, fantasy_name, rut, active_period, connection_status, is_demo")
      .order("business_name");
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { empresas: data ?? [] },
    };
  },
});
