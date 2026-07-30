/** Envoltorio común: nunca expone detalles técnicos al usuario final. */
export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export async function envolver<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    const mensaje =
      error instanceof Error && error.name === "ErrorNegocio"
        ? error.message
        : error instanceof Error && error.constructor.name === "ErrorNegocio"
          ? error.message
          : "No pudimos completar la operación. Intenta nuevamente.";
    console.error("[servidor]", error);
    return { ok: false, error: mensaje };
  }
}
