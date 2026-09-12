import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Crown, Search, Dumbbell, TrendingUp, LogOut, Plus, Trash2,
  LogIn, Lock, User, ChevronDown, Check, X, UserX, UserCheck,
  UserPlus, ShieldCheck, BarChart3, Clock, Calendar, FileText,
} from "lucide-react";

/* ─── TOKENS ─────────────────────────────────────────────── */
// ─── Paleta ProClub OS ────────────────────────────────────────────────────
// Negro mate cálido → sin el shock visual del negro puro
// Dorado más suave → acento, no protagonista
// Lima más suave → éxito y acción positiva
const GOLD   = "#C8A84B";                  // dorado cálido, menos harsh
const GOLD_S = "rgba(200,168,75,0.12)";    // dorado suave para fondos
const LIME   = "#4ade80";                  // lima más suave, igual de legible
const LIME_S = "rgba(74,222,128,0.12)";    // lima suave para fondos
const RED    = "#f87171";
const RED_S  = "rgba(248,113,113,0.12)";
const CARD   = "#1e1c24";                  // charcoal cálido, no negro puro
const CARD2  = "#252330";                  // superficie secundaria
const BORDER = "#2e2b3a";                  // borde con tono cálido
const TEXT   = "#edeaf2";                  // blanco cálido, no #fff puro
const MUTED  = "#7a7585";                  // gris con tono cálido
const BG     = "linear-gradient(160deg, #1a1825 0%, #141218 40%, #0f0e14 100%)";
const MAX_EX = 10;

// Helper global: reemplaza el inline style de inputs
const inputBg = "#17151e";

const INPUT = "rounded-xl outline-none border border-[#2e2b3a] focus:border-[#C8A84B] text-[#edeaf2] font-semibold placeholder-[#4a4558] transition";
const iStyle = { colorScheme: "dark", color: "#edeaf2", background: "#17151e" };

/* ─── DATA HELPERS ───────────────────────────────────────── */
const emptySet  = () => ({ reps: null, weight: null, seconds: null });
const emptyWeek = () => ({ sets: [emptySet(), emptySet(), emptySet()], date: "", time: null, seconds: null, status: "draft", finished: false, hard: false, notes: "" });
// status: "draft" = trabajando | "submitted" = enviado al coach | "approved" = aprobado por coach
const done = w => w.status === "approved";
const submitted = w => w.status === "submitted";
const emptyWeeks = () => Array(5).fill(null).map(emptyWeek);
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
};
const emptyExercise = (name = "", blockTitle = "") => ({ name, weeks: emptyWeeks(), starred: false, blockTitle, routineMonth: currentMonth() });

function topWeight(week) {
  const w = (week.sets || []).map(s => s.weight).filter(v => v != null && v > 0);
  return w.length ? Math.max(...w) : null;
}
function volume(week) {
  return (week.sets || []).reduce((s, r) => s + (r.reps > 0 && r.weight > 0 ? r.reps * r.weight : 0), 0);
}
function pctGain(weeks) {
  const vals = weeks.map(topWeight).filter(v => v != null);
  if (vals.length < 2) return null;
  return ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100;
}
function efficiency(week) {
  const t = topWeight(week);
  return (t != null && week.time > 0) ? t / week.time : null;
}
function effDelta(weeks, idx) {
  const curr = efficiency(weeks[idx]);
  if (!curr) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const prev = efficiency(weeks[i]);
    if (prev) return { pct: ((curr - prev) / prev) * 100, from: i + 1 };
  }
  return null;
}
function weekProgress(exercises) {
  if (!exercises.length) return { week: 1, pct: 0 };
  for (let w = 0; w < 5; w++) {
    const approvedCount = exercises.filter(e => done(e.weeks[w])).length;
    if (approvedCount < exercises.length) return { week: w + 1, pct: Math.round((approvedCount / exercises.length) * 100) };
  }
  return { week: 5, pct: 100 };
}

/* ─── SEED DATA ──────────────────────────────────────────── */
function buildEx(names, bases, growth, times) {
  return names.map((name, i) => {
    const weeks = emptyWeeks();
    let pw = bases[i], pt = times[i];
    for (let w = 0; w < 5; w++) {
      if (w < 3) {
        const nw = w === 0 ? pw : Math.round(pw * (1 + growth[i] / 4 / 100));
        const nt = Math.max(1, +(pt * (1 - growth[i] / 4 / 220)).toFixed(1));
        weeks[w] = {
          sets: [
            { reps: 10, weight: Math.round(nw * 0.82) },
            { reps: 8,  weight: Math.round(nw * 0.91) },
            { reps: 6,  weight: nw },
          ],
          date: `2026-05-${String(4 + w * 7).padStart(2, "0")}`,
          time: nt, status: "approved", finished: true, hard: w % 2 === 0, notes: "",
        };
        pw = nw; pt = nt;
      }
    }
    return { name, weeks, starred: false, blockTitle: "", routineMonth: "2026-05" };
  });
}


// Sin datos demo — los alumnos se crean desde el panel del coach
const STUDENTS = [];
// Credenciales del coach — CAMBIÁ la contraseña antes de lanzar
const USERS = [
  { id: "u0-coach", username: "coach", password: "proclub2026", role: "admin", name: "Coach ProClub", status: "active" },
];
const LINE_COLORS = [LIME, GOLD, "#7DA0FA", "#E07B7B", "#C77DFF", "#FF9F5A", "#5AD1C7", "#FFD166", "#A0E7E5", "#F7A1C4"];

/* ─── BASE64 LOGOS (mismas del prototipo anterior) ─────── */
const LOGO_SQ = "data:image/jpeg;base64,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";


/* ─── UUID ───────────────────────────────────────────────────
   crypto.randomUUID() disponible en Chrome 92+, Firefox 95+,
   Safari 15.4+. Fallback manual para browsers más viejos.     */
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback RFC 4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}


/* ─── SESSION STORAGE ───────────────────────────────────────
   Persiste la sesión del usuario en localStorage.
   En el artifact (iframe sandbox) falla silenciosamente.
   En producción funciona correctamente.                        */
const SESSION_KEY = "proclub_os_session";

function saveSession(user) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      id: user.id, username: user.username, role: user.role,
      studentId: user.studentId || null, name: user.name || null,
    }));
  } catch (_) { /* sandbox: ignorar */ }
}

function loadSession(users) {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Revalidar contra la lista de usuarios actual (si fue dado de baja, no restaurar)
    const match = users.find(u =>
      u.id === saved.id &&
      u.username === saved.username &&
      u.status === "active"
    );
    return match || null;
  } catch (_) { return null; }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
}


/* ─── MONTH HELPERS ─────────────────────────────────────────── */
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function deriveMonths(exercises) {
  const set = new Set();
  exercises.forEach(ex => {
    if (ex.routineMonth) set.add(ex.routineMonth);
    ex.weeks.forEach(w => {
      if (w.date) {
        const d = new Date(w.date);
        if (!isNaN(d)) set.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
      }
    });
  });
  return Array.from(set).sort().reverse(); // más reciente primero
}

function exerciseMatchesMonth(ex, month) {
  if (!month) return true;
  if (ex.routineMonth === month) return true;
  return ex.weeks.some(w => {
    if (!w.date) return false;
    const d = new Date(w.date);
    if (isNaN(d)) return false;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === month;
  });
}

/* ─── MICRO UI ───────────────────────────────────────────── */
function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl animate-[fadeIn_.2s_ease-out]"
      style={{ background: CARD2, border: `1px solid ${GOLD}44` }}>
      <Check size={14} style={{ color: LIME }} />
      <span className="text-sm text-white">{msg}</span>
      <button onClick={onClose} className="ml-1 text-gray-500"><X size={13} /></button>
    </div>
  );
}

function ProgressRing({ pct, size = 56, stroke = 4, color = LIME }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2e2b3a" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray .5s ease" }} />
    </svg>
  );
}

