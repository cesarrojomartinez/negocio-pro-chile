import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MasterLayout } from "@/components/master/MasterLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Center Master B2B | Mi Negocio al Día" },
      {
        name: "description",
        content: "Centro de control ejecutivo SaaS para la administración de Mi Negocio al Día.",
      },
      { property: "og:title", content: "Center Master B2B | Mi Negocio al Día" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  return (
    <MasterLayout>
      <Outlet />
    </MasterLayout>
  );
}
