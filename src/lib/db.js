import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(URL, KEY);

// Cliente secundario. Se usa SOLO para crear cuentas de alumnos:
// al no guardar sesión, el coach no pierde la suya al dar de alta a alguien.
const silencioso = createClient(URL, KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: "proclub-alta-alumnos",
  },
});

// Los alumnos entran con usuario, no con email. Internamente lo convertimos
// a un email que nunca se usa para enviar nada.
const DOMINIO = "proclub.local";

// Deja el usuario en algo que sirva como email: sin espacios, sin
// mayusculas, sin tildes ni simbolos. "Nico Nievas" -> "niconievas"
export function normalizarUsuario(texto = "") {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

const aEmail = (usuario) => `${normalizarUsuario(usuario)}@${DOMINIO}`;

// Supabase responde en ingles; esto lo pasa a algo que el alumno entienda.
function traducirError(msg = "") {
  const m = (msg || "").toLowerCase();
  if (m.includes("already")) return "Ese usuario ya existe. Proba con otro.";
  if (m.includes("password")) return "La contrasena debe tener al menos 6 caracteres.";
  if (m.includes("email")) return "El usuario solo puede tener letras y numeros, sin espacios.";
  if (m.includes("rate") || m.includes("many")) return "Demasiados intentos. Espera un minuto y proba de nuevo.";
  return "No se pudo completar. Revisa los datos e intenta otra vez.";
}

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

function filaAAlumno(p, fila, filaCiclo) {
  const d = (fila && fila.data) || {};
  return {
    id: p.id,
    ciclo: (filaCiclo && filaCiclo.data) || null,
    name: d.name || p.nombre,
    since: d.since || new Date().toLocaleDateString("es-AR", { month: "short", year: "numeric" }),
    inactive: d.inactive ?? 0,
    lastDay: d.lastDay || "Aún no registra",
    exercises: d.exercises || [],
    blocks: d.blocks || [],
    perfil: d.perfil || {},
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

  // Si lo dieron de baja mientras tenía la sesión abierta, se cierra acá.
  if (yo.estado !== "activo") {
    await supabase.auth.signOut();
    return null;
  }

  const { data: filas } = await supabase.from("alumnos").select("*");
  const porId = Object.fromEntries((filas || []).map((f) => [f.id, f]));

  // Solo devuelve filas si RLS lo permite (coach, o la propia alumna)
  const { data: ciclos } = await supabase.from("ciclo").select("*");
  const porCiclo = Object.fromEntries((ciclos || []).map((f) => [f.id, f]));

  return {
    me: perfilAUsuario(yo),
    users: perfiles.map(perfilAUsuario),
    students: perfiles.filter((p) => p.rol === "alumno").map((p) => {
      const base = filaAAlumno(p, porId[p.id], porCiclo[p.id]);
      // lo que quedó sin subir en este dispositivo pisa a lo del servidor
      const local = aplicarCola("alumnos", p.id, null);
      return local ? { ...base, ...local } : base;
    }),
  };
}

/* ─── GUARDADO CON RESPALDO LOCAL ────────────────────────────
   Si no hay internet o el guardado falla, los datos quedan en el
   teléfono y se suben solos cuando vuelve la conexión. Nada se
   pierde aunque la alumna cierre la app.                        */

const COLA = "proclub_pendientes";

function leerCola() {
  try { return JSON.parse(localStorage.getItem(COLA) || "{}"); }
  catch (_) { return {}; }
}

function escribirCola(c) {
  try { localStorage.setItem(COLA, JSON.stringify(c)); } catch (_) {}
}

export function hayPendientes() {
  return Object.keys(leerCola()).length;
}

/* Estado visible: "ok" | "guardando" | "pendiente" */
let estado = "ok";
const oyentes = new Set();

export function onEstadoGuardado(fn) {
  oyentes.add(fn);
  fn(estado, hayPendientes());
  return () => oyentes.delete(fn);
}

function avisar(nuevo) {
  estado = nuevo;
  oyentes.forEach((f) => f(estado, hayPendientes()));
}

async function subir(tabla, id, data) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  const { error } = await supabase
    .from(tabla)
    .upsert({ id, data, updated_at: new Date().toISOString() });
  if (error) console.warn(`Guardado diferido (${tabla}):`, error.message);
  return !error;
}

async function guardar(tabla, id, data) {
  avisar("guardando");
  const cola = leerCola();
  const clave = `${tabla}|${id}`;
  const ok = await subir(tabla, id, data);
  if (ok) delete cola[clave];
  else cola[clave] = { tabla, id, data, ts: Date.now() };
  escribirCola(cola);
  avisar(hayPendientes() ? "pendiente" : "ok");
  return ok;
}

// Reintenta todo lo que quedó en cola. Se llama al volver la conexión.
export async function reintentarPendientes() {
  const cola = leerCola();
  const claves = Object.keys(cola);
  if (!claves.length) { avisar("ok"); return; }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    avisar("pendiente"); return;
  }
  avisar("guardando");
  for (const k of claves) {
    const { tabla, id, data } = cola[k];
    if (await subir(tabla, id, data)) {
      const actual = leerCola();
      delete actual[k];
      escribirCola(actual);
    }
  }
  avisar(hayPendientes() ? "pendiente" : "ok");
}