function Bar({ pct, color = LIME }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#272530" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function Avatar({ name, size = 8, gold = false }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("");
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center font-bold text-black shrink-0`}
      style={{ background: gold ? GOLD : "#333", color: gold ? "#1a1300" : MUTED, fontSize: size * 1.6 }}>
      {initials}
    </div>
  );
}

/* ─── LOGIN ─────────────────────────────────────────────── */
function Login({ users, setUsers, students, setStudents, onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "request" | "forgot"
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [req, setReq] = useState({ name: "", username: "", password: "" });
  const [sent, setSent] = useState(false);

  const go = () => {
    const user = users.find(x =>
      x.username.toLowerCase() === u.trim().toLowerCase() &&
      x.password === p &&
      x.status === "active"
    );
    if (!user) {
      const pending = users.find(x => x.username.toLowerCase() === u.trim().toLowerCase() && x.status === "pending");
      if (pending) { setErr("Tu solicitud está pendiente de aprobación. El coach te avisará."); return; }
      setErr("Usuario o contraseña incorrectos");
      return;
    }
    onLogin(user);
  };

  const sendRequest = () => {
    if (!req.name.trim() || !req.username.trim() || !req.password.trim()) { setErr("Completá todos los campos"); return; }
    if (users.some(x => x.username.toLowerCase() === req.username.trim().toLowerCase())) { setErr("Ese usuario ya existe"); return; }
    const newId = uuid();
    const newStudent = {
      id: newId, name: req.name.trim(),
      since: new Date().toLocaleDateString("es-AR", { month: "short", year: "numeric" }),
      inactive: 0, lastDay: "Aún no registra",
      exercises: [emptyExercise("Sentadilla")],
    };
    setStudents(p => [...p, newStudent]);
    setUsers(p => [...p, { id: uuid(), username: req.username.trim(), password: req.password, role: "alumno", studentId: newId, status: "pending", requestedName: req.name.trim() }]);
    setSent(true);
    setErr("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: BG }}>
      <div className="absolute top-0 left-0 w-80 h-80 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ background: "#C8A84B", transform: "translate(-30%, -30%)" }} />

      <div className="w-full max-w-xs relative">
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border mb-5"
            style={{ borderColor: "rgba(212,175,55,0.5)", boxShadow: "0 0 40px rgba(212,175,55,0.25)" }}>
            <img src={LOGO_SQ} alt="Pro Club" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black tracking-[0.2em] text-white">ProClub OS</h1>
          <p className="text-[11px] mt-1" style={{ color: GOLD }}>Tu sistema 100% personalizado</p>
          <div className="h-px w-14 my-3" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)" }} />
          <p className="text-[11px] text-gray-600">Acceso exclusivo · solo miembros activos</p>
        </div>

        {mode === "login" ? (
          <div className="space-y-3">
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={u} onChange={e => setU(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
                placeholder="Usuario" className={`w-full pl-10 pr-4 py-3 text-sm ${INPUT}`} style={iStyle} />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
                placeholder="Contraseña" className={`w-full pl-10 pr-4 py-3 text-sm ${INPUT}`} style={iStyle} />
            </div>
            {err && <p className="text-xs text-center" style={{ color: RED }}>{err}</p>}
            <button onClick={go}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[.97] hover:brightness-110"
              style={{ background: GOLD, color: "#1a1300" }}>
              <LogIn size={16} /> Ingresar
            </button>
            <button onClick={() => { setMode("request"); setErr(""); }}
              className="w-full py-2 text-xs transition" style={{ color: MUTED }}>
              ¿No tenés acceso? Solicitá membresía →
            </button>
            <button onClick={() => { setMode("forgot"); setErr(""); }}
              className="w-full py-1 text-xs transition" style={{ color: MUTED }}>
              ¿Olvidaste tu usuario o contraseña?
            </button>
          </div>
        ) : mode === "forgot" ? (
          <div className="space-y-4">
            <div className="rounded-xl p-4 space-y-3" style={{ background: CARD2, border: `1px solid ${BORDER}` }}>
              <p className="text-sm font-semibold" style={{ color: GOLD }}>¿Olvidaste tu acceso?</p>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                Tu usuario y contraseña los creó el coach cuando te dio de alta en ProClub OS. Contactalo para que los recupere por vos:
              </p>
              <div className="space-y-2">
                <a href="https://instagram.com/proclub.sl" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: GOLD_S, color: GOLD }}>
                  📸 @proclub.sl en Instagram
                </a>
                <a href="https://wa.me/5492664000000" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: LIME_S, color: LIME }}>
                  💬 Escribile por WhatsApp
                </a>
              </div>
              <p className="text-[10px]" style={{ color: MUTED }}>El coach puede ver tu usuario y resetear tu contraseña desde su panel.</p>
            </div>
            <button onClick={() => { setMode("login"); setErr(""); }}
              className="w-full py-2 text-xs transition" style={{ color: MUTED }}>
              ← Volver al login
            </button>
          </div>
        ) : sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(50,205,50,0.1)" }}>
              <Check size={28} style={{ color: LIME }} />
            </div>
            <p className="text-white font-semibold">¡Solicitud enviada!</p>
            <p className="text-xs text-gray-500 leading-relaxed">El coach revisará tu solicitud y te habilitará el acceso. Volvé en unos días.</p>
            <button onClick={() => { setMode("login"); setSent(false); setReq({ name: "", username: "", password: "" }); }}
              className="text-xs underline" style={{ color: GOLD }}>
              Volver al login
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 text-center pb-1">Completá tus datos · el coach aprobará tu acceso</p>
            {[["name","Nombre completo", User], ["username","Usuario que querés", User], ["password","Contraseña", Lock]].map(([f, ph, Icon]) => (
              <div key={f} className="relative">
                <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={req[f]} onChange={e => setReq(p => ({ ...p, [f]: e.target.value }))}
                  placeholder={ph} className={`w-full pl-10 pr-4 py-3 text-sm ${INPUT}`} style={iStyle} />
              </div>
            ))}
            {err && <p className="text-xs text-center" style={{ color: RED }}>{err}</p>}
            <button onClick={sendRequest}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[.97] hover:brightness-110"
              style={{ background: LIME, color: "#0a1a00" }}>
              <UserPlus size={16} /> Solicitar acceso
            </button>
            <button onClick={() => { setMode("login"); setErr(""); }}
              className="w-full py-2 text-xs text-gray-600 hover:text-gray-400 transition">
              ← Volver
            </button>
          </div>
        )}

        {mode === "login" && !sent && (
          <div className="mt-6 space-y-2">
            <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest">Acceso demo</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setU("coach"); setP("1234"); setErr(""); }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 active:scale-95"
                style={{ borderColor: "rgba(212,175,55,0.4)", color: GOLD, background: "rgba(212,175,55,0.06)" }}
              >
                🛡 Soy Coach
              </button>
              <button
                onClick={() => { setU("martina"); setP("1234"); setErr(""); }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 active:scale-95"
                style={{ borderColor: "rgba(50,205,50,0.4)", color: LIME, background: "rgba(50,205,50,0.06)" }}
              >
                🏋 Soy Alumno
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-700">Tocá uno y luego "Ingresar"</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PDF EXPORT ─────────────────────────────────────────── */
/* ─── AI SUMMARY ─────────────────────────────────────────────
   Genera un mini informe personalizado llamando a Claude API.
   Analiza mejoras, dificultades y recomienda contactar al coach. */
async function generateSummary(student) {
  try {
    // Preparar contexto de datos del alumno
    const exData = student.exercises.map(ex => {
      const gain = pctGain(ex.weeks);
      const approvedWeeks = ex.weeks.filter(w => w.status === "approved" || w.status === "submitted");
      const hardWeeks = approvedWeeks.filter(w => !w.finished || w.hard);
      const notes = approvedWeeks.filter(w => w.notes).map(w => w.notes).join(", ");
      return [
        `${ex.name}${ex.blockTitle ? ` [${ex.blockTitle}]` : ""}`,
        gain != null ? `mejora ${gain >= 0 ? "+" : ""}${gain.toFixed(1)}%` : "sin datos suficientes",
        hardWeeks.length > 0 ? `${hardWeeks.length} semana(s) difícil(es)` : null,
        notes ? `notas: "${notes}"` : null,
      ].filter(Boolean).join(", ");
    }).join("\n");

    const blocksData = (student.blocks || []).length > 0
      ? `Categorías: ${student.blocks.join(", ")}.`
      : "";

    const prompt = `Sos el sistema inteligente de ProClub OS, un gimnasio boutique premium en San Luis, Argentina. Analizá los siguientes datos de entrenamiento del alumno ${student.name.split(" ")[0]} y escribí un mini informe de exactamente 3 oraciones en español informal (tuteo argentino). 

Estructura OBLIGATORIA:
1. Destacá dónde mejoró más (mencioná el bloque o ejercicio específico con el porcentaje).
2. Identificá dónde tuvo más dificultad o qué faltó mejorar (ejercicio o bloque específico).  
3. Animalo a contactar al coach para planificar las próximas semanas.

Sé directo, cálido y específico. Máximo 40 palabras en total. Sin saludos, sin títulos, solo las 3 oraciones.

Datos del alumno:
${blocksData}
${exData}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch (err) {
    // Fallback con análisis rule-based si la API falla
    return generateSummaryFallback(student);
  }
}

// Fallback rule-based (sin API, siempre funciona)
function generateSummaryFallback(student) {
  const gains = student.exercises
    .map(ex => ({ name: ex.name, block: ex.blockTitle || "", pct: pctGain(ex.weeks) }))
    .filter(e => e.pct != null)
    .sort((a, b) => b.pct - a.pct);

  const struggled = student.exercises.filter(ex =>
    ex.weeks.some(w => (w.status === "approved" || w.status === "submitted") && (!w.finished || w.hard))
  );

  const lines = [];

  if (gains.length >= 2) {
    const best = gains[0];
    const worst = gains[gains.length - 1];
    const bestLabel = best.block ? `en ${best.block}` : `en ${best.name}`;
    const worstLabel = worst.block ? `en ${worst.block}` : `en ${worst.name}`;
    lines.push(`Progresaste notablemente ${bestLabel} (+${best.pct.toFixed(0)}%), mientras que ${worstLabel} todavía tiene margen para seguir mejorando.`);
  } else if (gains.length === 1) {
    lines.push(`Mostrás una mejora de ${gains[0].pct >= 0 ? "+" : ""}${gains[0].pct.toFixed(0)}% en ${gains[0].name} — seguí en esa dirección.`);
  }

  if (struggled.length > 0) {
    const ex = struggled[0];
    const hasNote = ex.weeks.find(w => w.notes)?.notes;
    lines.push(
      hasNote
        ? `Detecté que te costó más en ${ex.name}${hasNote ? `: "${hasNote}"` : ""}.`
        : `Algunas semanas de ${ex.name} te resultaron más desafiantes — es importante mencionárselo al coach.`
    );
  }

  lines.push("Compartí este reporte con tu entrenador para planificar las próximas semanas y ajustar tu rutina.");

  return lines.join(" ");
}


