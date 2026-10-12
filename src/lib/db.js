import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(URL, KEY);

// Cliente secundario. Se usa SOLO para crear cuentas de alumnos:
// al no guardar sesión, el coach no pierde la suya al dar de alta a alguien.
const silencioso = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Los alumnos entran con usuario, no con email. Internamente lo convertimos
// a un email que nunca se usa para enviar nada.
const DOMINIO = "proclub.local";
const aEmail = (usuario) => `${usuario.trim().toLowerCase()}@${DOMINIO}`;

const ESTADOS = {
  activo: "active",
  pendiente: "pending",
  inactivo: "inactive",
  rechazado: "rejected",
};

function perfilAUsuario(p) {
  return {
    id: p.id,
    username: p.username || "",
    role: p.rol === "coach" ? "admin" : "alumno",
    name: p.nombre,
    requestedName: p.nombre,
    studentId: p.id,
    status: ESTADOS[p.estado] || "inactive",
  };
}

function filaAAlumno(p, fila) {
  const d = (fila && fila.data) || {};
  return {
    id: p.id,
    name: d.name || p.nombre,
    since: d.since || new Date().toLocaleDateString("es-AR", { month: "short", year: "numeric" }),
    inactive: d.inactive ?? 0,
    lastDay: d.lastDay || "Aún no registra",
    exercises: d.exercises || [],
    blocks: d.blocks || [],
  };
}

/* ─── SESIÓN ─────────────────────────────────────────────── */

export async function signIn(usuario, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: aEmail(usuario),
    password,
  });
  if (error) return { error: "Usuario o contraseña incorrectos" };

  const { data: perfil } = await supabase
    .from("profiles").select("estado").eq("id", data.user.id).single();

  if (!perfil || perfil.estado !== "activo") {
    await supabase.auth.signOut();
    if (perfil?.estado === "pendiente")
      return { error: "Tu solicitud está pendiente de aprobación. El coach te avisará." };
    return { error: "Tu cuenta no está activa. Contactá al coach." };
  }
  return { ok: true };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/* ─── CARGA DE DATOS ─────────────────────────────────────── */
// Las políticas RLS deciden qué ve cada uno: el coach ve todos los
// perfiles y todos los alumnos; el alumno ve únicamente el suyo.

export async function loadAll() {
  const { data: sesion } = await supabase.auth.getUser();
  const user = sesion?.user;
  if (!user) return null;

  const { data: perfiles, error } = await supabase.from("profiles").select("*");
  if (error || !perfiles?.length) return null;

  const yo = perfiles.find((p) => p.id === user.id);
  if (!yo) return null;

  const { data: filas } = await supabase.from("alumnos").select("*");
  const porId = Object.fromEntries((filas || []).map((f) => [f.id, f]));

  return {
    me: perfilAUsuario(yo),
    users: perfiles.map(perfilAUsuario),
    students: perfiles.filter((p) => p.rol === "alumno").map((p) => filaAAlumno(p, porId[p.id])),
  };
}

/* ─── GUARDADO ───────────────────────────────────────────── */

export async function saveStudent(alumno) {
  const { id, ...data } = alumno;
  const { error } = await supabase
    .from("alumnos")
    .upsert({ id, data, updated_at: new Date().toISOString() });
  if (error) console.error("No se pudo guardar el alumno:", error.message);
  return !error;
}

/* ─── ALTAS Y ESTADOS ────────────────────────────────────── */

// El coach da de alta a un alumno: queda activo de entrada.
export async function createStudent({ name, username, password }) {
  const u = username.trim().toLowerCase();

  const { data: existe } = await supabase
    .from("profiles").select("id").eq("username", u).maybeSingle();
  if (existe) return { error: "Ese usuario ya existe" };

  const { data, error } = await silencioso.auth.signUp({
    email: aEmail(u),
    password,
    options: { data: { nombre: name.trim(), username: u } },
  });
  if (error) {
    if (error.message?.toLowerCase().includes("already")) return { error: "Ese usuario ya existe" };
    if (error.message?.toLowerCase().includes("password")) return { error: "La contraseña debe tener al menos 6 caracteres" };
    return { error: error.message };
  }

  const id = data.user?.id;
  if (!id) return { error: "No se pudo crear la cuenta" };

  await supabase.from("profiles").update({ estado: "activo" }).eq("id", id);
  return { id };
}

// El alumno se registra solo: queda pendiente hasta que el coach lo apruebe.
export async function requestMembership({ name, username, password }) {
  const u = username.trim().toLowerCase();
  const { error } = await silencioso.auth.signUp({
    email: aEmail(u),
    password,
    options: { data: { nombre: name.trim(), username: u } },
  });
  if (error) {
    if (error.message?.toLowerCase().includes("already")) return { error: "Ese usuario ya existe" };
    if (error.message?.toLowerCase().includes("password")) return { error: "La contraseña debe tener al menos 6 caracteres" };
    return { error: error.message };
  }
  return { ok: true };
}

export async function setEstado(id, estado) {
  const { error } = await supabase.from("profiles").update({ estado }).eq("id", id);
  if (error) console.error("No se pudo cambiar el estado:", error.message);
  return !error;
}
