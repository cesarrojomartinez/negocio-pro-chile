import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const RELOAD_KEY = "chunk-reload-once";

function recargarUnaVez() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    // sessionStorage bloqueado: recargamos igual
  }
  window.location.reload();
}

if (typeof window !== "undefined") {
  // Un despliegue nuevo invalida los chunks del build anterior: recargamos.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    recargarUnaVez();
  });
  window.addEventListener("unhandledrejection", (event) => {
    const mensaje = String(
      (event.reason as { message?: string } | undefined)?.message ?? event.reason ?? "",
    );
    if (/dynamically imported module|Importing a module script failed/i.test(mensaje)) {
      recargarUnaVez();
    }
  });
  window.addEventListener("load", () => {
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // sin acceso a sessionStorage
    }
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

