import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => {
  const chainUserRoles = {
    select: () => chainUserRoles,
    eq: () => chainUserRoles,
    maybeSingle: () => Promise.resolve({ data: { role: "admin" }, error: null }),
  };

  const chainCompanies = {
    select: () => chainCompanies,
    order: () => Promise.resolve({
      data: [
        { id: "comp-1", rut: "76.123.456-7", business_name: "Empresa Demo 1", created_at: "2026-01-01" },
      ],
      error: null,
    }),
  };

  const chainSubs = {
    select: () => chainSubs,
    in: () => Promise.resolve({
      data: [{ company_id: "comp-1", plan: { name: "Pro Plan" } }],
      error: null,
    }),
  };

  const chainWallets = {
    select: () => chainWallets,
    in: () => Promise.resolve({
      data: [{ company_id: "comp-1", balance: 4000, monthly_allowance: 10000, updated_at: "2026-06-01" }],
      error: null,
    }),
  };

  return {
    supabaseAdmin: {
      from: (table: string) => {
        if (table === "user_roles") return chainUserRoles;
        if (table === "tax_companies") return chainCompanies;
        if (table === "tax_company_subscriptions") return chainSubs;
        if (table === "master_ai_wallets") return chainWallets;
        return {
          select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
        };
      },
    },
  };
});

import { listarWalletsIAMaster } from "../cuenta.server";

describe("listarWalletsIAMaster", () => {
  it("obtiene el resumen de billeteras IA sin lanzar TypeError ni excepciones", async () => {
    const res = await listarWalletsIAMaster("admin-id");
    expect(res).toBeDefined();
    expect(res.resumen.empresasActivas).toBe(1);
    expect(res.billeteras).toHaveLength(1);
    expect(res.billeteras[0].companyId).toBe("comp-1");
    expect(res.billeteras[0].balance).toBe(4000);
    expect(res.billeteras[0].consumedMonth).toBe(6000);
  });
});
