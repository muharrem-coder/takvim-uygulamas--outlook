/* eslint-disable */
import { useState, useEffect } from "react";

const COLORS = {
  bg: "#0f0f1a", surface: "#1a1a2e", card: "#16213e", accent: "#0f3460",
  teal: "#00b4d8", purple: "#7b2d8b", text: "#e2e8f0", muted: "#94a3b8",
  border: "#2d3748", success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
};

const CLIENT_ID = "774d7d5a-1c96-42e8-8ce0-41fa960bab14";
const REDIRECT_URI = window.location.origin;
const SCOPES = "openid profile User.Read Calendars.ReadWrite";
const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

async function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function formatDate(date) {
  return new Date(date).toLocaleString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
function formatDateInput(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const reminderOptions = [
  { label: "5 dakika önce", value: 5 },
  { label: "15 dakika önce", value: 15 },
  { label: "30 dakika önce", value: 30 },
  { label: "1 saat önce", value: 60 },
  { label: "1 gün önce", value: 1440 },
  { label: "2 gün önce", value: 2880 },
];

const categoryColors = {
  "Toplantı": "#0f3460", "Kişisel": "#7b2d8b", "İş": "#00b4d8",
  "Önemli": "#ef4444", "Diğer": "#533483",
};

export default function OutlookCalendarApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("list");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [notification, setNotification] = useState(null);
  const [demoMode, setDemoMode] = useState(false);

  const [form, setForm] = useState({
    subject: "", start: formatDateInput(new Date()),
    end: formatDateInput(new Date(Date.now() + 3600000)),
    location: "", body: "", reminder: 15, category: "Toplantı",
  });

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loginMicrosoft = async () => {
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem("pkce_verifier", verifier);
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem("oauth_state", state);
    const url = `${AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256&response_mode=query`;
    window.location.href = url;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const savedState = sessionStorage.getItem("oauth_state");
    const verifier = sessionStorage.getItem("pkce_verifier");

    if (code && state === savedState && verifier) {
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem("pkce_verifier");
      sessionStorage.removeItem("oauth_state");
      exchangeCodeForToken(code, verifier);
      return;
    }

    const savedToken = sessionStorage.getItem("ms_access_token");
    const tokenExpiry = sessionStorage.getItem("ms_token_expiry");
    if (savedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
      setIsLoggedIn(true);
      fetchUserWithToken(savedToken);
      fetchEventsWithToken(savedToken);
    }
  }, []);

  const exchangeCodeForToken = async (code, verifier) => {
    setLoading(true);
    try {
      const body = new URLSearchParams({
        client_id: CLIENT_ID, code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: verifier,
        scope: SCOPES,
      });
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        const expiry = Date.now() + (data.expires_in * 1000);
        sessionStorage.setItem("ms_access_token", data.access_token);
        sessionStorage.setItem("ms_token_expiry", expiry.toString());
        if (data.refresh_token) sessionStorage.setItem("ms_refresh_token", data.refresh_token);
        setIsLoggedIn(true);
        fetchUserWithToken(data.access_token);
        fetchEventsWithToken(data.access_token);
      } else {
        showNotification("Giriş başarısız: " + (data.error_description || "Hata"), "error");
      }
    } catch (e) {
      showNotification("Bağlantı hatası", "error");
    }
    setLoading(false);
  };

  const getValidToken = async () => {
    const token = sessionStorage.getItem("ms_access_token");
    const expiry = sessionStorage.getItem("ms_token_expiry");
    if (token && expiry && Date.now() < parseInt(expiry) - 60000) return token;
    const refreshToken = sessionStorage.getItem("ms_refresh_token");
    if (!refreshToken) { logout(); return null; }
    try {
      const body = new URLSearchParams({
        client_id: CLIENT_ID, grant_type: "refresh_token",
        refresh_token: refreshToken, scope: SCOPES,
      });
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        const newExpiry = Date.now() + (data.expires_in * 1000);
        sessionStorage.setItem("ms_access_token", data.access_token);
        sessionStorage.setItem("ms_token_expiry", newExpiry.toString());
        if (data.refresh_token) sessionStorage.setItem("ms_refresh_token", data.refresh_token);
        return data.access_token;
      }
    } catch (e) {}
    logout();
    return null;
  };

  const fetchUserWithToken = async (token) => {
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUser(data);
    } catch (e) {}
  };

  const fetchEventsWithToken = async (token) => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now}&endDateTime=${future}&$orderby=start/dateTime&$top=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.value) setEvents(data.value);
    } catch (e) {
      showNotification("Etkinlikler yüklenemedi", "error");
    }
    setLoading(false);
  };

  const fetchEvents = async () => {
    const token = await getValidToken();
    if (token) fetchEventsWithToken(token);
  };

  const loginDemo = () => {
    setDemoMode(true);
    setIsLoggedIn(true);
    setUser({ displayName: "Demo Kullanıcı", mail: "demo@outlook.com" });
    setEvents([
      { id: "1", subject: "Proje Toplantısı", start: { dateTime: new Date(Date.now() + 3600000 * 2).toISOString() }, end: { dateTime: new Date(Date.now() + 3600000 * 3).toISOString() }, location: { displayName: "Konferans Salonu" }, bodyPreview: "Q2 hedefleri", reminderMinutesBeforeStart: 15, categories: ["Toplantı"] },
      { id: "2", subject: "Doktor Randevusu", start: { dateTime: new Date(Date.now() + 3600000 * 26).toISOString() }, end: { dateTime: new Date(Date.now() + 3600000 * 27).toISOString() }, location: { displayName: "Hastane" }, bodyPreview: "Yıllık check-up", reminderMinutesBeforeStart: 60, categories: ["Kişisel"] },
    ]);
  };

  const createEvent = async () => {
    if (!form.subject.trim()) return showNotification("Başlık gerekli!", "error");

    if (demoMode) {
      const newEvent = { id: Date.now().toString(), subject: form.subject, start: { dateTime: new Date(form.start).toISOString() }, end: { dateTime: new Date(form.end).toISOString() }, location: { displayName: form.location }, bodyPreview: form.body, reminderMinutesBeforeStart: form.reminder, categories: [form.category] };
      setEvents(prev => [...prev, newEvent].sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime)));
      showNotification("✅ Etkinlik eklendi!");
      setView("list"); resetForm(); return;
    }

    const token = await getValidToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject,
          start: { dateTime: new Date(form.start).toISOString(), timeZone: "Europe/Istanbul" },
          end: { dateTime: new Date(form.end).toISOString(), timeZone: "Europe/Istanbul" },
          location: { displayName: form.location },
          body: { contentType: "text", content: form.body },
          isReminderOn: true,
          reminderMinutesBeforeStart: form.reminder,
          categories: [form.category],
        })
      });
      if (res.ok) {
        showNotification("✅ Outlook'a kaydedildi!");
        await fetchEventsWithToken(token);
        setView("list"); resetForm();
      } else {
        const err = await res.json();
        showNotification("Hata: " + (err.error?.message || "Eklenemedi"), "error");
      }
    } catch (e) {
      showNotification("Bağlantı hatası", "error");
    }
    setLoading(false);
  };

  const deleteEvent = async (id) => {
    if (demoMode) {
      setEvents(prev => prev.filter(e => e.id !== id));
      showNotification("Silindi"); setView("list"); setSelectedEvent(null); return;
    }
    const token = await getValidToken();
    if (!token) return;
    try {
      await fetch(`https://graph.microsoft.com/v1.0/me/events/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      showNotification("Etkinlik silindi");
      await fetchEventsWithToken(token);
      setView("list"); setSelectedEvent(null);
    } catch { showNotification("Silinemedi", "error"); }
  };

  const logout = () => {
    sessionStorage.clear();
    setIsLoggedIn(false); setUser(null); setEvents([]); setDemoMode(false);
  };

  const resetForm = () => setForm({
    subject: "", start: formatDateInput(new Date()),
    end: formatDateInput(new Date(Date.now() + 3600000)),
    location: "", body: "", reminder: 15, category: "Toplantı",
  });

  const getUpcoming = () => events.filter(e => new Date(e.start.dateTime).getTime() > Date.now() - 3600000);
  const getCategoryColor = (event) => categoryColors[event.categories?.[0]] || categoryColors["Diğer"];
  const timeUntil = (dateStr) => {
    const diff = new Date(dateStr) - Date.now();
    if (diff < 0) return "Geçti";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h/24)} gün sonra`;
    if (h > 0) return `${h}s ${m}dk sonra`;
    return `${m} dk sonra`;
  };

  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "20px" }}>
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}.lc{animation:float 4s ease-in-out infinite}.btn:hover{transform:translateY(-2px);filter:brightness(1.1)}`}</style>
        <div className="lc" style={{ background: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)", borderRadius: "24px", padding: "60px 50px", maxWidth: "420px", width: "100%", border: "1px solid rgba(0,180,216,0.2)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{ fontSize: "60px", marginBottom: "16px" }}>📅</div>
            <h1 style={{ color: COLORS.teal, fontSize: "28px", margin: 0, fontWeight: 700 }}>Takvim Yöneticisi</h1>
            <p style={{ color: COLORS.muted, marginTop: "8px", fontSize: "15px" }}>Outlook takviminizi kolayca yönetin</p>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", color: COLORS.muted, padding: "20px", fontSize: "16px" }}>⟳ Giriş yapılıyor...</div>
          ) : (<>
            <button className="btn" onClick={loginMicrosoft} style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "linear-gradient(135deg,#0078d4,#106ebe)", border: "none", color: "white", fontSize: "16px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "14px", transition: "all 0.2s" }}>
              🔑 Microsoft ile Giriş Yap
            </button>
            <button className="btn" onClick={loginDemo} style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "linear-gradient(135deg,#7b2d8b,#533483)", border: "none", color: "white", fontSize: "16px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "all 0.2s" }}>
              🎮 Demo Olarak Dene
            </button>
          </>)}
          <p style={{ color: COLORS.muted, fontSize: "12px", textAlign: "center", marginTop: "24px", lineHeight: 1.6 }}>Giriş yaptığınızda Outlook takviminize otomatik bağlanır.</p>
        </div>
      </div>
    );
  }

  const upcoming = getUpcoming();

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', system-ui, sans-serif", color: COLORS.text }}>
      <style>{`*{box-sizing:border-box}input,textarea,select{outline:none}input:focus,textarea:focus,select:focus{border-color:${COLORS.teal}!important;box-shadow:0 0 0 3px rgba(0,180,216,0.15)!important}.ec:hover{transform:translateX(4px);background:#1e2a45!important}@keyframes fadeIn{from{opacity:0}to{opacity:1}}.page{animation:fadeIn 0.25s ease}@keyframes slideIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}.notif{animation:slideIn 0.3s ease}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:${COLORS.accent};border-radius:3px}`}</style>

      {notification && (
        <div className="notif" style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: notification.type === "error" ? COLORS.danger : COLORS.success, color: "white", padding: "14px 20px", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.3)", fontWeight: 600, fontSize: "14px" }}>
          {notification.msg}
        </div>
      )}

      <header style={{ background: "linear-gradient(135deg,#16213e,#0f3460)", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(0,180,216,0.15)", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "24px" }}>📅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "16px", color: COLORS.teal }}>Outlook Takvim</div>
            {demoMode && <div style={{ fontSize: "11px", color: COLORS.warning, fontWeight: 600 }}>DEMO MOD</div>}
          </div>
        </div>
        <nav style={{ display: "flex", gap: "8px" }}>
          {[{ id: "list", icon: "📋", label: "Etkinlikler" }, { id: "add", icon: "➕", label: "Yeni Ekle" }].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)} style={{ padding: "8px 16px", borderRadius: "10px", border: "none", background: view === tab.id ? COLORS.teal : "rgba(255,255,255,0.05)", color: view === tab.id ? "#000" : COLORS.muted, fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>{user?.displayName}</div>
            <div style={{ fontSize: "11px", color: COLORS.muted }}>{user?.mail || user?.userPrincipalName}</div>
          </div>
          <button onClick={logout} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: COLORS.danger, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Çıkış</button>
        </div>
      </header>

      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 20px" }}>

        {view === "list" && (
          <div className="page">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Yaklaşan Etkinlikler</h2>
                <p style={{ margin: "4px 0 0", color: COLORS.muted, fontSize: "14px" }}>{upcoming.length} etkinlik</p>
              </div>
              {!demoMode && (
                <button onClick={fetchEvents} disabled={loading} style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(0,180,216,0.3)", background: "transparent", color: COLORS.teal, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  {loading ? "⟳" : "🔄"} Yenile
                </button>
              )}
            </div>

            {loading && <div style={{ textAlign: "center", padding: "60px", color: COLORS.muted }}><div style={{ fontSize: "40px" }}>⟳</div>Yükleniyor...</div>}

            {!loading && upcoming.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px", background: COLORS.card, borderRadius: "16px", border: "1px solid " + COLORS.border }}>
                <div style={{ fontSize: "50px", marginBottom: "12px" }}>🗓️</div>
                <div style={{ color: COLORS.muted, fontSize: "16px" }}>Yaklaşan etkinlik yok</div>
                <button onClick={() => setView("add")} style={{ marginTop: "16px", padding: "10px 24px", borderRadius: "10px", background: COLORS.teal, border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>+ Etkinlik Ekle</button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {upcoming.map(event => (
                <div key={event.id} className="ec" onClick={() => { setSelectedEvent(event); setView("detail"); }} style={{ background: COLORS.card, borderRadius: "14px", padding: "18px 20px", border: "1px solid " + COLORS.border, cursor: "pointer", transition: "all 0.2s", display: "flex", gap: "16px", alignItems: "flex-start", borderLeft: `4px solid ${getCategoryColor(event)}` }}>
                  <div style={{ minWidth: "64px", textAlign: "center", background: "rgba(0,180,216,0.08)", borderRadius: "10px", padding: "10px 8px" }}>
                    <div style={{ fontSize: "11px", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                      {new Date(event.start.dateTime).toLocaleDateString("tr-TR", { month: "short" })}
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: COLORS.teal, lineHeight: 1 }}>
                      {new Date(event.start.dateTime).getDate()}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>{event.subject}</div>
                    <div style={{ color: COLORS.muted, fontSize: "13px", marginBottom: "6px" }}>
                      🕐 {new Date(event.start.dateTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} – {new Date(event.end.dateTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      {event.location?.displayName && ` · 📍 ${event.location.displayName}`}
                    </div>
                    {event.bodyPreview && <div style={{ color: COLORS.muted, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "500px" }}>{event.bodyPreview}</div>}
                  </div>
                  <div style={{ textAlign: "right", minWidth: "90px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", background: `${getCategoryColor(event)}22`, color: getCategoryColor(event), marginBottom: "8px", display: "inline-block" }}>
                      {event.categories?.[0] || "Diğer"}
                    </div>
                    <div style={{ fontSize: "12px", color: COLORS.warning, display: "block" }}>⏰ {timeUntil(event.start.dateTime)}</div>
                    {event.reminderMinutesBeforeStart !== undefined && <div style={{ fontSize: "11px", color: COLORS.muted, marginTop: "4px" }}>🔔 {event.reminderMinutesBeforeStart}dk önce</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "add" && (
          <div className="page">
            <h2 style={{ margin: "0 0 24px", fontSize: "22px", fontWeight: 700 }}>➕ Yeni Etkinlik Ekle</h2>
            <div style={{ background: COLORS.card, borderRadius: "16px", padding: "28px", border: "1px solid " + COLORS.border }}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: COLORS.muted, marginBottom: "8px" }}>📌 Etkinlik Başlığı *</label>
                <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Toplantı, Doktor Randevusu, vb." style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", background: COLORS.surface, border: "1px solid " + COLORS.border, color: COLORS.text, fontSize: "15px" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: COLORS.muted, marginBottom: "8px" }}>🗓️ Başlangıç</label>
                  <input type="datetime-local" value={form.start} onChange={e => setForm({...form, start: e.target.value})} style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", background: COLORS.surface, border: "1px solid " + COLORS.border, color: COLORS.text, fontSize: "14px" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: COLORS.muted, marginBottom: "8px" }}>🏁 Bitiş</label>
                  <input type="datetime-local" value={form.end} onChange={e => setForm({...form, end: e.target.value})} style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", background: COLORS.surface, border: "1px solid " + COLORS.border, color: COLORS.text, fontSize: "14px" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: COLORS.muted, marginBottom: "8px" }}>📍 Konum</label>
                  <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Adres veya online link" style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", background: COLORS.surface, border: "1px solid " + COLORS.border, color: COLORS.text, fontSize: "14px" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: COLORS.muted, marginBottom: "8px" }}>🏷️ Kategori</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", background: COLORS.surface, border: "1px solid " + COLORS.border, color: COLORS.text, fontSize: "14px" }}>
                    {Object.keys(categoryColors).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: COLORS.muted, marginBottom: "8px" }}>🔔 Hatırlatıcı</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {reminderOptions.map(opt => (
                    <button key={opt.value} onClick={() => setForm({...form, reminder: opt.value})} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid", borderColor: form.reminder === opt.value ? COLORS.teal : COLORS.border, background: form.reminder === opt.value ? "rgba(0,180,216,0.15)" : "transparent", color: form.reminder === opt.value ? COLORS.teal : COLORS.muted, fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: COLORS.muted, marginBottom: "8px" }}>📝 Notlar</label>
                <textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} placeholder="Etkinlik hakkında notlar..." rows={4} style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", background: COLORS.surface, border: "1px solid " + COLORS.border, color: COLORS.text, fontSize: "14px", resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={createEvent} disabled={loading} style={{ flex: 1, padding: "14px", borderRadius: "12px", background: "linear-gradient(135deg,#00b4d8,#0096c7)", border: "none", color: "#000", fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>
                  {loading ? "⟳ Kaydediliyor..." : "✅ Outlook'a Kaydet"}
                </button>
                <button onClick={() => { setView("list"); resetForm(); }} style={{ padding: "14px 24px", borderRadius: "12px", background: "transparent", border: "1px solid " + COLORS.border, color: COLORS.muted, fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>İptal</button>
              </div>
            </div>
          </div>
        )}

        {view === "detail" && selectedEvent && (
          <div className="page">
            <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: COLORS.teal, fontSize: "14px", fontWeight: 600, cursor: "pointer", marginBottom: "20px", display: "flex", alignItems: "center", gap: "6px", padding: 0 }}>← Geri Dön</button>
            <div style={{ background: COLORS.card, borderRadius: "16px", padding: "28px", border: "1px solid " + COLORS.border, borderTop: `4px solid ${getCategoryColor(selectedEvent)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h2 style={{ margin: "0 0 20px", fontSize: "24px", fontWeight: 800 }}>{selectedEvent.subject}</h2>
                <span style={{ fontSize: "13px", fontWeight: 700, padding: "6px 14px", borderRadius: "20px", background: `${getCategoryColor(selectedEvent)}22`, color: getCategoryColor(selectedEvent) }}>
                  {selectedEvent.categories?.[0] || "Diğer"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                <div style={{ display: "flex", gap: "10px", color: COLORS.muted, fontSize: "14px" }}><span>🗓️</span><span>{formatDate(selectedEvent.start.dateTime)} → {formatDate(selectedEvent.end.dateTime)}</span></div>
                {selectedEvent.location?.displayName && <div style={{ display: "flex", gap: "10px", color: COLORS.muted, fontSize: "14px" }}><span>📍</span><span>{selectedEvent.location.displayName}</span></div>}
                <div style={{ display: "flex", gap: "10px", fontSize: "14px" }}><span>🔔</span><span style={{ color: COLORS.muted }}>{reminderOptions.find(r => r.value === selectedEvent.reminderMinutesBeforeStart)?.label || `${selectedEvent.reminderMinutesBeforeStart} dk önce`}</span></div>
                <div style={{ display: "flex", gap: "10px", fontSize: "14px" }}><span>⏰</span><span style={{ color: COLORS.warning, fontWeight: 600 }}>{timeUntil(selectedEvent.start.dateTime)}</span></div>
              </div>
              {selectedEvent.bodyPreview && <div style={{ padding: "16px", background: COLORS.surface, borderRadius: "10px", color: COLORS.muted, fontSize: "14px", lineHeight: 1.6, marginBottom: "24px", border: "1px solid " + COLORS.border }}>{selectedEvent.bodyPreview}</div>}
              <button onClick={() => deleteEvent(selectedEvent.id)} style={{ width: "100%", padding: "13px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: COLORS.danger, fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>
                🗑️ Etkinliği Sil
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