// Lo que todavía no subió pisa a lo que vino del servidor.
function aplicarCola(tabla, id, data) {
  const e = leerCola()[`${tabla}|${id}`];
  return e ? e.data : data;
}

export async function saveStudent(alumno) {
  // `ciclo` se excluye a propósito: tiene su propia tabla y su propia RLS
  const { id, ciclo, ...data } = alumno;
  return guardar("alumnos", id, data);
}

/* ─── ALTAS Y ESTADOS ────────────────────────────────────── */

// El coach da de alta a un alumno: queda activo de entrada.
export async function createStudent({ name, username, password }) {
  const u = normalizarUsuario(username);
  if (u.length < 3) return { error: "El usuario necesita al menos 3 letras o numeros" };

  const { data: existe } = await supabase
    .from("profiles").select("id").eq("username", u).maybeSingle();
  if (existe) return { error: "Ese usuario ya existe" };

  const { data, error } = await silencioso.auth.signUp({
    email: aEmail(u),
    password,
    options: { data: { nombre: name.trim(), username: u } },
  });
  if (error) return { error: traducirError(error.message) };

  const id = data.user?.id;
  if (!id) return { error: "No se pudo crear la cuenta" };

  await supabase.from("profiles").update({ estado: "activo" }).eq("id", id);
  return { id };
}

// El alumno se registra solo: queda pendiente hasta que el coach lo apruebe.
export async function requestMembership({ name, username, password }) {
  const u = normalizarUsuario(username);
  if (u.length < 3) return { error: "El usuario necesita al menos 3 letras o números" };
  const { error } = await silencioso.auth.signUp({
    email: aEmail(u),
    password,
    options: { data: { nombre: name.trim(), username: u } },
  });
  if (error) return { error: traducirError(error.message) };
  return { ok: true };
}

/* ─── FRASE DEL PANEL DEL ALUMNO ─────────────────────────── */
// La escribe el coach, la ven todos los alumnos.

export async function loadFrase() {
  const { data } = await supabase
    .from("ajustes").select("valor").eq("clave", "frase").maybeSingle();
  return data?.valor || "";
}

export async function saveFrase(texto) {
  const { error } = await supabase.from("ajustes")
    .upsert({ clave: "frase", valor: texto, updated_at: new Date().toISOString() });
  if (error) console.error("No se pudo guardar la frase:", error.message);
  return !error;
}

/* ─── CICLO MENSTRUAL ────────────────────────────────────── */
// Tabla aparte y privada: por RLS, solo la propia alumna lee y
// escribe su ciclo. El coach NO tiene acceso a estos datos.

export async function loadCiclo() {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion?.user) return null;
  const { data } = await supabase
    .from("ciclo").select("data").eq("id", sesion.user.id).maybeSingle();
  return aplicarCola("ciclo", sesion.user.id, data?.data || null);
}

export async function saveCiclo(datos) {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion?.user) return false;
  return guardar("ciclo", sesion.user.id, datos);
}

/* ─── RESTABLECER CONTRASEÑA ─────────────────────────────── */
// Llama a la función que vive en Supabase. La verificación de que
// sos el coach se hace allá, no acá: en el navegador no se puede
// confiar en nada.

export async function resetPassword(alumnoId, password) {
  const { data, error } = await supabase.functions.invoke("reset-password", {
    body: { alumnoId, password },
  });
  if (error) {
    const detalle = await error.context?.json?.().catch(() => null);
    return { error: detalle?.error || "No se pudo cambiar la contraseña" };
  }
  if (data?.error) return { error: data.error };
  return { ok: true };
}

export async function setEstado(id, estado) {
  const { error } = await supabase.from("profiles").update({ estado }).eq("id", id);
  if (error) console.error("No se pudo cambiar el estado:", error.message);
  return !error;
}
