import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

export const Route = createFileRoute("/admin/landing")({
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
      <div className="flex h-64 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden /> Cargando editor de la landing...
        </p>
      </div>
    );
  }

  if (error || !contenido) {
    return (
      <SectionCard titulo="Editor de la landing">
        <p className="text-sm text-muted-foreground">
          {error ?? "No pudimos cargar el editor."}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-bold sm:text-2xl">Editor de la landing</h1>
        <p className="text-sm text-muted-foreground">
          Cambia textos, planes y testimonios de la página pública. Los cambios se
          guardan como borrador y solo se ven cuando publicas.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link to="/admin" className="font-medium text-primary hover:underline">
            Volver al panel Master
          </Link>
          <Link to="/" target="_blank" className="text-muted-foreground hover:underline">
            Ver la landing pública (pestaña nueva)
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
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
            <span className="self-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 border border-amber-200">
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
  );
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
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs"
      />
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
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="text-xs"
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
      <Label className="text-xs">{label}</Label>
      {valores.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={v}
            onChange={(e) => {
              const copia = [...valores];
              copia[i] = e.target.value;
              onChange(copia);
            }}
            className="text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange(valores.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...valores, "Nuevo elemento"])}
      >
        <Plus className="mr-1 h-4 w-4" /> Agregar elemento
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
    <div className="space-y-3">
      <Label className="text-xs">{label}</Label>
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Tarjeta #{i + 1}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            placeholder="Título"
            value={it.titulo}
            onChange={(e) => {
              const copia = [...items];
              copia[i] = { ...copia[i], titulo: e.target.value };
              onChange(copia);
            }}
            className="text-xs"
          />
          <Textarea
            placeholder="Descripción"
            value={it.descripcion}
            onChange={(e) => {
              const copia = [...items];
              copia[i] = { ...copia[i], descripcion: e.target.value };
              onChange(copia);
            }}
            rows={2}
            className="text-xs"
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([...items, { titulo: "Nuevo título", descripcion: "Nueva descripción" }])
        }
      >
        <Plus className="mr-1 h-4 w-4" /> Agregar tarjeta
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

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">{plan.nombre}</h4>
        <Switch
          checked={borrador.destacado}
          onCheckedChange={(v) => setBorrador({ ...borrador, destacado: v })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Nombre visible"
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          className="text-xs"
        />
        <Input
          type="number"
          placeholder="Precio CLP"
          value={borrador.precioClp ?? ""}
          onChange={(e) => setBorrador({ ...borrador, precioClp: e.target.value ? Number(e.target.value) : null })}
          className="text-xs"
        />
        <Input
          placeholder="Periodicidad (ej: mensual)"
          value={borrador.periodicidad}
          onChange={(e) => setBorrador({ ...borrador, periodicidad: e.target.value })}
          className="text-xs"
        />
      </div>
      <Textarea
        placeholder="Descripción"
        value={borrador.descripcion}
        onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
        rows={2}
        className="text-xs"
      />
      <ListaTextos
        label="Características en lista"
        valores={borrador.caracteristicas}
        onChange={(caracteristicas) => setBorrador({ ...borrador, caracteristicas })}
      />
      <div className="flex justify-end pt-2">
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
          <Save className="mr-1 h-4 w-4" /> Guardar plan
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

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">
          {nuevo ? "Agregar nuevo testimonio" : `Testimonio de ${planNombre(borrador.nombre)}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Destacado</span>
          <Switch
            checked={borrador.destacado}
            onCheckedChange={(v) => setBorrador({ ...borrador, destacado: v })}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Nombre del cliente"
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          className="text-xs"
        />
        <Input
          placeholder="Rubro o empresa"
          value={borrador.rubro}
          onChange={(e) => setBorrador({ ...borrador, rubro: e.target.value })}
          className="text-xs"
        />
      </div>
      <Textarea
        placeholder="Testimonio"
        value={borrador.testimonio}
        onChange={(e) => setBorrador({ ...borrador, testimonio: e.target.value })}
        rows={3}
        className="text-xs"
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button
          size="sm"
          disabled={guardando}
          onClick={async () => {
            if (!borrador.nombre || !borrador.testimonio) {
              toast.error("Ingresa nombre y testimonio.");
              return;
            }
            setGuardando(true);
            const r = await guardarTestimonioFn({
              data: {
                id: nuevo ? undefined : borrador.id,
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

function planNombre(nombre: string) {
  return nombre.trim() || "Cliente";
}

function mover<T>(lista: T[], indice: number, direccion: number): T[] {
  const copia = [...lista];
  const nuevoIndice = indice + direccion;
  if (nuevoIndice < 0 || nuevoIndice >= lista.length) return lista;
  const temp = copia[indice];
  copia[indice] = copia[nuevoIndice];
  copia[nuevoIndice] = temp;
  return copia;
}

function etiquetaEstado(e: string): string {
  if (e === "published") return "Publicada";
  if (e === "draft") return "Borrador";
  return e;
}
