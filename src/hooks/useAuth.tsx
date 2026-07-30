import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export interface PerfilUsuario {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  perfil: PerfilUsuario | null;
  cargandoSesion: boolean;
  registrar: (datos: {
    nombre: string;
    apellido: string;
    email: string;
    password: string;
  }) => Promise<{ error: string | null; requiereConfirmacion: boolean }>;
  iniciarSesion: (email: string, password: string) => Promise<{ error: string | null }>;
  cerrarSesion: () => Promise<void>;
  recuperarClave: (email: string) => Promise<{ error: string | null }>;
  actualizarClave: (password: string) => Promise<{ error: string | null }>;
  guardarPerfil: (
    cambios: Partial<Omit<PerfilUsuario, "id">>,
  ) => Promise<{ error: string | null }>;
  refrescarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function mensajeAmigable(mensaje: string | undefined): string {
  const m = (mensaje ?? "").toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ya existe una cuenta con este correo.";
  if (m.includes("password")) return "La contraseña no cumple con los requisitos mínimos.";
  if (m.includes("email")) return "Revisa que el correo esté bien escrito.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  return "No pudimos completar la operación. Intenta nuevamente.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const cargarPerfil = useCallback(async (userId: string, user: User | null) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name, phone, avatar_url, onboarding_completed")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[perfil] no se pudo cargar", error);
      return;
    }

    if (data) {
      setPerfil(data as PerfilUsuario);
      return;
    }

    // Reparación para cuentas antiguas: los registros nuevos ya reciben su
    // perfil desde el trigger on_auth_user_created en la base de datos.
    const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
    const nuevo = {
      id: userId,
      first_name: meta.first_name ?? null,
      last_name: meta.last_name ?? null,
      display_name:
        [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
        (user?.email ?? null),
      onboarding_completed: false,
    };
    const { data: creado, error: errorCrear } = await supabase
      .from("profiles")
      .insert(nuevo)
      .select("id, first_name, last_name, display_name, phone, avatar_url, onboarding_completed")
      .maybeSingle();
    if (errorCrear) {
      console.error("[perfil] no se pudo crear", errorCrear);
      return;
    }
    if (creado) setPerfil(creado as PerfilUsuario);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva);
      setCargandoSesion(false);
      if (nueva?.user) {
        const u = nueva.user;
        setTimeout(() => void cargarPerfil(u.id, u), 0);
      } else {
        setPerfil(null);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargandoSesion(false);
      if (data.session?.user) {
        const u = data.session.user;
        void cargarPerfil(u.id, u);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [cargarPerfil]);

  const registrar = useCallback<AuthState["registrar"]>(async (datos) => {
    const { data, error } = await supabase.auth.signUp({
      email: datos.email.trim(),
      password: datos.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: datos.nombre.trim(),
          last_name: datos.apellido.trim(),
        },
      },
    });
    if (error) return { error: mensajeAmigable(error.message), requiereConfirmacion: false };
    return { error: null, requiereConfirmacion: !data.session };
  }, []);

  const iniciarSesion = useCallback<AuthState["iniciarSesion"]>(
    async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error: error ? mensajeAmigable(error.message) : null };
    },
    [],
  );

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  }, []);

  const recuperarClave = useCallback<AuthState["recuperarClave"]>(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/recuperar-clave`,
    });
    return { error: error ? mensajeAmigable(error.message) : null };
  }, []);

  const actualizarClave = useCallback<AuthState["actualizarClave"]>(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? mensajeAmigable(error.message) : null };
  }, []);

  const guardarPerfil = useCallback<AuthState["guardarPerfil"]>(
    async (cambios) => {
      const userId = session?.user?.id;
      if (!userId) return { error: "Tu sesión venció. Inicia sesión nuevamente." };
      const { data, error } = await supabase
        .from("profiles")
        .update(cambios)
        .eq("id", userId)
        .select("id, first_name, last_name, display_name, phone, avatar_url, onboarding_completed")
        .maybeSingle();
      if (error) {
        console.error("[perfil] no se pudo guardar", error);
        return { error: "No pudimos guardar tu perfil. Intenta nuevamente." };
      }
      if (data) setPerfil(data as PerfilUsuario);
      return { error: null };
    },
    [session?.user?.id],
  );

  const refrescarPerfil = useCallback(async () => {
    if (session?.user) await cargarPerfil(session.user.id, session.user);
  }, [cargarPerfil, session?.user]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      perfil,
      cargandoSesion,
      registrar,
      iniciarSesion,
      cerrarSesion,
      recuperarClave,
      actualizarClave,
      guardarPerfil,
      refrescarPerfil,
    }),
    [
      session,
      perfil,
      cargandoSesion,
      registrar,
      iniciarSesion,
      cerrarSesion,
      recuperarClave,
      actualizarClave,
      guardarPerfil,
      refrescarPerfil,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
