import { useState } from "react";
import { Globe, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfiguracionLanding } from "@/lib/configuracion";

export function TabLanding({
  datos,
  onGuardar,
  onRestablecer,
  guardando,
}: {
  datos: ConfiguracionLanding;
  onGuardar: (valores: ConfiguracionLanding) => void;
  onRestablecer: () => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<ConfiguracionLanding>(datos);

  const handleHero = (campo: keyof ConfiguracionLanding["hero"], valor: string) => {
    setForm((prev) => ({
      ...prev,
      hero: { ...prev.hero, [campo]: valor },
    }));
  };

  const handleSeo = (campo: keyof ConfiguracionLanding["seo"], valor: string) => {
    setForm((prev) => ({
      ...prev,
      seo: { ...prev.seo, [campo]: valor },
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Configuración de Landing Page & Hero
              </CardTitle>
              <CardDescription className="text-xs">
                Administra los contenidos comerciales principales visibles en la portada pública.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRestablecer} disabled={guardando}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restablecer
              </Button>
              <Button size="sm" onClick={() => onGuardar(form)} disabled={guardando}>
                <Save className="h-3.5 w-3.5 mr-1" /> {guardando ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Etiqueta Superior Hero</Label>
              <Input
                value={form.hero.etiqueta}
                onChange={(e) => handleHero("etiqueta", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Título Principal</Label>
              <Input
                value={form.hero.titulo}
                onChange={(e) => handleHero("titulo", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Título Destacado</Label>
              <Input
                value={form.hero.tituloDestacado}
                onChange={(e) => handleHero("tituloDestacado", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Texto Botón Primario</Label>
              <Input
                value={form.hero.botonPrimario}
                onChange={(e) => handleHero("botonPrimario", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Texto Botón Secundario</Label>
              <Input
                value={form.hero.botonSecundario}
                onChange={(e) => handleHero("botonSecundario", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL Video Demostración</Label>
              <Input
                value={form.hero.videoDemoUrl}
                onChange={(e) => handleHero("videoDemoUrl", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción Hero</Label>
            <Textarea
              rows={3}
              value={form.hero.descripcion}
              onChange={(e) => handleHero("descripcion", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Posicionamiento SEO & Meta Tags</CardTitle>
          <CardDescription className="text-xs">
            Optimiza la indexación en buscadores y la visualización al compartir en redes sociales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label>Meta Title</Label>
            <Input
              value={form.seo.metaTitle}
              onChange={(e) => handleSeo("metaTitle", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Meta Description</Label>
            <Textarea
              rows={2}
              value={form.seo.metaDescription}
              onChange={(e) => handleSeo("metaDescription", e.target.value)}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Palabras Clave (Keywords)</Label>
              <Input
                value={form.seo.keywords}
                onChange={(e) => handleSeo("keywords", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL Imagen OpenGraph (Social Share)</Label>
              <Input
                value={form.seo.openGraphImageUrl}
                onChange={(e) => handleSeo("openGraphImageUrl", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