function exportPDF(student, summary = "") {
  const date  = new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"long", year:"numeric" });
  const weeksCompleted = Array(5).fill(null).map((_,wi) =>
    student.exercises.every(ex => done(ex.weeks[wi]))
  );
  const totalApproved  = student.exercises.reduce((sum, ex) => sum + ex.weeks.filter(w => done(w)).length, 0);
  const totalSessions  = student.exercises.length * 5;

  const statusIcon = w => done(w) ? "✓" : w.status === "submitted" ? "⏳" : "○";
  const statusColor = w => done(w) ? "#16a34a" : w.status === "submitted" ? "#b45309" : "#999";

  const exerciseRows = student.exercises.map((ex, ei) => {
    const gain = pctGain(ex.weeks);
    const weekCols = ex.weeks.map((w, wi) => {
      const top    = topWeight(w);
      const vol    = volume(w);
      const topSet = (w.sets||[]).find(s => s.weight === top);
      const eff    = wi > 0 ? effDelta(ex.weeks, wi) : null;
      return `
        <td style="border:1px solid #e5e7eb;padding:8px 6px;text-align:center;
                   background:${done(w) ? "#f0fdf4" : w.status==="submitted" ? "#fffbeb" : "#fff"}">
          <div style="font-size:10px;color:${statusColor(w)};font-weight:700;margin-bottom:2px">${statusIcon(w)}</div>
          ${top ? `<div style="font-size:13px;font-weight:800;color:#111">${top} kg</div>` : `<div style="font-size:12px;color:#ccc">—</div>`}
          ${topSet?.reps ? `<div style="font-size:10px;color:#666">× ${topSet.reps} reps</div>` : ""}
          ${vol ? `<div style="font-size:9px;color:#999">Vol: ${vol} kg</div>` : ""}
          ${eff ? `<div style="font-size:9px;color:${eff.pct>=0?"#16a34a":"#b45309"};margin-top:2px">${eff.pct>=0?"▲":"▼"} ${Math.abs(eff.pct).toFixed(0)}%</div>` : ""}
          ${w.date ? `<div style="font-size:8px;color:#ccc;margin-top:2px">${w.date}</div>` : ""}
          ${w.time ? `<div style="font-size:8px;color:#ccc">${w.time} min</div>` : ""}
        </td>`;
    }).join("");

    const setsDetail = ex.weeks.map((w, wi) => {
      if (!done(w) && w.status !== "submitted") return "";
      const setRows = (w.sets||[]).filter(s => s.weight > 0).map((s,si) =>
        `<span style="font-size:10px;background:#f3f4f6;border-radius:4px;padding:2px 6px;margin:1px">${si+1}. ${s.reps}×${s.weight}kg</span>`
      ).join(" ");
      const feedback = [
        w.finished === false ? "no terminó" : "",
        w.hard ? "desafiante" : "",
        w.notes ? `"${w.notes}"` : ""
      ].filter(Boolean).join(" · ");
      return setRows || feedback ? `
        <tr>
          <td style="padding:4px 8px;font-size:10px;color:#888;border-bottom:1px solid #f3f4f6">S${wi+1}</td>
          <td colspan="5" style="padding:4px 8px;border-bottom:1px solid #f3f4f6">
            <div>${setRows}</div>
            ${feedback ? `<div style="font-size:10px;color:#b45309;margin-top:2px">${feedback}</div>` : ""}
          </td>
        </tr>` : "";
    }).join("");

    return `
      <tr style="background:${ei%2===0?"#fff":"#fafafa"}">
        <td style="border:1px solid #e5e7eb;padding:10px 8px;font-weight:700;font-size:12px;white-space:nowrap">
          ${ex.name}
          ${gain != null ? `<div style="font-size:10px;font-weight:600;color:${gain>=0?"#16a34a":"#b45309"};margin-top:2px">${gain>=0?"+":""}${gain.toFixed(1)}%</div>` : ""}
        </td>
        ${weekCols}
      </tr>
      ${setsDetail ? `<tr><td colspan="6" style="padding:0"><table style="width:100%;border-collapse:collapse">${setsDetail}</table></td></tr>` : ""}`;
  }).join("");

  const gains = student.exercises.map(ex => ({ name: ex.name, pct: pctGain(ex.weeks) })).filter(x => x.pct != null).sort((a,b)=>b.pct-a.pct);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>ProClub OS — ${student.name}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,Helvetica Neue,sans-serif; background:#fff; color:#111; padding:36px; font-size:13px; }
    .header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #D4AF37; }
    .brand { font-size:20px; font-weight:900; letter-spacing:0.2em; }
    .sub { font-size:10px; color:#999; letter-spacing:0.12em; text-transform:uppercase; margin-top:2px; }
    .name { font-size:26px; font-weight:800; margin-bottom:4px; }
    .meta { font-size:12px; color:#666; margin-bottom:20px; }
    .stats { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
    .stat { background:#f9f9f9; border:1px solid #e5e7eb; border-radius:8px; padding:10px 16px; text-align:center; flex:1; min-width:100px; }
    .stat-val { font-size:20px; font-weight:800; }
    .stat-label { font-size:10px; color:#888; margin-top:2px; text-transform:uppercase; letter-spacing:0.08em; }
    .week-summary { display:flex; gap:8px; margin-bottom:20px; }
    .week-chip { flex:1; text-align:center; border-radius:8px; padding:8px 4px; border:1px solid #e5e7eb; }
    .week-label { font-size:10px; font-weight:700; margin-bottom:2px; }
    .section-title { font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#888; margin:20px 0 8px; }
    .gains { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
    .gain-chip { padding:5px 12px; border-radius:20px; font-size:11px; font-weight:700; }
    table.main { width:100%; border-collapse:collapse; font-size:12px; }
    table.main th { background:#111; color:#D4AF37; padding:10px 8px; text-align:center; font-size:10px; letter-spacing:0.05em; }
    table.main th:first-child { text-align:left; }
    .footer { margin-top:32px; padding-top:12px; border-top:1px solid #f3f4f6; font-size:10px; color:#bbb; text-align:center; }
    @media print { body{padding:20px} button{display:none!important} }
  </style>
</head>
<body>
  <div class="header">
    <div><div class="brand">ProClub OS</div><div class="sub">Tu sistema 100% personalizado</div></div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#888">Reporte de progreso</div>
      <div style="font-size:13px;font-weight:700">${date}</div>
    </div>
  </div>

  <div class="name">${student.name}</div>
  <div class="meta">Socio desde ${student.since} · Último registro: ${student.lastDay}</div>

  <div class="stats">
    <div class="stat"><div class="stat-val" style="color:#D4AF37">${totalApproved}</div><div class="stat-label">Semanas aprobadas</div></div>
    <div class="stat"><div class="stat-val">${student.exercises.length}</div><div class="stat-label">Ejercicios</div></div>
    <div class="stat"><div class="stat-val" style="color:${gains.length > 0 && gains[0].pct >= 0 ? "#16a34a" : "#b45309"}">${gains.length > 0 ? (gains[0].pct >= 0 ? "+" : "") + gains[0].pct.toFixed(1) + "%" : "—"}</div><div class="stat-label">Mejor mejora</div></div>
    <div class="stat"><div class="stat-val">${totalSessions > 0 ? Math.round((totalApproved/totalSessions)*100) : 0}%</div><div class="stat-label">Completado</div></div>
  </div>

  <div class="section-title">Estado por semana</div>
  <div class="week-summary">
    ${[0,1,2,3,4].map(wi => {
      const allApproved = student.exercises.length > 0 && student.exercises.every(ex => done(ex.weeks[wi]));
      const anySubmitted = student.exercises.some(ex => ex.weeks[wi].status === "submitted");
      const bg = allApproved ? "#f0fdf4" : anySubmitted ? "#fffbeb" : "#f9f9f9";
      const color = allApproved ? "#16a34a" : anySubmitted ? "#b45309" : "#999";
      const icon = allApproved ? "✓" : anySubmitted ? "⏳" : "○";
      return `<div class="week-chip" style="background:${bg};border-color:${color}20">
        <div class="week-label" style="color:${color}">S${wi+1} ${icon}</div>
        <div style="font-size:9px;color:#999">${allApproved?"Aprobada":anySubmitted?"Enviada":"En curso"}</div>
      </div>`;
    }).join("")}
  </div>

  ${gains.length ? `
  <div class="section-title">Progreso por ejercicio</div>
  <div class="gains">
    ${gains.map((g,i) => `
      <div class="gain-chip" style="background:${i===0?"#f0fdf4":i===gains.length-1?"#fffbeb":"#f5f5f5"};color:${i===0?"#16a34a":i===gains.length-1?"#b45309":"#333"}">
        ${g.name}: ${g.pct>=0?"+":""}${g.pct.toFixed(1)}%
      </div>`).join("")}
  </div>` : ""}

  <div class="section-title">Detalle de carga semanal</div>
  <table class="main">
    <thead><tr>
      <th style="width:130px">Ejercicio / Progreso</th>
      ${[1,2,3,4,5].map(w => `<th>Semana ${w}</th>`).join("")}
    </tr></thead>
    <tbody>${exerciseRows}</tbody>
  </table>

  ${summary ? `
  <div style="margin-top:24px;padding:16px 20px;border-radius:10px;background:linear-gradient(135deg,#1a1825,#1e1c14);border:1px solid #C8A84B33;color:#edeaf2;font-family:-apple-system,Helvetica Neue,sans-serif;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C8A84B;margin-bottom:8px;">📊 Análisis ProClub OS</div>
    <p style="font-size:12px;line-height:1.7;margin:0;color:#edeaf2">${summary}</p>
  </div>` : ""}

  <div class="footer">
    ProClub OS · ${student.name} · ${date}<br/>
    <em>Leyenda: ✓ Aprobada por el coach · ⏳ Enviada, pendiente · ○ En curso</em>
  </div>

  <br/>
  <div style="text-align:center">
    <button onclick="window.print()" style="padding:12px 32px;background:#D4AF37;color:#1a1300;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:0.05em">
      🖨️  Guardar como PDF
    </button>
    <p style="font-size:10px;color:#bbb;margin-top:8px">Archivo → Imprimir → "Guardar como PDF" en el selector de impresoras</p>
  </div>
</body>
</html>`;

  return html;
}


/* ─── REPORT OVERLAY ─────────────────────────────────────── */
// Muestra el reporte HTML dentro de la app y llama window.print()
// Solución al bloqueo de window.open() en iframes sandboxeados
function ReportOverlay({ html, onClose }) {
  const ref = React.useRef(null);

  const handlePrint = () => {
    const iframe = ref.current;
    if (!iframe || !iframe.contentWindow) return;
    // Usar contentWindow.print() imprime SOLO el iframe, sin hacks de CSS
    // Más confiable que window.print() + inyección de estilos
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0a0a" }}>
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ background: "#111", borderColor: "#222" }}>
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: GOLD }} />
          <span className="text-sm font-bold text-white">Reporte ProClub OS</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 hover:brightness-110"
            style={{ background: GOLD, color: "#1a1300" }}
          >
            🖨️ Imprimir / Guardar PDF
          </button>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:text-white transition" style={{ background: CARD2 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-gray-600 py-1.5 shrink-0">
        Tocá "Imprimir / Guardar PDF" → en el diálogo elegí "Guardar como PDF" como impresora
      </p>

      {/* iframe con el HTML del reporte */}
      <iframe
        ref={ref}
        srcDoc={html}
        title="Reporte ProClub OS"
        className="flex-1 w-full border-0"
        style={{ background: "#fff" }}
      />
    </div>
  );
}




/* ─── BLOCK PICKER ──────────────────────────────────────────────
   Menú rápido para asignar un ejercicio a un bloque.
   Aparece como overlay pequeño al tocar la etiqueta del bloque.  */
