import { Link } from "@tanstack/react-router";
import { Calculator, Menu } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { esAdministradorFn } from "@/lib/cuenta.functions";

const ENLACES = [
  { to: "/demo", label: "Demo" },
  { to: "/planes", label: "Planes" },
] as const;

export function LandingHeader() {
  const { session, cargandoSesion } = useAuth();
  const [esAdmin, setEsAdmin] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    if (!session) {
      setEsAdmin(false);
      return;
    }
    void esAdministradorFn().then((r) => {
      if (vigente) setEsAdmin(r.ok && r.data === true);
    });
    return () => {
      vigente = false;
    };
  }, [session]);

  const conSesion = !cargandoSesion && !!session;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Calculator className="h-5 w-5" aria-hidden />
          </span>
          <span className="truncate text-base font-extrabold sm:text-lg">
            Mi Negocio al Día
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación">
          {ENLACES.map((e) => (
            <Button key={e.to} variant="ghost" size="sm" asChild>
              <Link to={e.to}>{e.label}</Link>
            </Button>
          ))}
          {conSesion ? (
            <>
              {esAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin">Ir al Master</Link>
                </Button>
              )}
              <Button size="sm" asChild>
                <Link to="/demo">Ir a mi negocio</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Inicia sesión</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/registro" search={{ plan: undefined }}>Regístrate</Link>
              </Button>
            </>
          )}
        </nav>

        <Sheet open={abierto} onOpenChange={setAbierto}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Abrir menú">
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-xs">
            <SheetHeader>
              <SheetTitle>Mi Negocio al Día</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-2">
              {ENLACES.map((e) => (
                <Button
                  key={e.to}
                  variant="ghost"
                  className="justify-start"
                  asChild
                  onClick={() => setAbierto(false)}
                >
                  <Link to={e.to}>{e.label}</Link>
                </Button>
              ))}
              {conSesion ? (
                <>
                  {esAdmin && (
                    <Button variant="outline" asChild onClick={() => setAbierto(false)}>
                      <Link to="/admin">Ir al Master</Link>
                    </Button>
                  )}
                  <Button asChild onClick={() => setAbierto(false)}>
                    <Link to="/demo">Ir a mi negocio</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    asChild
                    onClick={() => setAbierto(false)}
                  >
                    <Link to="/auth">Inicia sesión</Link>
                  </Button>
                  <Button asChild onClick={() => setAbierto(false)}>
                    <Link to="/registro" search={{ plan: undefined }}>Regístrate</Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
