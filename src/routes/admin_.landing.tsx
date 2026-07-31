import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/shared/AppShell";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ETIQUETA_SECCION,
  type ContenidoLanding,
  type PlanPublico,
  type SeccionLanding,
  type TestimonioLanding,
  type VersionLanding,
} from "@/lib/landing";
import {
  actualizarPlanPublicoFn,
  eliminarTestimonioFn,
  guardarBorradorLandingFn,
  guardarTestimonioFn,
  landingAdminFn,
  publicarLandingFn,
  restaurarVersionLandingFn,
} from "@/lib/landing.functions";
import { formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/admin_/landing")({
  head: () => ({
    meta: [
      { title: "Editor de la landing | Mi Negocio al Día" },
      {
        name: "description",
        content: "Edita textos, planes y testimonios de la página pública.",
      },
      { property: "og:title", content: "Editor de la landing | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Administración interna del contenido público de Mi Negocio al Día.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditorLanding,
});

function EditorLanding() {
  const [contenido, setContenido] = useState<ContenidoLanding | null>(null);
  const [planes, setPlanes] = useState<PlanPublico[]>([]);
  const [testimonios, setTestimonios] = useState<TestimonioLanding[]>([]);
  const [historial, setHistorial] = useState<VersionLanding[]>([]);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const r = await landingAdminFn();
    if (r.ok) {
      setContenido(r.data.borrador);
      setPlanes(r.data.planes);
      setTestimonios(r.data.testimonios);
      setHistorial(r.data.historial);
      setPendiente(r.data.hayBorradorSinPublicar);
      setError(null);
    } else setError(r.error);
    setCargando(false);
  };

  useEffect(() => {
    void cargar();
  }, []);

  const editar = (cambio: (previo: ContenidoLanding) => ContenidoLanding) =>
    setContenido((previo) => (previo ? cambio(previo) : previo));

  const guardarBorrador = async () => {
    if (!contenido) return;
    setGuardando(true);
    const r = await guardarBorradorLandingFn({ data: { contenido } });
    setGuardando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Borrador guardado. Aún no es visible para el público.");
    await cargar();
  };

  const publicar = async () => {
    setGuardando(true);
    const r = await publicarLandingFn();
    setGuardando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Cambios publicados en la página pública.");
    await cargar();
  };

  if (cargando) {
    return (
      <AppShell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando editor…
        </p>
      </AppShell>
    );
  }

  if (error || !contenido) {
    return (
      <AppShell>
        <SectionCard titulo="Editor de la landing">
          <p className="text-sm text-muted-foreground">
            {error ?? "No pudimos cargar el editor."}
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="space-y-2">
          <h1 className="text-xl font-bold sm:text-2xl">Editor de la landing</h1>
          <p className="text-sm text-muted-foreground">
            Cambia textos, planes y testimonios de la página pública. Los cambios se
            guardan como borrador y solo se ven cuando publicas.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/admin" className="font-medium text-primary hover:underline">
              Volver al panel
            </Link>
            <Link to="/" className="text-muted-foreground hover:underline">
              Ver la landing pública
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void guardarBorrador()} disabled={guardando}>
              <Save className="mr-1 h-4 w-4" aria-hidden /> Guardar borrador
            </Button>
            <Button
              variant="outline"
              onClick={() => void publicar()}
              disabled={guardando}
            >
              <Upload className="mr-1 h-4 w-4" aria-hidden /> Publicar
            </Button>
            {pendiente && (
              <span className="self-center rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
                Tienes cambios sin publicar
              </span>
            )}
          </div>
        </header>

        <SectionCard titulo="Portada (hero)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              label="Etiqueta"
              valor={contenido.hero.etiqueta}
              onChange={(v) =>
                editar((c) => ({ ...c, hero: { ...c.hero, etiqueta: v } }))
              }
            />
            <Campo
              label="Título"
              valor={contenido.hero.titulo}
              onChange={(v) => editar((c) => ({ ...c, hero: { ...c.hero, titulo: v } }))}
            />
            <Campo
              label="Título destacado"
              valor={contenido.hero.tituloDestacado}
              onChange={(v) =>
                editar((c) => ({ ...c, hero: { ...c.hero, tituloDestacado: v } }))
              }
            />
            <Campo
              label="Nota al pie"
              valor={contenido.hero.notaPie}
              onChange={(v) =>
                editar((c) => ({ ...c, hero: { ...c.hero, notaPie: v } }))
              }
            />
            <Campo
              label="Botón principal"
              valor={contenido.hero.botonPrimario}
              onChange={(v) =>
                editar((c) => ({ ...c, hero: { ...c.hero, botonPrimario: v } }))
              }
            />
            <Campo
              label="Botón secundario"
              valor={contenido.hero.botonSecundario}
              onChange={(v) =>
                editar((c) => ({ ...c, hero: { ...c.hero, botonSecundario: v } }))
              }
            />
          </div>
          <AreaTexto
            label="Descripción"
            valor={contenido.hero.descripcion}
            onChange={(v) =>
              editar((c) => ({ ...c, hero: { ...c.hero, descripcion: v } }))
            }
          />
          <ListaTextos
            label="Beneficios de la portada"
            valores={contenido.hero.beneficios}
            onChange={(v) =>
              editar((c) => ({ ...c, hero: { ...c.hero, beneficios: v } }))
            }
          />
        </SectionCard>

        <SectionCard titulo="Secciones y orden">
          <div className="space-y-2">
            {contenido.orden.map((seccion, indice) => (
              <div
                key={seccion}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
              >
                <p className="min-w-0 truncate text-sm font-medium">
                  {ETIQUETA_SECCION[seccion]}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Subir ${ETIQUETA_SECCION[seccion]}`}
                    disabled={indice === 0}
                    onClick={() =>
                      editar((c) => ({ ...c, orden: mover(c.orden, indice, -1) }))
                    }
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Bajar ${ETIQUETA_SECCION[seccion]}`}
                    disabled={indice === contenido.orden.length - 1}
                    onClick={() =>
                      editar((c) => ({ ...c, orden: mover(c.orden, indice, 1) }))
                    }
                  >
                    ↓
                  </Button>
                  <Switch
                    checked={contenido[seccion].visible}
                    aria-label={`Mostrar ${ETIQUETA_SECCION[seccion]}`}
                    onCheckedChange={(v) =>
                      editar((c) => ({
                        ...c,
                        [seccion]: { ...c[seccion], visible: v },
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard titulo="Textos de las secciones">
          <div className="space-y-4">
            <Campo
              label="Título · Problema y solución"
              valor={contenido.problema.titulo}
              onChange={(v) =>
                editar((c) => ({ ...c, problema: { ...c.problema, titulo: v } }))
              }
            />
            <AreaTexto
              label="Descripción · Problema y solución"
              valor={contenido.problema.descripcion}
              onChange={(v) =>
                editar((c) => ({ ...c, problema: { ...c.problema, descripcion: v } }))
              }
            />
            <ItemsEditor
              label="Tarjetas · Problema y solución"
              items={contenido.problema.items}
              onChange={(items) =>
                editar((c) => ({ ...c, problema: { ...c.problema, items } }))
              }
            />

            <Campo
              label="Título · Testimonios"
              valor={contenido.testimonios.titulo}
              onChange={(v) =>
                editar((c) => ({ ...c, testimonios: { ...c.testimonios, titulo: v } }))
              }
            />
            <Campo
              label="Nota · Testimonios"
              valor={contenido.testimonios.nota}
              onChange={(v) =>
                editar((c) => ({ ...c, testimonios: { ...c.testimonios, nota: v } }))
              }
            />

            <Campo
              label="Título · Beneficios"
              valor={contenido.beneficios.titulo}
              onChange={(v) =>
                editar((c) => ({ ...c, beneficios: { ...c.beneficios, titulo: v } }))
              }
            />
            <ItemsEditor
              label="Tarjetas · Beneficios"
              items={contenido.beneficios.items}
              onChange={(items) =>
                editar((c) => ({ ...c, beneficios: { ...c.beneficios, items } }))
              }
            />
            <ListaTextos
              label="Sellos de confianza"
              valores={contenido.beneficios.sellos}
              onChange={(sellos) =>
                editar((c) => ({ ...c, beneficios: { ...c.beneficios, sellos } }))
              }
            />

            <Campo
              label="Título · Planes"
              valor={contenido.planes.titulo}
              onChange={(v) =>
                editar((c) => ({ ...c, planes: { ...c.planes, titulo: v } }))
              }
            />
            <Campo
              label="Subtítulo · Planes"
              valor={contenido.planes.subtitulo}
              onChange={(v) =>
                editar((c) => ({ ...c, planes: { ...c.planes, subtitulo: v } }))
              }
            />
            <Campo
              label="Nota · Planes"
              valor={contenido.planes.nota}
              onChange={(v) =>
                editar((c) => ({ ...c, planes: { ...c.planes, nota: v } }))
              }
            />
            <Campo
              label="Texto del botón de los planes"
              valor={contenido.planes.textoBoton}
              onChange={(v) =>
                editar((c) => ({ ...c, planes: { ...c.planes, textoBoton: v } }))
              }
            />

            <Campo
              label="Título · Llamado final"
              valor={contenido.cierre.titulo}
              onChange={(v) =>
                editar((c) => ({ ...c, cierre: { ...c.cierre, titulo: v } }))
              }
            />
            <AreaTexto
              label="Descripción · Llamado final"
              valor={contenido.cierre.descripcion}
              onChange={(v) =>
                editar((c) => ({ ...c, cierre: { ...c.cierre, descripcion: v } }))
              }
            />
          </div>
        </SectionCard>

        <SectionCard titulo="Pie de página y textos legales">
          <AreaTexto
            label="Descripción"
            valor={contenido.footer.descripcion}
            onChange={(v) =>
              editar((c) => ({ ...c, footer: { ...c.footer, descripcion: v } }))
            }
          />
          <AreaTexto
            label="Soporte"
            valor={contenido.footer.soporte}
            onChange={(v) =>
              editar((c) => ({ ...c, footer: { ...c.footer, soporte: v } }))
            }
          />
          <AreaTexto
            label="Términos"
            valor={contenido.footer.terminos}
            onChange={(v) =>
              editar((c) => ({ ...c, footer: { ...c.footer, terminos: v } }))
            }
          />
          <AreaTexto
            label="Privacidad"
            valor={contenido.footer.privacidad}
            onChange={(v) =>
              editar((c) => ({ ...c, footer: { ...c.footer, privacidad: v } }))
            }
          />
          <Campo
            label="Línea legal"
            valor={contenido.footer.legal}
            onChange={(v) =>
              editar((c) => ({ ...c, footer: { ...c.footer, legal: v } }))
            }
          />
        </SectionCard>

        <SectionCard titulo="Planes publicados">
          <p className="mb-3 text-xs text-muted-foreground">
            Aquí solo cambias cómo se muestran los planes. Los límites y cuotas del
            servicio no se modifican desde esta pantalla.
          </p>
          <div className="space-y-4">
            {planes.map((plan) => (
              <EditorPlan
                key={plan.id}
                plan={plan}
                onGuardado={() => void cargar()}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard titulo="Testimonios">
          <div className="space-y-4">
            {testimonios.map((t) => (
              <EditorTestimonio
                key={t.id}
                testimonio={t}
                onGuardado={() => void cargar()}
              />
            ))}
            <EditorTestimonio
              nuevo
              testimonio={{
                id: "",
                nombre: "",
                rubro: "",
                testimonio: "",
                imagenUrl: null,
                orden: testimonios.length + 1,
                visible: true,
                destacado: false,
              }}
              onGuardado={() => void cargar()}
            />
          </div>
        </SectionCard>

        <SectionCard titulo="Historial de versiones">
          <div className="space-y-2">
            {historial.map((v) => (
              <div
                key={v.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    Versión {v.version} · {etiquetaEstado(v.estado)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatFechaHora(v.actualizado)}
                    {v.nota ? ` · ${v.nota}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const r = await restaurarVersionLandingFn({
                      data: { versionId: v.id },
                    });
                    if (!r.ok) {
                      toast.error(r.error);
                      return;
                    }
                    toast.success("Versión restaurada como borrador.");
                    await cargar();
                  }}
                >
                  Restaurar
                </Button>
              </div>
            ))}
            {historial.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay versiones.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function etiquetaEstado(estado: VersionLanding["estado"]) {
  if (estado === "published") return "Publicada";
  if (estado === "draft") return "Borrador";
  return "Archivada";
}

function mover<T>(lista: T[], indice: number, delta: number): T[] {
  const copia = [...lista];
  const destino = indice + delta;
  const actual = copia[indice] as T;
  const otro = copia[destino] as T;
  copia[indice] = otro;
  copia[destino] = actual;
  return copia;
}

function Campo({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={valor} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AreaTexto({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        rows={3}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ListaTextos({
  label,
  valores,
  onChange,
}: {
  label: string;
  valores: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {valores.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={v}
            aria-label={`${label} ${i + 1}`}
            onChange={(e) =>
              onChange(valores.map((x, j) => (j === i ? e.target.value : x)))
            }
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Quitar"
            onClick={() => onChange(valores.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...valores, ""])}>
        <Plus className="mr-1 h-4 w-4" aria-hidden /> Agregar
      </Button>
    </div>
  );
}

function ItemsEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: { titulo: string; descripcion: string }[];
  onChange: (items: { titulo: string; descripcion: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border p-3">
          <Input
            value={item.titulo}
            aria-label={`${label}: título ${i + 1}`}
            onChange={(e) =>
              onChange(
                items.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)),
              )
            }
          />
          <Textarea
            rows={2}
            value={item.descripcion}
            aria-label={`${label}: descripción ${i + 1}`}
            onChange={(e) =>
              onChange(
                items.map((x, j) =>
                  j === i ? { ...x, descripcion: e.target.value } : x,
                ),
              )
            }
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Quitar
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { titulo: "", descripcion: "" }])}
      >
        <Plus className="mr-1 h-4 w-4" aria-hidden /> Agregar tarjeta
      </Button>
    </div>
  );
}

function EditorPlan({
  plan,
  onGuardado,
}: {
  plan: PlanPublico;
  onGuardado: () => void;
}) {
  const [borrador, setBorrador] = useState(plan);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => setBorrador(plan), [plan]);

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="min-w-0 truncate text-sm font-semibold">
          {borrador.nombre}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({borrador.codigo})
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            {borrador.publico ? (
              <Eye className="h-4 w-4" aria-hidden />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden />
            )}
            Visible
          </span>
          <Switch
            checked={borrador.publico}
            aria-label={`Mostrar plan ${borrador.nombre}`}
            onCheckedChange={(v) => setBorrador({ ...borrador, publico: v })}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Nombre"
          valor={borrador.nombre}
          onChange={(v) => setBorrador({ ...borrador, nombre: v })}
        />
        <Campo
          label="Periodicidad"
          valor={borrador.periodicidad}
          onChange={(v) => setBorrador({ ...borrador, periodicidad: v })}
        />
        <div className="space-y-1.5">
          <Label>Precio mensual (CLP)</Label>
          <Input
            type="number"
            min={0}
            value={borrador.precioClp ?? ""}
            onChange={(e) =>
              setBorrador({
                ...borrador,
                precioClp: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Orden</Label>
          <Input
            type="number"
            value={borrador.orden}
            onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })}
          />
        </div>
      </div>
      <AreaTexto
        label="Descripción"
        valor={borrador.descripcion}
        onChange={(v) => setBorrador({ ...borrador, descripcion: v })}
      />
      <ListaTextos
        label="Características"
        valores={borrador.caracteristicas}
        onChange={(caracteristicas) => setBorrador({ ...borrador, caracteristicas })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={borrador.destacado}
            aria-label={`Destacar plan ${borrador.nombre}`}
            onCheckedChange={(v) => setBorrador({ ...borrador, destacado: v })}
          />
          Destacar como más elegido
        </label>
        <Button
          size="sm"
          disabled={guardando}
          onClick={async () => {
            setGuardando(true);
            const r = await actualizarPlanPublicoFn({
              data: {
                id: borrador.id,
                nombre: borrador.nombre,
                descripcion: borrador.descripcion,
                precioClp: borrador.precioClp,
                periodicidad: borrador.periodicidad,
                caracteristicas: borrador.caracteristicas,
                destacado: borrador.destacado,
                publico: borrador.publico,
                orden: borrador.orden,
              },
            });
            setGuardando(false);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            toast.success("Plan actualizado.");
            onGuardado();
          }}
        >
          <Save className="mr-1 h-4 w-4" aria-hidden /> Guardar plan
        </Button>
      </div>
    </div>
  );
}

function EditorTestimonio({
  testimonio,
  nuevo = false,
  onGuardado,
}: {
  testimonio: TestimonioLanding;
  nuevo?: boolean;
  onGuardado: () => void;
}) {
  const [borrador, setBorrador] = useState(testimonio);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => setBorrador(testimonio), [testimonio]);

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <p className="text-sm font-semibold">
        {nuevo ? "Agregar testimonio" : borrador.nombre}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Nombre"
          valor={borrador.nombre}
          onChange={(v) => setBorrador({ ...borrador, nombre: v })}
        />
        <Campo
          label="Rubro"
          valor={borrador.rubro}
          onChange={(v) => setBorrador({ ...borrador, rubro: v })}
        />
        <Campo
          label="Imagen (URL, opcional)"
          valor={borrador.imagenUrl ?? ""}
          onChange={(v) => setBorrador({ ...borrador, imagenUrl: v })}
        />
        <div className="space-y-1.5">
          <Label>Orden</Label>
          <Input
            type="number"
            value={borrador.orden}
            onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })}
          />
        </div>
      </div>
      <AreaTexto
        label="Testimonio"
        valor={borrador.testimonio}
        onChange={(v) => setBorrador({ ...borrador, testimonio: v })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={borrador.visible}
            aria-label="Mostrar testimonio"
            onCheckedChange={(v) => setBorrador({ ...borrador, visible: v })}
          />
          Visible
        </label>
        <Button
          size="sm"
          disabled={guardando}
          onClick={async () => {
            setGuardando(true);
            const r = await guardarTestimonioFn({
              data: {
                id: nuevo ? null : borrador.id,
                nombre: borrador.nombre,
                rubro: borrador.rubro,
                testimonio: borrador.testimonio,
                imagenUrl: borrador.imagenUrl,
                orden: borrador.orden,
                visible: borrador.visible,
                destacado: borrador.destacado,
              },
            });
            setGuardando(false);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            toast.success(nuevo ? "Testimonio agregado." : "Testimonio actualizado.");
            onGuardado();
          }}
        >
          <Save className="mr-1 h-4 w-4" aria-hidden />
          {nuevo ? "Agregar" : "Guardar"}
        </Button>
        {!nuevo && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await eliminarTestimonioFn({ data: { id: borrador.id } });
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              toast.success("Testimonio eliminado.");
              onGuardado();
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Eliminar
          </Button>
        )}
      </div>
    </div>
  );
}