function BlockPicker({ blocks, current, onSelect, onClose }) {
  return (
    <>
      {/* Backdrop invisible — cierra el picker al tocar afuera */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute top-full left-0 z-50 mt-1 rounded-xl shadow-2xl overflow-hidden"
        style={{ background: CARD2, border: `1px solid ${BORDER}`, minWidth: 180, backdropFilter: "blur(8px)" }}
      >
      {[{ label: "Sin categoría", value: "" }, ...blocks.map(b => ({ label: b, value: b }))].map(({ label, value }) => (
        <button
          key={value}
          onClick={() => { onSelect(value); onClose(); }}
          className="w-full text-left px-3 py-2.5 text-xs font-medium transition-colors duration-150 hover:bg-white/5"
          style={{ color: value === current ? LIME : TEXT, background: value === current ? LIME_S : "transparent" }}
        >
          {value === current ? "✓ " : "  "}{label}
        </button>
      ))}
    </div>
    </>
  );
}

/* ─── DRAG & DROP HOOK ───────────────────────────────────────
   Implementado con Pointer Events — funciona en mouse y touch  */
function useDragSort(list, onReorder) {
  const [dragIdx, setDragIdx]   = React.useState(null);
  const [overIdx, setOverIdx]   = React.useState(null);

  const handleDragStart = (i) => setDragIdx(i);

  const handleDragEnter = (i) => {
    if (dragIdx == null || i === dragIdx) return;
    setOverIdx(i);
  };

  const handleDrop = () => {
    if (dragIdx != null && overIdx != null && dragIdx !== overIdx) {
      const next = [...list];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(overIdx, 0, moved);
      onReorder(next);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  const getDragProps = (i) => ({
    draggable: true,
    onDragStart: () => handleDragStart(i),
    onDragEnter: () => handleDragEnter(i),
    onDragOver:  (e) => e.preventDefault(),
    onDragEnd:   handleDrop,
  });

  return { dragIdx, overIdx, getDragProps };
}

/* ─── BLOCK MANAGER ─────────────────────────────────────────
   El alumno crea y elimina sus propias categorías            */
function BlockManager({ blocks, onAddBlock, onRemoveBlock }) {
  const [newBlock, setNewBlock] = React.useState("");

  const add = () => {
    const v = newBlock.trim();
    if (!v || blocks.includes(v)) return;
    onAddBlock(v);
    setNewBlock("");
  };

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: CARD2, border: "1px solid #2a2a2a" }}>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Mis categorías</p>

      {/* Lista de bloques existentes */}
      {blocks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {blocks.map(b => (
            <div key={b} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: "#242424" }}>
              <span className="text-xs font-medium text-gray-200">{b}</span>
              <button onClick={() => onRemoveBlock(b)} className="text-gray-600 hover:text-red-400 transition ml-1">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-600">Todavía no tenés categorías. Creá una para organizar tus ejercicios.</p>
      )}

      {/* Agregar nueva categoría */}
      <div className="flex gap-2">
        <input
          value={newBlock}
          onChange={e => setNewBlock(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder='Nueva categoría (ej: "Empuje", "Glúteos"...)'
          className={`flex-1 px-3 py-2 text-xs ${INPUT}`} style={iStyle}
        />
        <button
          onClick={add}
          disabled={!newBlock.trim()}
          className="px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
          style={{ background: LIME, color: "#0a1a00" }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function ExerciseCard({ ex, exIdx, color, onUpdateWeek, onUpdateSet, onAddSet, onRemoveSet, onRename, onRemove, onSubmitWeek, onToggleStar, onChangeBlock, onMoveUp, onMoveDown, blocks }) {
  const [open, setOpen]       = useState(false);
  const [week, setWeek]       = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(ex.name);
  const [showPicker, setShowPicker] = useState(false);

  const wk      = ex.weeks[week];
  const top     = topWeight(wk);
  const vol     = volume(wk);
  const eff     = week > 0 ? effDelta(ex.weeks, week) : null;
  const locked  = wk.status === "submitted" || wk.status === "approved";
  const isApproved = done(wk);
  const isPending  = submitted(wk);

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all duration-300"
      style={{
        background: CARD,
        borderColor: open ? `${GOLD}55` : BORDER,
        boxShadow: open ? `0 12px 40px -8px rgba(0,0,0,0.6)` : "0 2px 8px rgba(0,0,0,0.3)",
      }}>

      {/* Header del card */}
      <div className="flex items-center">
        <button onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-white/[.02]">
          <div className="w-1 h-10 rounded-full shrink-0" style={{ background: color }} />
          <div className="flex-1 text-left">
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setShowPicker(p => !p); }}
                className="flex items-center gap-1 mb-0.5 transition-opacity hover:opacity-80"
              >
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: ex.blockTitle ? color : MUTED }}>
                  {ex.blockTitle || "📂 Asignar carpeta"}
                </span>
                <span className="text-[8px]" style={{ color: MUTED }}>▾</span>
              </button>
              {showPicker && (
                <BlockPicker
                  blocks={blocks || []}
                  current={ex.blockTitle}
                  onSelect={v => onChangeBlock(exIdx, v)}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>
            <p className="text-sm font-semibold text-white">{ex.name}</p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
              {top ? `Serie top: ${top}kg · Vol: ${vol}kg` : "Sin datos aún"}
            </p>
          </div>
          {isApproved && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: LIME, background: "rgba(50,205,50,0.1)" }}>✓</span>}
          {isPending && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: GOLD, background: "rgba(212,175,55,0.1)" }}>⏳</span>}
          <ChevronDown size={16} className="text-gray-500 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "" }} />
        </button>
        {/* Estrella */}
        <button onClick={e => { e.stopPropagation(); onToggleStar(exIdx); }}
          className="px-2 py-3.5 transition-all duration-150 active:scale-90"
          title={ex.starred ? "Quitar de favoritos" : "Marcar como favorito"}
          style={{ color: ex.starred ? GOLD : "#333" }}>
          {ex.starred ? "★" : "☆"}
        </button>
        {/* Flechas de orden */}
        <div className="flex flex-col mr-1">
          <button onClick={e => { e.stopPropagation(); onMoveUp && onMoveUp(exIdx); }}
            className="w-9 h-7 flex items-center justify-center text-sm rounded-lg transition-all active:scale-90"
            style={{ color: exIdx === 0 ? BORDER : MUTED, background: "transparent" }}
            disabled={exIdx === 0}>↑</button>
          <button onClick={e => { e.stopPropagation(); onMoveDown && onMoveDown(exIdx); }}
            className="w-9 h-7 flex items-center justify-center text-sm rounded-lg transition-all active:scale-90"
            style={{ color: MUTED, background: "transparent" }}>↓</button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid #242424" }}>

          {/* Semana tabs */}
          <div className="flex gap-1.5 pt-3 overflow-x-auto pb-0.5">
            {["S1","S2","S3","S4","S5"].map((s, i) => {
              const wki       = ex.weeks[i];
              const isApp     = done(wki);
              const isPend    = submitted(wki);
              const hasData   = topWeight(wki) != null;
              return (
                <button key={i} onClick={() => setWeek(i)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-200"
                  style={week === i
                    ? { background: GOLD, color: "#1a1300" }
                    : isApp
                      ? { background: "rgba(50,205,50,0.15)", color: LIME }
                      : isPend
                        ? { background: "rgba(212,175,55,0.15)", color: GOLD }
                        : { background: "#242424", color: hasData ? "#ddd" : MUTED }}>
                  {s}{isApp ? " ✓" : isPend ? " ⏳" : ""}
                </button>
              );
            })}
          </div>

          {/* Series */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400">Series · Semana {week + 1}</p>
              {eff && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: eff.pct >= 0 ? LIME : GOLD, background: eff.pct >= 0 ? "rgba(50,205,50,.1)" : "rgba(212,175,55,.1)" }}>
                  {eff.pct >= 0 ? "▲" : "▼"} {Math.abs(eff.pct).toFixed(0)}% vs S{eff.from}
                </span>
              )}
            </div>
            {(wk.sets || []).map((s, si) => locked ? (
              <div key={si} className="flex items-center gap-2 opacity-60">
                <span className="text-[10px] text-gray-600 w-12 shrink-0">Serie {si + 1}</span>
                <div className="flex-1 text-center py-1.5 text-sm rounded-xl text-white font-semibold" style={{ background: CARD2 }}>{s.reps ?? "—"} reps</div>
                <span className="text-gray-600 text-xs">×</span>
                <div className="flex-1 text-center py-1.5 text-sm rounded-xl text-white font-semibold" style={{ background: CARD2 }}>{s.weight ?? "—"} kg</div>
              </div>
            ) : (
              <div key={si} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 w-12 shrink-0">Serie {si + 1}</span>
                <input type="number" inputMode="numeric" value={s.reps ?? ""} placeholder="reps"
                  onChange={e => onUpdateSet(exIdx, week, si, "reps", e.target.value === "" ? null : +e.target.value)}
                  className={`flex-1 text-center py-2 text-sm ${INPUT}`} style={iStyle} />
                <span className="text-gray-600 text-xs">×</span>
                <input type="number" inputMode="decimal" value={s.weight ?? ""} placeholder="kg"
                  onChange={e => onUpdateSet(exIdx, week, si, "weight", e.target.value === "" ? null : +e.target.value)}
                  className={`flex-1 text-center py-2 text-sm ${INPUT}`} style={iStyle} />
                {(wk.sets || []).length > 1 && (
                  <button onClick={() => onRemoveSet(exIdx, week, si)} className="text-gray-700 hover:text-red-400 transition"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
            {!locked && (wk.sets || []).length < 6 && (
              <button onClick={() => onAddSet(exIdx, week)} className="flex items-center gap-1 text-xs font-medium" style={{ color: LIME }}>
                <Plus size={12} /> Agregar serie
              </button>
            )}
          </div>

          {/* Fecha + tiempo + segundos (solo si no está bloqueado) */}
          {!locked && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="date" value={wk.date || ""}
                    onChange={e => onUpdateWeek(exIdx, week, { date: e.target.value })}
                    className={`w-full pl-7 pr-2 py-2 text-xs ${INPUT}`} style={iStyle} />
                </div>
                <div className="relative">
                  <Clock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="number" inputMode="decimal" value={wk.time ?? ""} placeholder="min totales"
                    onChange={e => onUpdateWeek(exIdx, week, { time: e.target.value === "" ? null : +e.target.value })}
                    className={`w-full pl-7 pr-2 py-2 text-xs ${INPUT}`} style={iStyle} />
                </div>
              </div>
              {/* Segundos — para planchas, sprints, ejercicios por tiempo */}
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">seg</span>
                <input type="number" inputMode="numeric" value={wk.seconds ?? ""} placeholder="Segundos (planchas, sprints, etc.)"
                  onChange={e => onUpdateWeek(exIdx, week, { seconds: e.target.value === "" ? null : +e.target.value })}
                  className={`w-full pl-8 pr-2 py-2 text-xs ${INPUT}`} style={iStyle} />
              </div>
            </div>
          )}

          {/* Feedback (solo si no está bloqueado) */}
          {!locked && (
            <div className="rounded-xl p-3 space-y-2.5" style={{ background: "#16131e" }}>
              <p className="text-[11px] font-semibold text-gray-400">Feedback · Semana {week + 1}</p>
              {[
                ["¿Pudiste terminarla entera?", "finished"],
                ["¿Te pareció desafiante?",    "hard"],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{label}</span>
                  <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: BORDER }}>
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => onUpdateWeek(exIdx, week, { [key]: val })}
                        className="px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-90"
                        style={wk[key] === val ? { background: val ? LIME : RED, color: val ? "#0a1a00" : "#1a0000" } : { color: MUTED }}>
                        {val ? "Sí" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-[11px] text-gray-500 mb-1">¿Qué te costó más?</p>
                <input value={wk.notes} onChange={e => onUpdateWeek(exIdx, week, { notes: e.target.value })}
                  placeholder="Ej: la última serie..." className={`w-full px-3 py-2 text-xs ${INPUT}`} style={iStyle} />
              </div>
            </div>
          )}

          {/* Estado / Acción */}
          {isApproved ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(50,205,50,0.08)" }}>
              <Check size={14} style={{ color: LIME }} />
              <p className="text-xs font-semibold" style={{ color: LIME }}>Semana aprobada por el coach 🎉</p>
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(212,175,55,0.08)" }}>
              <span className="text-base">⏳</span>
              <p className="text-xs font-semibold" style={{ color: GOLD }}>Enviada al coach · esperando aprobación</p>
            </div>
          ) : (top != null || wk.seconds != null || wk.time != null) ? (
            <>
              <button onClick={() => onSubmitWeek(exIdx, week)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[.97]"
                style={{ background: LIME_S, color: LIME, border: `1px solid ${LIME}44` }}>
                📤 Enviar esta semana al coach (opcional)
              </button>
              <p className="text-[10px] text-center" style={{ color: MUTED }}>Tus datos ya se guardan automáticamente</p>
            </>
          ) : (
            <p className="text-[11px] text-gray-600 text-center py-1">Cargá al menos una serie para poder enviar</p>
          )}

          {/* Renombrar / bloque / eliminar */}
          <div className="space-y-2 pt-1">
            {renaming ? (
              <div className="flex items-center gap-2">
                <input value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus
                  placeholder="Nombre del ejercicio"
                  className={`flex-1 px-2 py-1.5 text-xs ${INPUT}`} style={iStyle}
                  onKeyDown={e => { if (e.key === "Enter") { onRename(exIdx, nameVal || ex.name); setRenaming(false); } }} />
                <button onClick={() => { onRename(exIdx, nameVal || ex.name); setRenaming(false); }} className="text-xs font-semibold" style={{ color: LIME }}>OK</button>
                <button onClick={() => setRenaming(false)} className="text-xs text-gray-600">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {/* Categoría ya se asigna desde el menú del header */}
              <span className="text-xs text-gray-600 py-1">
                Carpeta: <span style={{ color: TEXT }}>{ex.blockTitle || "Sin categoría"}</span>
              </span>
                <button onClick={() => setRenaming(true)} className="text-xs text-gray-600 hover:text-gray-300 transition whitespace-nowrap">Renombrar</button>
                <button onClick={() => onRemove(exIdx)} className="text-xs hover:text-red-400 transition text-gray-700 whitespace-nowrap">Eliminar</button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}



function StudentPanel({ student, setStudent }) {
  const [view, setView]         = useState("train");
  const [toast, setToast]       = useState("");
  const [newEx, setNewEx]       = useState("");
  const [searchQ, setSearchQ]   = useState("");
  const [showBlocks, setShowBlocks] = useState(false);
  const [activeBlock, setActiveBlock] = useState(null);   // categoría activa (abierta)
  const [newExInBlock, setNewExInBlock] = useState(null); // en qué bloque se está escribiendo
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [reportHtml, setReportHtml]   = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // Bloques del alumno
  const blocks = student.blocks || [];
  const addBlock    = (name) => setStudent(prev => ({ ...prev, blocks: [...(prev.blocks||[]), name] }));
  const removeBlock = (name) => {
    // Al borrar un bloque, desasignar los ejercicios que lo tenían
    setStudent(prev => ({
      ...prev,
      blocks: (prev.blocks||[]).filter(b => b !== name),
      exercises: prev.exercises.map(ex => ex.blockTitle === name ? { ...ex, blockTitle: "" } : ex),
    }));
  };

  // Reordenar ejercicios con flechas ↑↓
  const moveExercise = (idx, dir) => {
    mutate(exs => {
      const next = [...exs];
      const to = idx + dir;
      if (to < 0 || to >= next.length) return exs;
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  // Filtro por mes
  const availableMonths = useMemo(() => deriveMonths(student.exercises), [student.exercises]);

  const { week, pct } = weekProgress(student.exercises);

  const mutate = fn => setStudent(prev => ({ ...prev, exercises: fn(prev.exercises) }));

  const onUpdateWeek = (exIdx, wIdx, partial) => mutate(exs =>
    exs.map((ex, i) => i !== exIdx ? ex : { ...ex, weeks: ex.weeks.map((w, wi) => wi !== wIdx ? w : { ...w, ...partial }) })
  );
  const onUpdateSet = (exIdx, wIdx, sIdx, field, val) => mutate(exs =>
    exs.map((ex, i) => i !== exIdx ? ex : {
      ...ex, weeks: ex.weeks.map((w, wi) => wi !== wIdx ? w : {
        ...w,
        sets: w.sets.map((s, si) => si !== sIdx ? s : { ...s, [field]: val }),
        status: w.sets.some(s => s.weight != null) && w.status === 'draft' ? 'draft' : w.status,
      })
    })
  );
  const onAddSet = (exIdx, wIdx) => mutate(exs =>
    exs.map((ex, i) => i !== exIdx ? ex : {
      ...ex, weeks: ex.weeks.map((w, wi) => wi !== wIdx || w.sets.length >= 6 ? w : { ...w, sets: [...w.sets, emptySet()] })
    })
  );
  const onRemoveSet = (exIdx, wIdx, sIdx) => mutate(exs =>
    exs.map((ex, i) => i !== exIdx ? ex : {
      ...ex, weeks: ex.weeks.map((w, wi) => wi !== wIdx ? w : { ...w, sets: w.sets.filter((_, si) => si !== sIdx) })
    })
  );
  const onSubmitWeek = (exIdx, wIdx) => {
    mutate(exs => exs.map((ex, i) => i !== exIdx ? ex : {
      ...ex, weeks: ex.weeks.map((w, wi) => wi !== wIdx ? w : { ...w, status: "submitted" })
    }));
    showToast("Semana enviada al coach · esperá su aprobación");
  };
  const onRename      = (exIdx, name) => mutate(exs => exs.map((ex, i) => i !== exIdx ? ex : { ...ex, name }));
  const onRemove      = exIdx => mutate(exs => exs.filter((_, i) => i !== exIdx));
  const onToggleStar  = exIdx => mutate(exs => exs.map((ex, i) => i !== exIdx ? ex : { ...ex, starred: !ex.starred }));
  const onChangeBlock = (exIdx, val) => mutate(exs => exs.map((ex, i) => i !== exIdx ? ex : { ...ex, blockTitle: val }));
  const onAdd = () => {
    if (!newEx.trim()) return;
    if (student.exercises.length >= MAX_EX) { showToast("Límite de 10 ejercicios"); return; }
    mutate(exs => [...exs, emptyExercise(newEx.trim())]);
    setNewEx(""); setNewExInBlock(null);
  };

  const onAddToBlock = (blockKey) => {
    if (!newEx.trim()) return;
    if (student.exercises.length >= MAX_EX) { showToast("Límite de 10 ejercicios"); return; }
    const blockTitle = blockKey === "__none__" || blockKey === "__global__" ? "" : blockKey;
    mutate(exs => [...exs, { ...emptyExercise(newEx.trim()), blockTitle }]);
    setNewEx(""); setNewExInBlock(null);
  };

  // Chart data
  const chartData = [0,1,2,3,4].map(w => {
    const row = { s: `S${w+1}` };
    student.exercises.forEach(ex => { row[ex.name] = topWeight(ex.weeks[w]); });
    return row;
  });

  const gains = student.exercises
    .map(ex => ({ name: ex.name, pct: pctGain(ex.weeks) }))
    .filter(x => x.pct != null)
    .sort((a, b) => b.pct - a.pct);

  // Stats calculadas para el perfil
  const totalApproved = student.exercises.reduce((sum, ex) => sum + ex.weeks.filter(w => done(w)).length, 0);
  const totalSubmitted = student.exercises.reduce((sum, ex) => sum + ex.weeks.filter(w => w.status === "submitted").length, 0);
  const bestLift = student.exercises.reduce((best, ex) => {
    const top = Math.max(...ex.weeks.map(topWeight).filter(v => v != null), 0);
    return top > best ? top : best;
  }, 0);

  return (
    <>
      {reportHtml && <ReportOverlay html={reportHtml} onClose={() => setReportHtml(null)} />}
      <div className="min-h-screen" style={{ background: BG }}>
      {/* Header */}
      <div className="px-4 pt-10 pb-2">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Bienvenido</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{student.name.split(" ")[0]}</h1>
          </div>
          <div className="relative">
            <ProgressRing pct={pct} size={60} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-white leading-none">{pct}%</span>
              <span className="text-[9px] text-gray-500 leading-none">S{week}</span>
            </div>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            ["Semanas aprobadas", totalApproved, GOLD],
            ["Enviadas al coach", totalSubmitted, "#7DA0FA"],
            ["Mejor serie", bestLift > 0 ? `${bestLift}kg` : "—", LIME],
          ].map(([label, val, color]) => (
            <div key={label} className="rounded-xl px-2 py-2.5 text-center" style={{ background: CARD2, border: "1px solid #242424" }}>
              <p className="text-base font-bold leading-tight" style={{ color }}>{val}</p>
              <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Resumen visual de las 5 semanas */}
        <div className="flex gap-1.5 mb-5">
          {[0,1,2,3,4].map(wi => {
            const allApproved = student.exercises.length > 0 && student.exercises.every(ex => done(ex.weeks[wi]));
            const anySubmitted = student.exercises.some(ex => ex.weeks[wi].status === "submitted");
            const anyDraft     = student.exercises.some(ex => topWeight(ex.weeks[wi]) != null);
            const color = allApproved ? LIME : anySubmitted ? GOLD : anyDraft ? "#7DA0FA" : "#333";
            const label = allApproved ? "✓" : anySubmitted ? "⏳" : anyDraft ? "…" : "○";
            return (
              <div key={wi} className="flex-1 rounded-lg py-2 text-center" style={{ background: allApproved ? "rgba(50,205,50,0.1)" : anySubmitted ? "rgba(212,175,55,0.1)" : "#1a1a1a", border: `1px solid ${color}40` }}>
                <p className="text-[11px] font-bold" style={{ color }}>{label}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">S{wi + 1}</p>
              </div>
            );
          })}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: CARD2 }}>
          {[["train", <Dumbbell size={13} />, "Entrenar"], ["progress", <BarChart3 size={13} />, "Mi progreso"]].map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
              style={view === v ? { background: GOLD, color: "#1a1300" } : { color: MUTED }}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-24 space-y-3">
        {view === "train" ? (
          <>
            {/* ── Buscador ──────────────────────────────────────── */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Buscar ejercicio..."
                  className={`w-full pl-10 pr-4 py-2.5 text-sm ${INPUT}`} style={iStyle} />
                {searchQ && <button onClick={() => setSearchQ("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }}><X size={14} /></button>}
              </div>
              <button onClick={() => setShowBlocks(p => !p)}
                className="px-3 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap"
                style={showBlocks ? { background: GOLD_S, color: GOLD, border: `1px solid ${GOLD}44` } : { background: CARD2, color: MUTED, border: `1px solid ${BORDER}` }}>
                {blocks.length > 0 ? `📂 ${blocks.length}` : "📂"}
              </button>
            </div>

            {/* ── Panel de categorías ───────────────────────────── */}
            {showBlocks && (
              <BlockManager blocks={blocks} onAddBlock={addBlock} onRemoveBlock={removeBlock} />
            )}

            {/* ── Filtro por mes ────────────────────────────────── */}
            {availableMonths.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                <button onClick={() => setSelectedMonth(null)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={!selectedMonth ? { background: LIME_S, color: LIME, border: `1px solid ${LIME}44` } : { background: CARD2, color: MUTED, border: `1px solid ${BORDER}` }}>
                  Todos
                </button>
                {availableMonths.map(m => (
                  <button key={m} onClick={() => setSelectedMonth(m)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                    style={selectedMonth === m ? { background: GOLD_S, color: GOLD, border: `1px solid ${GOLD}44` } : { background: CARD2, color: MUTED, border: `1px solid ${BORDER}` }}>
                    {formatMonth(m)}
                  </button>
                ))}
              </div>
            )}

            {/* ── Favoritos ─────────────────────────────────────── */}
            {!searchQ && !selectedMonth && student.exercises.some(ex => ex.starred) && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: GOLD }}>★ Favoritos</p>
                {student.exercises.map((ex, i) => !ex.starred ? null : (
                  <ExerciseCard key={i} ex={ex} exIdx={i} color={LINE_COLORS[i % LINE_COLORS.length]}
                    onUpdateWeek={onUpdateWeek} onUpdateSet={onUpdateSet}
                    onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRename={onRename} onRemove={onRemove}
                    onSubmitWeek={onSubmitWeek} onToggleStar={onToggleStar} onChangeBlock={onChangeBlock}
                    onMoveUp={idx => moveExercise(idx, -1)} onMoveDown={idx => moveExercise(idx, 1)}
                    blocks={blocks} />
                ))}
                <div className="h-px" style={{ background: BORDER }} />
              </div>
            )}

            {/* ── Vista por categorías (Jobs-style: abrís la carpeta, agregás ahí) */}
            {searchQ ? (
              // Modo búsqueda: lista plana filtrada
              (() => {
                const results = student.exercises
                  .map((ex, i) => ({ ex, i }))
                  .filter(({ ex }) => ex.name.toLowerCase().includes(searchQ.toLowerCase()) &&
                    (!selectedMonth || exerciseMatchesMonth(ex, selectedMonth)));
                return results.length === 0 ? (
                  <p className="text-center py-6 text-sm" style={{ color: MUTED }}>Sin resultados para "{searchQ}"</p>
                ) : (
                  <div className="space-y-2">
                    {results.map(({ ex, i }) => (
                      <ExerciseCard key={i} ex={ex} exIdx={i} color={LINE_COLORS[i % LINE_COLORS.length]}
                        onUpdateWeek={onUpdateWeek} onUpdateSet={onUpdateSet}
                        onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRename={onRename} onRemove={onRemove}
                        onSubmitWeek={onSubmitWeek} onToggleStar={onToggleStar} onChangeBlock={onChangeBlock}
                        onMoveUp={idx => moveExercise(idx, -1)} onMoveDown={idx => moveExercise(idx, 1)}
                        blocks={blocks} />
                    ))}
                  </div>
                );
              })()
            ) : (
              // Modo normal: secciones por categoría — tocás la categoría, ves solo esos ejercicios
              (() => {
                // Construir secciones: categorías definidas + "Sin categoría"
                const allSections = [
                  ...blocks.map(b => ({ key: b, label: b, isReal: true })),
                  { key: "__none__", label: "Sin categoría", isReal: false },
                ];

                return allSections.map(({ key, label, isReal }) => {
                  const items = student.exercises
                    .map((ex, i) => ({ ex, i }))
                    .filter(({ ex }) =>
                      (key === "__none__" ? !ex.blockTitle || !blocks.includes(ex.blockTitle) : ex.blockTitle === key) &&
                      (!selectedMonth || exerciseMatchesMonth(ex, selectedMonth))
                    );

                  const isActive = activeBlock === key;
                  const hasItems = items.length > 0;

                  // Ocultar "Sin categoría" si no tiene ejercicios y hay bloques definidos
                  if (!isReal && !hasItems && blocks.length > 0) return null;

                  return (
                    <div key={key} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isActive ? GOLD + "55" : BORDER}`, background: CARD }}>
                      {/* Header de la categoría — toca para filtrar/abrir */}
                      <button
                        onClick={() => setActiveBlock(isActive ? null : key)}
                        className="w-full flex items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-white/[.02]"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{isActive ? "📂" : "📁"}</span>
                          <div className="text-left">
                            <p className="text-sm font-semibold" style={{ color: isActive ? GOLD : TEXT }}>{label}</p>
                            <p className="text-[10px]" style={{ color: MUTED }}>{items.length} ejercicio{items.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <span className="text-xs" style={{ color: MUTED }}>{isActive ? "▲" : "▼"}</span>
                      </button>

                      {/* Contenido — solo visible cuando la categoría está abierta */}
                      {isActive && (
                        <div className="px-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                          <div className="pt-2 space-y-2">
                            {items.length === 0 ? (
                              <p className="text-xs text-center py-3" style={{ color: MUTED }}>
                                Esta categoría está vacía — agregá un ejercicio abajo
                              </p>
                            ) : items.map(({ ex, i }) => (
                              <ExerciseCard key={i} ex={ex} exIdx={i} color={LINE_COLORS[i % LINE_COLORS.length]}
                                onUpdateWeek={onUpdateWeek} onUpdateSet={onUpdateSet}
                                onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRename={onRename} onRemove={onRemove}
                                onSubmitWeek={onSubmitWeek} onToggleStar={onToggleStar} onChangeBlock={onChangeBlock}
                                onMoveUp={idx => moveExercise(idx, -1)} onMoveDown={idx => moveExercise(idx, 1)}
                                blocks={blocks} />
                            ))}
                          </div>

                          {/* Agregar ejercicio DIRECTAMENTE en esta categoría */}
                          {student.exercises.length < MAX_EX && (
                            <div className="flex gap-2 pt-1">
                              <input
                                value={newExInBlock === key ? newEx : ""}
                                onFocus={() => setNewExInBlock(key)}
                                onChange={e => { setNewExInBlock(key); setNewEx(e.target.value); }}
                                onKeyDown={e => { if (e.key === "Enter") onAddToBlock(key); }}
                                placeholder="Agregar ejercicio aquí..."
                                className={`flex-1 px-3 py-2 text-xs ${INPUT}`} style={iStyle}
                              />
                              <button
                                onClick={() => onAddToBlock(key)}
                                disabled={newExInBlock !== key || !newEx.trim()}
                                className="px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                                style={{ background: LIME_S, color: LIME, border: `1px solid ${LIME}44` }}>
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            )}

            {/* ── Nueva categoría o ejercicio sin categoría ─────── */}
            {!searchQ && (
              <div className="flex gap-2 pt-1">
                <input value={newExInBlock === "__global__" ? newEx : ""} onFocus={() => setNewExInBlock("__global__")}
                  onChange={e => { setNewExInBlock("__global__"); setNewEx(e.target.value); }}
                  onKeyDown={e => { if (e.key === "Enter") onAdd(); }}
                  placeholder={student.exercises.length >= MAX_EX ? "Límite de 10 ejercicios" : blocks.length > 0 ? "Ejercicio sin categoría..." : "Nuevo ejercicio..."}
                  disabled={student.exercises.length >= MAX_EX}
                  className={`flex-1 px-4 py-3 text-sm ${INPUT} disabled:opacity-40`} style={iStyle} />
                <button onClick={onAdd} disabled={newExInBlock !== "__global__" || !newEx.trim() || student.exercises.length >= MAX_EX}
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold transition-all duration-200 active:scale-95 disabled:opacity-40"
                  style={{ background: LIME, color: "#0a1a00" }}>
                  <Plus size={20} />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Progreso */}
            {gains.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: CARD, border: "1px solid #242424" }}>
                {gains.slice(0, 3).map((g, i) => (
                  <div key={g.name} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: BORDER }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: LINE_COLORS[student.exercises.findIndex(e => e.name === g.name) % LINE_COLORS.length] }} />
                      <span className="text-sm text-gray-200">{g.name}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: i === 0 ? LIME : i === gains.length - 1 ? GOLD : "#ddd" }}>
                      {g.pct >= 0 ? "+" : ""}{g.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Gráfico */}
            <div className="rounded-2xl p-4" style={{ background: CARD, border: "1px solid #242424" }}>
              <p className="text-xs font-semibold text-gray-400 mb-3">Evolución del peso (kg)</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#222" strokeDasharray="4 4" />
                    <XAxis dataKey="s" stroke={MUTED} fontSize={11} />
                    <YAxis stroke={MUTED} fontSize={11} />
                    <Tooltip contentStyle={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8 }} />
                    {student.exercises.map((ex, i) => (
                      <Line key={ex.name} type="monotone" dataKey={ex.name}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.5}
                        dot={{ r: 3, fill: LINE_COLORS[i % LINE_COLORS.length] }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>


            {/* Exportar PDF */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: CARD2, border: "1px solid rgba(212,175,55,0.25)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Exportar reporte completo</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {totalApproved > 0
                      ? `Incluye ${totalApproved} semana${totalApproved > 1 ? "s" : ""} aprobada${totalApproved > 1 ? "s" : ""} + datos en curso`
                      : "Incluye todos los datos cargados hasta hoy"}
                  </p>
                </div>
                <FileText size={20} style={{ color: GOLD }} />
              </div>
              <button
                onClick={async () => {
                  setGeneratingPDF(true);
                  const summary = await generateSummary(student);
                  setReportHtml(exportPDF(student, summary));
                  setGeneratingPDF(false);
                }}
                disabled={generatingPDF}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[.97] hover:brightness-110 disabled:opacity-70"
                style={{ background: GOLD, color: "#1a1300" }}
              >
                {generatingPDF ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#1a130044", borderTopColor: "#1a1300" }} />
                    Analizando tu progreso...
                  </>
                ) : (
                  <>📄 Exportar PDF con análisis inteligente</>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <Toast msg={toast} onClose={() => setToast("")} />
    </div>
    </>
  );
}

/* ─── ADMIN VIEW ─────────────────────────────────────────── */
function AdminPanel({ students, users, setUsers, setStudents }) {
  const [view, setView]       = useState("members"); // "members" | "manage"
  const [selected, setSelected] = useState(null);
  const [query, setQuery]     = useState("");
  const [toast, setToast]     = useState("");
  const [form, setForm]       = useState({ name: "", username: "", password: "" });
  const [formErr, setFormErr] = useState("");
  const [confirmOff, setConfirmOff] = useState(null);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const active = useMemo(() =>
    students.filter(s => { const u = users.find(u => u.role === "alumno" && u.studentId === s.id); return !u || u.status === "active"; }),
    [students, users]);

  const inactive = useMemo(() =>
    students.filter(s => { const u = users.find(u => u.role === "alumno" && u.studentId === s.id); return u && u.status === "inactive"; }),
    [students, users]);

  const pending = useMemo(() =>
    users.filter(u => u.role === "alumno" && u.status === "pending"),
    [users]);

  const filtered = useMemo(() => active.filter(s => s.name.toLowerCase().includes(query.toLowerCase())), [active, query]);

  // Semanas enviadas por alumnos pendientes de aprobación
  const pendingWeeks = useMemo(() => {
    const result = [];
    active.forEach(s => {
      s.exercises.forEach((ex, ei) => {
        ex.weeks.forEach((w, wi) => {
          if (w.status === "submitted") result.push({ student: s, exIdx: ei, wIdx: wi, exName: ex.name });
        });
      });
    });
    return result;
  }, [active]);

  const approveWeek = (studentId, exIdx, wIdx) => {
    setStudents(prev => prev.map(s => s.id !== studentId ? s : {
      ...s, exercises: s.exercises.map((ex, ei) => ei !== exIdx ? ex : {
        ...ex, weeks: ex.weeks.map((w, wi) => wi !== wIdx ? w : { ...w, status: "approved" })
      })
    }));
    showToast("✓ Semana aprobada");
  };

  const rejectWeek = (studentId, exIdx, wIdx) => {
    setStudents(prev => prev.map(s => s.id !== studentId ? s : {
      ...s, exercises: s.exercises.map((ex, ei) => ei !== exIdx ? ex : {
        ...ex, weeks: ex.weeks.map((w, wi) => wi !== wIdx ? w : { ...w, status: "draft" })
      })
    }));
    showToast("Semana devuelta al alumno para corregir");
  };

  const addMember = () => {
    setFormErr("");
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) { setFormErr("Completá todos los campos"); return; }
    if (users.some(u => u.username.toLowerCase() === form.username.trim().toLowerCase())) { setFormErr("Ese usuario ya existe"); return; }
    const newId = uuid();
    setStudents(p => [...p, { id: newId, name: form.name.trim(), since: new Date().toLocaleDateString("es-AR", { month: "short", year: "numeric" }), inactive: 0, lastDay: "Aún no registra", exercises: [emptyExercise("Sentadilla")], blocks: [] }]);
    setUsers(p => [...p, { id: uuid(), username: form.username.trim(), password: form.password, role: "alumno", studentId: newId, status: "active" }]);
    setForm({ name: "", username: "", password: "" });
    showToast(`✓ ${form.name.trim()} dado de alta`);
  };

  const deactivate = id => {
    setUsers(p => {
      const hasUser = p.some(u => u.role === "alumno" && u.studentId === id);
      // Si el alumno no tiene user (datos demo), creamos uno inactivo para poder darlo de baja
      if (!hasUser) return [...p, { id: `u_baja_${id}`, role: "alumno", studentId: id, status: "inactive", username: `alumno_${id}`, password: "" }];
      return p.map(u => u.role === "alumno" && u.studentId === id ? { ...u, status: "inactive" } : u);
    });
    setConfirmOff(null);
    showToast(`Alumno dado de baja · historial guardado`);
  };

  const reactivate = id => {
    const s = students.find(s => s.id === id);
    setUsers(p => p.map(u => u.role === "alumno" && u.studentId === id ? { ...u, status: "active" } : u));
    showToast(`${s?.name} reactivado`);
  };

  const approve = (userId) => {
    setUsers(p => p.map(u => u.id === userId ? { ...u, status: "active" } : u));
    const u = users.find(u => u.id === userId);
    const s = students.find(s => s.id === u?.studentId);
    showToast(`✓ ${s?.name || "Alumno"} aprobado · ya puede ingresar`);
  };

  const reject = (userId) => {
    const u = users.find(u => u.id === userId);
    const s = students.find(s => s.id === u?.studentId);
    setUsers(p => p.filter(u => u.id !== userId));
    setStudents(p => p.filter(s => s.id !== u?.studentId));
    showToast(`Solicitud rechazada`);
  };

  if (selected) {
    const s = students.find(s => s.id === selected);
    const gains = s.exercises.map(ex => ({ name: ex.name, pct: pctGain(ex.weeks) })).filter(x => x.pct != null).sort((a, b) => b.pct - a.pct);
    const chartData = [0,1,2,3,4].map(w => { const row = { s: `S${w+1}` }; s.exercises.forEach(ex => { row[ex.name] = topWeight(ex.weeks[w]); }); return row; });
    return (
      <div className="min-h-screen" style={{ background: BG }}>
        <div className="px-4 pt-10 pb-4">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-gray-500 mb-6 hover:text-gray-300 transition">
            ← Volver
          </button>
          <div className="flex items-center gap-3 mb-6">
            <Avatar name={s.name} size={12} gold />
            <div>
              <h2 className="text-xl font-bold text-white">{s.name}</h2>
              <p className="text-xs text-gray-500">Desde {s.since} · {s.lastDay}</p>
            </div>
          </div>

          {/* Rankings */}
          {gains.length > 0 && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: CARD, border: "1px solid #242424" }}>
              {gains.map((g, i) => (
                <div key={g.name} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: BORDER }}>
                  <span className="text-sm text-gray-200">{g.name}</span>
                  <span className="text-sm font-bold" style={{ color: i === 0 ? LIME : i === gains.length - 1 ? GOLD : "#ddd" }}>
                    {g.pct >= 0 ? "+" : ""}{g.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Gráfico */}
          <div className="rounded-2xl p-4" style={{ background: CARD, border: "1px solid #242424" }}>
            <p className="text-xs font-semibold text-gray-400 mb-3">Evolución de carga</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#222" strokeDasharray="4 4" />
                  <XAxis dataKey="s" stroke={MUTED} fontSize={11} />
                  <YAxis stroke={MUTED} fontSize={11} />
                  <Tooltip contentStyle={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8 }} />
                  {s.exercises.map((ex, i) => (
                    <Line key={ex.name} type="monotone" dataKey={ex.name}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detalle de series por semana */}
          {s.exercises.map((ex, ei) => (
            <div key={ei} className="rounded-2xl p-4 mt-3" style={{ background: CARD, border: "1px solid #242424" }}>
              <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: LINE_COLORS[ei % LINE_COLORS.length] }} />
                {ex.name}
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {ex.weeks.map((w, wi) => {
                  const top = topWeight(w);
                  const topSet = (w.sets || []).find(s => s.weight === top);
                  return (
                    <div key={wi} className="rounded-xl py-2.5 text-center" style={{ background: done(w) ? "rgba(50,205,50,0.08)" : "#161616" }}>
                      <p className="text-[9px] text-gray-600">S{wi+1}</p>
                      <p className="text-xs font-bold text-white">{top ? `${top}kg` : "—"}</p>
                      {topSet?.reps && <p className="text-[9px] text-gray-500">×{topSet.reps}</p>}
                      {w.notes && <p className="text-[9px] mt-1 px-1 truncate" style={{ color: GOLD }} title={w.notes}>★</p>}
                    </div>
                  );
                })}
              </div>
              {ex.weeks.some(w => done(w) && w.notes) && (
                <div className="mt-3 space-y-1">
                  {ex.weeks.filter(w => done(w) && w.notes).map((w, j) => (
                    <p key={j} className="text-[11px] text-gray-500">
                      <span style={{ color: GOLD }}>S{ex.weeks.indexOf(w)+1}:</span> {w.notes}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <Toast msg={toast} onClose={() => setToast("")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <div className="px-4 pt-10 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Coach</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">ProClub OS</h1>
          </div>
          <img src={LOGO_SQ} alt="logo" className="w-10 h-10 rounded-xl object-cover border" style={{ borderColor: "rgba(212,175,55,0.4)" }} />
        </div>

        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: CARD2 }}>
          {[["members", <Dumbbell size={13} />, pendingWeeks.length > 0 ? `Atletas · ${pendingWeeks.length} ⏳` : `Atletas (${active.length})`], ["manage", <UserPlus size={13} />, pending.length > 0 ? `Gestión · ${pending.length}` : "Gestión"]].map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
              style={view === v ? { background: GOLD, color: "#1a1300" } : { color: MUTED }}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-24 space-y-3">
        {view === "members" ? (
          <>
            {/* Bandeja de aprobaciones */}
            {pendingWeeks.length > 0 && (
              <div className="rounded-2xl p-4 space-y-2.5" style={{ background: "#1e1c14", border: `1px solid rgba(212,175,55,0.5)` }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: GOLD }} />
                  <p className="text-sm font-semibold" style={{ color: GOLD }}>
                    {pendingWeeks.length} semana{pendingWeeks.length > 1 ? "s" : ""} para aprobar
                  </p>
                </div>
                {pendingWeeks.map(({ student: s, exIdx, wIdx, exName }, idx) => {
                  const wk = s.exercises[exIdx].weeks[wIdx];
                  const top = topWeight(wk);
                  const vol = volume(wk);
                  return (
                    <div key={idx} className="rounded-xl p-3" style={{ background: "#111", border: "1px solid #2a2200" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{s.name}</p>
                          <p className="text-[10px] text-gray-500">{exName} · Semana {wIdx + 1}{wk.date ? ` · ${wk.date}` : ""}</p>
                        </div>
                        <div className="text-right">
                          {top && <p className="text-sm font-bold" style={{ color: LIME }}>{top} kg</p>}
                          {vol > 0 && <p className="text-[10px] text-gray-500">Vol: {vol} kg</p>}
                        </div>
                      </div>
                      {/* Sets resumidos */}
                      <div className="flex gap-1.5 mb-2.5 flex-wrap">
                        {(wk.sets || []).filter(s => s.weight).map((s, si) => (
                          <span key={si} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "#222", color: "#ccc" }}>
                            {s.reps}×{s.weight}kg
                          </span>
                        ))}
                      </div>
                      {wk.notes && <p className="text-[10px] text-gray-500 mb-2.5 italic">"{wk.notes}"</p>}
                      <div className="flex gap-2">
                        <button onClick={() => approveWeek(s.id, exIdx, wIdx)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 hover:brightness-110"
                          style={{ background: LIME, color: "#0a1a00" }}>
                          ✓ Aprobar
                        </button>
                        <button onClick={() => rejectWeek(s.id, exIdx, wIdx)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={{ background: "#1e1418", color: RED, border: `1px solid ${RED}` }}>
                          ↩ Devolver
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar alumno..."
                className={`w-full pl-10 pr-4 py-3 text-sm ${INPUT}`} style={iStyle} />
            </div>

            {filtered.map(s => {
              const avg = (() => { const gs = s.exercises.map(ex => pctGain(ex.weeks)).filter(Boolean); return gs.length ? gs.reduce((a,b)=>a+b,0)/gs.length : null; })();
              const {pct} = weekProgress(s.exercises);
              return (
                <button key={s.id} onClick={() => setSelected(s.id)}
                  className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 hover:border-[rgba(212,175,55,0.3)] active:scale-[.99] text-left"
                  style={{ background: CARD, border: "1px solid #242424" }}>
                  <Avatar name={s.name} size={10} gold />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                      {avg != null && (
                        <span className="text-xs font-bold ml-2 shrink-0" style={{ color: avg >= 0 ? LIME : "#E07B7B" }}>
                          {avg >= 0 ? "+" : ""}{avg.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <Bar pct={pct} color={s.inactive > 7 ? GOLD : LIME} />
                    <p className="text-[10px] text-gray-600 mt-1">{s.lastDay} · S{weekProgress(s.exercises).week}/5</p>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <p className="text-center text-gray-600 text-sm py-8">No hay resultados.</p>
            )}
          </>
        ) : (
          <>
            {/* Solicitudes pendientes */}
            {pending.length > 0 && (
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1e1c14", border: `1px solid rgba(212,175,55,0.5)` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: GOLD }} />
                  <p className="text-sm font-semibold" style={{ color: GOLD }}>
                    {pending.length} solicitud{pending.length > 1 ? "es" : ""} pendiente{pending.length > 1 ? "s" : ""}
                  </p>
                </div>
                {pending.map(pu => {
                  const s = students.find(s => s.id === pu.studentId);
                  return (
                    <div key={pu.id} className="rounded-xl p-3" style={{ background: "#111", border: "1px solid #2a2200" }}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <Avatar name={pu.requestedName || s?.name || "?"} size={9} />
                        <div>
                          <p className="text-sm font-semibold text-white">{pu.requestedName || s?.name}</p>
                          <p className="text-[10px] text-gray-500">@{pu.username} · solicitó acceso</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approve(pu.id)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 hover:brightness-110"
                          style={{ background: LIME, color: "#0a1a00" }}>
                          <Check size={12} className="inline mr-1" />Aprobar
                        </button>
                        <button onClick={() => reject(pu.id)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={{ background: "#1e1418", color: RED, border: `1px solid ${RED}` }}>
                          <X size={12} className="inline mr-1" />Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Alta manual */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: CARD, border: `1px solid rgba(212,175,55,0.2)` }}>
              <p className="text-sm font-semibold text-white">Dar de alta manualmente</p>
              {[["name","Nombre completo", User], ["username","Usuario", User], ["password","Contraseña temporal", Lock]].map(([f, ph, Icon]) => (
                <div key={f} className="relative">
                  <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                    placeholder={ph} type={f === "password" ? "text" : "text"}
                    className={`w-full pl-9 pr-3 py-2.5 text-sm ${INPUT}`} style={iStyle} />
                </div>
              ))}
              {formErr && <p className="text-xs" style={{ color: RED }}>{formErr}</p>}
              <button onClick={addMember}
                className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[.98] hover:brightness-110"
                style={{ background: LIME, color: "#0a1a00" }}>
                <UserPlus size={15} /> Dar de alta
              </button>
            </div>

            {/* Activos */}
            <p className="text-xs font-semibold text-gray-500 pt-2">Miembros activos</p>
            {active.map(s => {
              const u = users.find(u => u.role === "alumno" && u.studentId === s.id);
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 transition"
                  style={{ background: CARD, border: "1px solid #242424" }}>
                  <Avatar name={s.name} size={9} gold />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-500">@{u?.username} · {s.since}</p>
                  </div>
                  {confirmOff === s.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => deactivate(s.id)} className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: RED, color: TEXT }}>Dar de baja</button>
                      <button onClick={() => setConfirmOff(null)} className="px-2 py-1 rounded-lg text-[11px]" style={{ background: "#333", color: "#aaa" }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmOff(s.id)} className="shrink-0 text-gray-700 hover:text-red-400 transition" title="Dar de baja">
                      <UserX size={16} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Inactivos */}
            {inactive.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-600 pt-2">Dados de baja</p>
                {inactive.map(s => {
                  const u = users.find(u => u.role === "alumno" && u.studentId === s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 opacity-40"
                      style={{ background: "#161616", border: "1px solid #1e1e1e" }}>
                      <Avatar name={s.name} size={9} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-400 truncate">{s.name}</p>
                        <p className="text-[10px] text-gray-600">@{u?.username}</p>
                      </div>
                      <button onClick={() => reactivate(s.id)} className="shrink-0" style={{ color: GOLD }} title="Reactivar">
                        <UserCheck size={16} />
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      <Toast msg={toast} onClose={() => setToast("")} />
    </div>
  );
}

/* ─── HEADER GLOBAL ─────────────────────────────────────── */
function Header({ name, role, onLogout }) {
  return (
    <div className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: "rgba(12,11,9,0.85)", borderColor: BORDER }}>
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)" }} />
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown size={15} style={{ color: GOLD }} />
          <span className="text-xs font-bold tracking-[0.1em] text-white">ProClub OS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-500 hidden sm:block">{name}</span>
          <button onClick={onLogout} className="text-gray-600 hover:text-gray-300 transition"><LogOut size={15} /></button>
        </div>
      </div>
    </div>
  );
}

/* ─── APP ROOT ───────────────────────────────────────────── */
export default function App() {
  const [users, setUsers] = useState(USERS);
  const [students, setStudents] = useState(STUDENTS);
  // Intentar restaurar sesión del localStorage (funciona en producción, no en artifact)
  const [me, setMe] = useState(() => loadSession(USERS));

  const handleLogin = (user) => { saveSession(user); setMe(user); };
  const handleLogout = () => { clearSession(); setMe(null); };

  const setSelf = fn => setStudents(prev => prev.map(s => s.id !== me.studentId ? s : (typeof fn === "function" ? fn(s) : fn)));

  if (!me) return <Login users={users} setUsers={setUsers} students={students} setStudents={setStudents} onLogin={handleLogin} />;

  const myStudent = me.role === "alumno" ? students.find(s => s.id === me.studentId) : null;
  const displayName = me.role === "admin" ? (me.name || me.username) : myStudent?.name;

  return (
    <div>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translate(-50%,8px); } to { opacity:1; transform:translate(-50%,0); } }
        input[type=number]::-webkit-inner-spin-button { opacity:0; }
        input:-webkit-autofill { -webkit-text-fill-color:#fff !important; box-shadow:0 0 0 1000px #0d0d0d inset !important; }
        input[type=date]::-webkit-calendar-picker-indicator { filter:invert(1); opacity:0.5; }
        * { box-sizing: border-box; }
      `}</style>
      <Header name={displayName} role={me.role} onLogout={handleLogout} />
      <div className="max-w-2xl mx-auto">
        {me.role === "admin"
          ? <AdminPanel students={students} users={users} setUsers={setUsers} setStudents={setStudents} />
          : myStudent && <StudentPanel student={myStudent} setStudent={setSelf} />}
      </div>
    </div>
  );
}
