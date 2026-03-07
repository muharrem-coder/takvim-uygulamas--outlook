/* eslint-disable */
import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#0f0f1a", surface: "#1a1a2e", card: "#16213e",
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
  return btoa(String.fromCharCode(...array)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
function formatDate(date) {
  return new Date(date).toLocaleString("tr-TR", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function formatDateInput(date) {
  const d = new Date(date), pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const reminderOptions = [
  {label:"5 dakika önce",value:5},{label:"15 dakika önce",value:15},
  {label:"30 dakika önce",value:30},{label:"1 saat önce",value:60},
  {label:"1 gün önce",value:1440},{label:"2 gün önce",value:2880},
];
const categoryColors = {
  "Toplantı":"#0f3460","Kişisel":"#7b2d8b","İş":"#00b4d8","Önemli":"#ef4444","Diğer":"#533483"
};

export default function App() {
  const [screen, setScreen] = useState("login"); // login | app
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const tokenRef = useRef(null);
  const initDone = useRef(false);

  const [form, setForm] = useState({
    subject:"", start:formatDateInput(new Date()),
    end:formatDateInput(new Date(Date.now()+3600000)),
    location:"", body:"", reminder:15, category:"Toplantı",
  });

  const showToast = (msg, type="success") => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3500);
  };

  // Sadece bir kez çalış
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const savedState = sessionStorage.getItem("oauth_state");
    const verifier = sessionStorage.getItem("pkce_verifier");

    if (code && state && state === savedState && verifier) {
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem("pkce_verifier");
      sessionStorage.removeItem("oauth_state");
      setAuthLoading(true);
      doTokenExchange(code, verifier);
      return;
    }

    const savedToken = sessionStorage.getItem("ms_token");
    const expiry = sessionStorage.getItem("ms_expiry");
    if (savedToken && expiry && Date.now() < parseInt(expiry)) {
      tokenRef.current = savedToken;
      setScreen("app");
      loadUser(savedToken);
      loadEvents(savedToken);
    }
  }, []);

  const doTokenExchange = async (code, verifier) => {
    try {
      const body = new URLSearchParams({
        client_id: CLIENT_ID, code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: verifier,
        scope: SCOPES,
      });
      const res = await fetch(TOKEN_URL, {
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body: body.toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        tokenRef.current = data.access_token;
        sessionStorage.setItem("ms_token", data.access_token);
        sessionStorage.setItem("ms_expiry", String(Date.now() + data.expires_in * 1000));
        if (data.refresh_token) sessionStorage.setItem("ms_refresh", data.refresh_token);
        setScreen("app");
        loadUser(data.access_token);
        loadEvents(data.access_token);
      } else {
        showToast("Giriş hatası: " + (data.error_description || "Bilinmeyen"), "error");
      }
    } catch(e) {
      showToast("Bağlantı hatası", "error");
    }
    setAuthLoading(false);
  };

  const getToken = async () => {
    const token = sessionStorage.getItem("ms_token");
    const expiry = sessionStorage.getItem("ms_expiry");
    if (token && expiry && Date.now() < parseInt(expiry) - 60000) {
      tokenRef.current = token;
      return token;
    }
    const refresh = sessionStorage.getItem("ms_refresh");
    if (!refresh) { doLogout(); return null; }
    try {
      const body = new URLSearchParams({
        client_id: CLIENT_ID, grant_type: "refresh_token",
        refresh_token: refresh, scope: SCOPES,
      });
      const res = await fetch(TOKEN_URL, {
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body: body.toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        tokenRef.current = data.access_token;
        sessionStorage.setItem("ms_token", data.access_token);
        sessionStorage.setItem("ms_expiry", String(Date.now() + data.expires_in * 1000));
        if (data.refresh_token) sessionStorage.setItem("ms_refresh", data.refresh_token);
        return data.access_token;
      }
    } catch(e) {}
    doLogout();
    return null;
  };

  const loadUser = async (token) => {
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers:{Authorization:`Bearer ${token}`}
      });
      const data = await res.json();
      setUser(data);
    } catch(e) {}
  };

  const loadEvents = async (token) => {
    setLoadingEvents(true);
    try {
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 30*24*3600000).toISOString();
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now}&endDateTime=${future}&$orderby=start/dateTime&$top=50`,
        {headers:{Authorization:`Bearer ${token}`}}
      );
      const data = await res.json();
      if (data.value) {
        setEvents(data.value);
      } else {
        showToast("Etkinlikler yüklenemedi: " + (data.error?.message || ""), "error");
      }
    } catch(e) {
      showToast("Bağlantı hatası", "error");
    }
    setLoadingEvents(false);
  };

  const handleRefresh = async () => {
    const token = await getToken();
    if (token) loadEvents(token);
  };

  const loginMicrosoft = async () => {
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("oauth_state", state);
    const url = `${AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256&response_mode=query`;
    window.location.href = url;
  };

  const loginDemo = () => {
    setDemoMode(true);
    setScreen("app");
    setUser({displayName:"Demo Kullanıcı", mail:"demo@outlook.com"});
    setEvents([
      {id:"1",subject:"Proje Toplantısı",start:{dateTime:new Date(Date.now()+3600000*2).toISOString()},end:{dateTime:new Date(Date.now()+3600000*3).toISOString()},location:{displayName:"Konferans Salonu"},bodyPreview:"Q2 hedefleri",reminderMinutesBeforeStart:15,categories:["Toplantı"]},
      {id:"2",subject:"Doktor Randevusu",start:{dateTime:new Date(Date.now()+3600000*26).toISOString()},end:{dateTime:new Date(Date.now()+3600000*27).toISOString()},location:{displayName:"Hastane"},bodyPreview:"Yıllık check-up",reminderMinutesBeforeStart:60,categories:["Kişisel"]},
    ]);
  };

  const saveEvent = async () => {
    if (!form.subject.trim()) return showToast("Başlık gerekli!", "error");

    if (demoMode) {
      const e = {id:Date.now().toString(),subject:form.subject,start:{dateTime:new Date(form.start).toISOString()},end:{dateTime:new Date(form.end).toISOString()},location:{displayName:form.location},bodyPreview:form.body,reminderMinutesBeforeStart:form.reminder,categories:[form.category]};
      setEvents(prev => [...prev, e].sort((a,b) => new Date(a.start.dateTime)-new Date(b.start.dateTime)));
      showToast("✅ Etkinlik eklendi!");
      setView("list"); resetForm(); return;
    }

    const token = await getToken();
    if (!token) return;
    setSavingEvent(true);
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method:"POST",
        headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body: JSON.stringify({
          subject: form.subject,
          start:{dateTime:new Date(form.start).toISOString(),timeZone:"Europe/Istanbul"},
          end:{dateTime:new Date(form.end).toISOString(),timeZone:"Europe/Istanbul"},
          location:{displayName:form.location},
          body:{contentType:"text",content:form.body},
          isReminderOn:true,
          reminderMinutesBeforeStart:form.reminder,
          categories:[form.category],
        })
      });
      if (res.ok) {
        const newEvent = await res.json();
        setEvents(prev => [...prev, newEvent].sort((a,b) => new Date(a.start.dateTime)-new Date(b.start.dateTime)));
        showToast("✅ Outlook'a kaydedildi!");
        setView("list");
        resetForm();
      } else {
        const err = await res.json();
        showToast("Hata: " + (err.error?.message || "Eklenemedi"), "error");
      }
    } catch(e) {
      showToast("Bağlantı hatası", "error");
    }
    setSavingEvent(false);
  };

  const removeEvent = async (id) => {
    if (demoMode) {
      setEvents(prev => prev.filter(e => e.id !== id));
      showToast("Silindi"); setView("list"); setSelected(null); return;
    }
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`https://graph.microsoft.com/v1.0/me/events/${id}`, {
        method:"DELETE", headers:{Authorization:`Bearer ${token}`}
      });
      setEvents(prev => prev.filter(e => e.id !== id));
      showToast("Etkinlik silindi");
      setView("list"); setSelected(null);
    } catch { showToast("Silinemedi","error"); }
  };

  const doLogout = () => {
    sessionStorage.clear();
    tokenRef.current = null;
    setScreen("login"); setUser(null); setEvents([]); setDemoMode(false);
  };

  const resetForm = () => setForm({
    subject:"", start:formatDateInput(new Date()),
    end:formatDateInput(new Date(Date.now()+3600000)),
    location:"", body:"", reminder:15, category:"Toplantı",
  });

  const upcoming = events.filter(e => new Date(e.start.dateTime) > Date.now() - 3600000);
  const getCatColor = (e) => categoryColors[e.categories?.[0]] || categoryColors["Diğer"];
  const timeUntil = (d) => {
    const diff = new Date(d) - Date.now();
    if (diff < 0) return "Geçti";
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
    if (h > 24) return `${Math.floor(h/24)} gün sonra`;
    if (h > 0) return `${h}s ${m}dk sonra`;
    return `${m} dk sonra`;
  };

  // LOGIN
  if (screen === "login") {
    return (
      <div style={{minHeight:"100vh",background:COLORS.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:"20px"}}>
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}.lc{animation:float 4s ease-in-out infinite}.btn:hover{filter:brightness(1.15);transform:translateY(-2px)}`}</style>
        <div className="lc" style={{background:"linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)",borderRadius:"24px",padding:"60px 50px",maxWidth:"420px",width:"100%",border:"1px solid rgba(0,180,216,0.2)",boxShadow:"0 30px 80px rgba(0,0,0,0.5)"}}>
          <div style={{textAlign:"center",marginBottom:"40px"}}>
            <div style={{fontSize:"60px",marginBottom:"16px"}}>📅</div>
            <h1 style={{color:COLORS.teal,fontSize:"28px",margin:0,fontWeight:700}}>Takvim Yöneticisi</h1>
            <p style={{color:COLORS.muted,marginTop:"8px",fontSize:"15px"}}>Outlook takviminizi kolayca yönetin</p>
          </div>
          {authLoading ? (
            <div style={{textAlign:"center",color:COLORS.muted,padding:"20px",fontSize:"16px"}}>⏳ Giriş yapılıyor...</div>
          ) : (<>
            <button className="btn" onClick={loginMicrosoft} style={{width:"100%",padding:"16px",borderRadius:"12px",background:"linear-gradient(135deg,#0078d4,#106ebe)",border:"none",color:"white",fontSize:"16px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",marginBottom:"14px",transition:"all 0.2s"}}>
              🔑 Microsoft ile Giriş Yap
            </button>
            <button className="btn" onClick={loginDemo} style={{width:"100%",padding:"16px",borderRadius:"12px",background:"linear-gradient(135deg,#7b2d8b,#533483)",border:"none",color:"white",fontSize:"16px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",transition:"all 0.2s"}}>
              🎮 Demo Olarak Dene
            </button>
          </>)}
          <p style={{color:COLORS.muted,fontSize:"12px",textAlign:"center",marginTop:"24px",lineHeight:1.6}}>Giriş yaptığınızda Outlook takviminize otomatik bağlanır.</p>
        </div>
      </div>
    );
  }

  // APP
  return (
    <div style={{minHeight:"100vh",background:COLORS.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:COLORS.text}}>
      <style>{`*{box-sizing:border-box}input,textarea,select{outline:none}input:focus,textarea:focus,select:focus{border-color:${COLORS.teal}!important;box-shadow:0 0 0 3px rgba(0,180,216,0.15)!important}.ec:hover{transform:translateX(4px);background:#1e2a45!important}@keyframes fadeIn{from{opacity:0}to{opacity:1}}.pg{animation:fadeIn 0.2s ease}@keyframes slideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}.toast{animation:slideIn 0.3s ease}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#0f3460;border-radius:3px}`}</style>

      {toast && (
        <div className="toast" style={{position:"fixed",top:"20px",right:"20px",zIndex:9999,background:toast.type==="error"?COLORS.danger:COLORS.success,color:"white",padding:"14px 20px",borderRadius:"12px",boxShadow:"0 8px 30px rgba(0,0,0,0.3)",fontWeight:600,fontSize:"14px"}}>
          {toast.msg}
        </div>
      )}

      <header style={{background:"linear-gradient(135deg,#16213e,#0f3460)",padding:"0 24px",height:"64px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(0,180,216,0.15)",position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <span style={{fontSize:"24px"}}>📅</span>
          <div>
            <div style={{fontWeight:700,fontSize:"16px",color:COLORS.teal}}>Outlook Takvim</div>
            {demoMode && <div style={{fontSize:"11px",color:COLORS.warning,fontWeight:600}}>DEMO MOD</div>}
          </div>
        </div>
        <nav style={{display:"flex",gap:"8px"}}>
          {[{id:"list",icon:"📋",label:"Etkinlikler"},{id:"add",icon:"➕",label:"Yeni Ekle"}].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)} style={{padding:"8px 16px",borderRadius:"10px",border:"none",background:view===tab.id?COLORS.teal:"rgba(255,255,255,0.05)",color:view===tab.id?"#000":COLORS.muted,fontWeight:600,fontSize:"13px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",transition:"all 0.2s"}}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"14px",fontWeight:600}}>{user?.displayName}</div>
            <div style={{fontSize:"11px",color:COLORS.muted}}>{user?.mail||user?.userPrincipalName}</div>
          </div>
          <button onClick={doLogout} style={{padding:"8px 14px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.1)",color:COLORS.danger,fontSize:"13px",fontWeight:600,cursor:"pointer"}}>Çıkış</button>
        </div>
      </header>

      <main style={{maxWidth:"800px",margin:"0 auto",padding:"24px 20px"}}>

        {view === "list" && (
          <div className="pg">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
              <div>
                <h2 style={{margin:0,fontSize:"22px",fontWeight:700}}>Yaklaşan Etkinlikler</h2>
                <p style={{margin:"4px 0 0",color:COLORS.muted,fontSize:"14px"}}>{upcoming.length} etkinlik</p>
              </div>
              {!demoMode && (
                <button onClick={handleRefresh} disabled={loadingEvents} style={{padding:"8px 16px",borderRadius:"10px",border:"1px solid rgba(0,180,216,0.3)",background:"transparent",color:COLORS.teal,fontSize:"13px",fontWeight:600,cursor:"pointer"}}>
                  {loadingEvents ? "⟳ Yükleniyor..." : "🔄 Yenile"}
                </button>
              )}
            </div>

            {loadingEvents && (
              <div style={{textAlign:"center",padding:"60px",color:COLORS.muted}}>
                <div style={{fontSize:"40px"}}>⟳</div>Yükleniyor...
              </div>
            )}

            {!loadingEvents && upcoming.length === 0 && (
              <div style={{textAlign:"center",padding:"60px",background:COLORS.card,borderRadius:"16px",border:"1px solid "+COLORS.border}}>
                <div style={{fontSize:"50px",marginBottom:"12px"}}>🗓️</div>
                <div style={{color:COLORS.muted,fontSize:"16px"}}>Yaklaşan etkinlik yok</div>
                <button onClick={() => setView("add")} style={{marginTop:"16px",padding:"10px 24px",borderRadius:"10px",background:COLORS.teal,border:"none",color:"#000",fontWeight:700,cursor:"pointer"}}>+ Etkinlik Ekle</button>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              {upcoming.map(e => (
                <div key={e.id} className="ec" onClick={() => {setSelected(e);setView("detail");}} style={{background:COLORS.card,borderRadius:"14px",padding:"18px 20px",border:"1px solid "+COLORS.border,cursor:"pointer",transition:"all 0.2s",display:"flex",gap:"16px",alignItems:"flex-start",borderLeft:`4px solid ${getCatColor(e)}`}}>
                  <div style={{minWidth:"64px",textAlign:"center",background:"rgba(0,180,216,0.08)",borderRadius:"10px",padding:"10px 8px"}}>
                    <div style={{fontSize:"11px",color:COLORS.muted,textTransform:"uppercase",letterSpacing:1}}>
                      {new Date(e.start.dateTime).toLocaleDateString("tr-TR",{month:"short"})}
                    </div>
                    <div style={{fontSize:"28px",fontWeight:800,color:COLORS.teal,lineHeight:1}}>
                      {new Date(e.start.dateTime).getDate()}
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:"16px",marginBottom:"4px"}}>{e.subject}</div>
                    <div style={{color:COLORS.muted,fontSize:"13px",marginBottom:"6px"}}>
                      🕐 {new Date(e.start.dateTime).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})} – {new Date(e.end.dateTime).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}
                      {e.location?.displayName && ` · 📍 ${e.location.displayName}`}
                    </div>
                    {e.bodyPreview && <div style={{color:COLORS.muted,fontSize:"12px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"500px"}}>{e.bodyPreview}</div>}
                  </div>
                  <div style={{textAlign:"right",minWidth:"90px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",background:`${getCatColor(e)}22`,color:getCatColor(e),marginBottom:"8px",display:"inline-block"}}>
                      {e.categories?.[0]||"Diğer"}
                    </div>
                    <div style={{fontSize:"12px",color:COLORS.warning,display:"block"}}>⏰ {timeUntil(e.start.dateTime)}</div>
                    {e.reminderMinutesBeforeStart !== undefined && <div style={{fontSize:"11px",color:COLORS.muted,marginTop:"4px"}}>🔔 {e.reminderMinutesBeforeStart}dk önce</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "add" && (
          <div className="pg">
            <h2 style={{margin:"0 0 24px",fontSize:"22px",fontWeight:700}}>➕ Yeni Etkinlik Ekle</h2>
            <div style={{background:COLORS.card,borderRadius:"16px",padding:"28px",border:"1px solid "+COLORS.border}}>
              <div style={{marginBottom:"20px"}}>
                <label style={{display:"block",fontSize:"13px",fontWeight:600,color:COLORS.muted,marginBottom:"8px"}}>📌 Başlık *</label>
                <input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Toplantı, Doktor Randevusu..." style={{width:"100%",padding:"12px 16px",borderRadius:"10px",background:COLORS.surface,border:"1px solid "+COLORS.border,color:COLORS.text,fontSize:"15px"}} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"20px"}}>
                <div>
                  <label style={{display:"block",fontSize:"13px",fontWeight:600,color:COLORS.muted,marginBottom:"8px"}}>🗓️ Başlangıç</label>
                  <input type="datetime-local" value={form.start} onChange={e=>setForm({...form,start:e.target.value})} style={{width:"100%",padding:"12px 16px",borderRadius:"10px",background:COLORS.surface,border:"1px solid "+COLORS.border,color:COLORS.text,fontSize:"14px"}} />
                </div>
                <div>
                  <label style={{display:"block",fontSize:"13px",fontWeight:600,color:COLORS.muted,marginBottom:"8px"}}>🏁 Bitiş</label>
                  <input type="datetime-local" value={form.end} onChange={e=>setForm({...form,end:e.target.value})} style={{width:"100%",padding:"12px 16px",borderRadius:"10px",background:COLORS.surface,border:"1px solid "+COLORS.border,color:COLORS.text,fontSize:"14px"}} />
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"20px"}}>
                <div>
                  <label style={{display:"block",fontSize:"13px",fontWeight:600,color:COLORS.muted,marginBottom:"8px"}}>📍 Konum</label>
                  <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Adres veya online link" style={{width:"100%",padding:"12px 16px",borderRadius:"10px",background:COLORS.surface,border:"1px solid "+COLORS.border,color:COLORS.text,fontSize:"14px"}} />
                </div>
                <div>
                  <label style={{display:"block",fontSize:"13px",fontWeight:600,color:COLORS.muted,marginBottom:"8px"}}>🏷️ Kategori</label>
                  <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{width:"100%",padding:"12px 16px",borderRadius:"10px",background:COLORS.surface,border:"1px solid "+COLORS.border,color:COLORS.text,fontSize:"14px"}}>
                    {Object.keys(categoryColors).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:"20px"}}>
                <label style={{display:"block",fontSize:"13px",fontWeight:600,color:COLORS.muted,marginBottom:"8px"}}>🔔 Hatırlatıcı</label>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  {reminderOptions.map(opt=>(
                    <button key={opt.value} onClick={()=>setForm({...form,reminder:opt.value})} style={{padding:"8px 16px",borderRadius:"8px",border:"1px solid",borderColor:form.reminder===opt.value?COLORS.teal:COLORS.border,background:form.reminder===opt.value?"rgba(0,180,216,0.15)":"transparent",color:form.reminder===opt.value?COLORS.teal:COLORS.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:"24px"}}>
                <label style={{display:"block",fontSize:"13px",fontWeight:600,color:COLORS.muted,marginBottom:"8px"}}>📝 Notlar</label>
                <textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Etkinlik hakkında notlar..." rows={4} style={{width:"100%",padding:"12px 16px",borderRadius:"10px",background:COLORS.surface,border:"1px solid "+COLORS.border,color:COLORS.text,fontSize:"14px",resize:"vertical",fontFamily:"inherit"}} />
              </div>
              <div style={{display:"flex",gap:"12px"}}>
                <button onClick={saveEvent} disabled={savingEvent} style={{flex:1,padding:"14px",borderRadius:"12px",background:"linear-gradient(135deg,#00b4d8,#0096c7)",border:"none",color:"#000",fontSize:"16px",fontWeight:700,cursor:"pointer"}}>
                  {savingEvent?"⏳ Kaydediliyor...":"✅ Outlook'a Kaydet"}
                </button>
                <button onClick={()=>{setView("list");resetForm();}} style={{padding:"14px 24px",borderRadius:"12px",background:"transparent",border:"1px solid "+COLORS.border,color:COLORS.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>İptal</button>
              </div>
            </div>
          </div>
        )}

        {view === "detail" && selected && (
          <div className="pg">
            <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:COLORS.teal,fontSize:"14px",fontWeight:600,cursor:"pointer",marginBottom:"20px",display:"flex",alignItems:"center",gap:"6px",padding:0}}>← Geri Dön</button>
            <div style={{background:COLORS.card,borderRadius:"16px",padding:"28px",border:"1px solid "+COLORS.border,borderTop:`4px solid ${getCatColor(selected)}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <h2 style={{margin:"0 0 20px",fontSize:"24px",fontWeight:800}}>{selected.subject}</h2>
                <span style={{fontSize:"13px",fontWeight:700,padding:"6px 14px",borderRadius:"20px",background:`${getCatColor(selected)}22`,color:getCatColor(selected)}}>
                  {selected.categories?.[0]||"Diğer"}
                </span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"12px",marginBottom:"24px"}}>
                <div style={{display:"flex",gap:"10px",color:COLORS.muted,fontSize:"14px"}}><span>🗓️</span><span>{formatDate(selected.start.dateTime)} → {formatDate(selected.end.dateTime)}</span></div>
                {selected.location?.displayName && <div style={{display:"flex",gap:"10px",color:COLORS.muted,fontSize:"14px"}}><span>📍</span><span>{selected.location.displayName}</span></div>}
                <div style={{display:"flex",gap:"10px",fontSize:"14px"}}><span>🔔</span><span style={{color:COLORS.muted}}>{reminderOptions.find(r=>r.value===selected.reminderMinutesBeforeStart)?.label||`${selected.reminderMinutesBeforeStart} dk önce`}</span></div>
                <div style={{display:"flex",gap:"10px",fontSize:"14px"}}><span>⏰</span><span style={{color:COLORS.warning,fontWeight:600}}>{timeUntil(selected.start.dateTime)}</span></div>
              </div>
              {selected.bodyPreview && <div style={{padding:"16px",background:COLORS.surface,borderRadius:"10px",color:COLORS.muted,fontSize:"14px",lineHeight:1.6,marginBottom:"24px",border:"1px solid "+COLORS.border}}>{selected.bodyPreview}</div>}
              <button onClick={()=>removeEvent(selected.id)} style={{width:"100%",padding:"13px",borderRadius:"12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:COLORS.danger,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>
                🗑️ Etkinliği Sil
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
