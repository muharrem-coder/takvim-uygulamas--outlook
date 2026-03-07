/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";

const THEMES = {
  dark: {
    bg: "#0f0f1a", surface: "#1a1a2e", card: "#16213e", header: "#0f3460",
    teal: "#00b4d8", text: "#e2e8f0", muted: "#94a3b8", border: "#2d3748",
    success: "#10b981", warning: "#f59e0b", danger: "#ef4444", navBg: "#16213e",
  },
  light: {
    bg: "#f0f4f8", surface: "#ffffff", card: "#ffffff", header: "#0078d4",
    teal: "#0078d4", text: "#1a202c", muted: "#718096", border: "#e2e8f0",
    success: "#10b981", warning: "#d97706", danger: "#ef4444", navBg: "#ffffff",
  }
};

const CLIENT_ID    = "774d7d5a-1c96-42e8-8ce0-41fa960bab14";
const REDIRECT_URI = window.location.origin;
const SCOPES       = "openid profile User.Read Calendars.ReadWrite";
const AUTH_URL     = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL    = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

async function genVerifier() {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function genChallenge(v) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

const toUTC   = d => d.endsWith("Z") ? d : d + "Z";
const pad     = n => String(n).padStart(2,"0");
const fmtDT   = d => new Date(toUTC(d)).toLocaleString("tr-TR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtInput= d => { const x=new Date(d); return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const fmtTime = d => new Date(toUTC(d)).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
const fmtDay  = d => new Date(toUTC(d)).toLocaleDateString("tr-TR",{weekday:"short",day:"numeric",month:"short"});
const timeUntil = d => {
  const diff = new Date(toUTC(d)) - Date.now();
  if (diff < 0) return "Geçti";
  const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
  if (h > 48) return `${Math.floor(h/24)} gün sonra`;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m} dk sonra`;
};
const isUrgent = d => { const diff = new Date(toUTC(d)) - Date.now(); return diff > 0 && diff < 3600000; };

const CAT_COLORS = {
  "Toplantı":"#0f3460","Kişisel":"#7b2d8b","İş":"#0078d4","Önemli":"#ef4444","Diğer":"#059669"
};
const REMINDERS = [
  {l:"5 dk",v:5},{l:"15 dk",v:15},{l:"30 dk",v:30},{l:"1 sa",v:60},{l:"1 gün",v:1440},{l:"2 gün",v:2880}
];

// ── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ── CALENDAR GRID ────────────────────────────────────────────────────────────
function CalendarGrid({ events, onDayClick, C }) {
  const [month, setMonth] = useState(new Date());
  const year = month.getFullYear(), mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon+1, 0).getDate();
  const today = new Date();

  const eventsByDay = {};
  events.forEach(e => {
    const d = new Date(toUTC(e.start.dateTime));
    if (d.getFullYear()===year && d.getMonth()===mon) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  });

  const cells = [];
  const startPad = (firstDay + 6) % 7;
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  return (
    <div style={{background:C.card,borderRadius:"16px",padding:"20px",border:"1px solid "+C.border}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <button onClick={()=>setMonth(new Date(year,mon-1,1))} style={{background:"none",border:"none",color:C.teal,fontSize:"22px",cursor:"pointer",padding:"4px 12px",borderRadius:"8px"}}>‹</button>
        <span style={{fontWeight:700,fontSize:"17px",color:C.text}}>
          {month.toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}
        </span>
        <button onClick={()=>setMonth(new Date(year,mon+1,1))} style={{background:"none",border:"none",color:C.teal,fontSize:"22px",cursor:"pointer",padding:"4px 12px",borderRadius:"8px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px",marginBottom:"6px"}}>
        {["Pt","Sa","Ça","Pe","Cu","Ct","Pz"].map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:"12px",fontWeight:700,color:C.muted,padding:"4px 0"}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
        {cells.map((day,i) => {
          if (!day) return <div key={`e${i}`} />;
          const isToday = day===today.getDate() && mon===today.getMonth() && year===today.getFullYear();
          const hasEvents = eventsByDay[day];
          return (
            <div key={day} onClick={()=>hasEvents && onDayClick(eventsByDay[day])} style={{
              textAlign:"center",padding:"8px 4px",borderRadius:"10px",
              cursor:hasEvents?"pointer":"default",
              background:isToday?C.teal:"transparent",
              color:isToday?"#000":C.text,
              fontWeight:isToday||hasEvents?700:400,
              fontSize:"14px",position:"relative",transition:"all 0.15s",
            }}>
              {day}
              {hasEvents && !isToday && <div style={{position:"absolute",bottom:"3px",left:"50%",transform:"translateX(-50%)",width:"5px",height:"5px",borderRadius:"50%",background:C.teal}} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── EVENT CARD ────────────────────────────────────────────────────────────────
function EventCard({ e, onClick, C }) {
  const catColor = CAT_COLORS[e.categories?.[0]] || CAT_COLORS["Diğer"];
  return (
    <div onClick={onClick} style={{background:C.card,borderRadius:"14px",padding:"16px",border:"1px solid "+C.border,cursor:"pointer",borderLeft:`4px solid ${catColor}`,transition:"all 0.15s",display:"flex",gap:"14px",alignItems:"flex-start"}}>
      <div style={{minWidth:"52px",textAlign:"center",background:`${catColor}15`,borderRadius:"10px",padding:"8px 4px"}}>
        <div style={{fontSize:"10px",color:catColor,fontWeight:700,textTransform:"uppercase"}}>
          {new Date(toUTC(e.start.dateTime)).toLocaleDateString("tr-TR",{month:"short"})}
        </div>
        <div style={{fontSize:"24px",fontWeight:800,color:catColor,lineHeight:1}}>
          {new Date(toUTC(e.start.dateTime)).getDate()}
        </div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:"15px",marginBottom:"4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</div>
        <div style={{color:C.muted,fontSize:"13px"}}>
          🕐 {fmtTime(e.start.dateTime)} – {fmtTime(e.end.dateTime)}
          {e.location?.displayName && ` · 📍 ${e.location.displayName}`}
        </div>
        {e.bodyPreview && <div style={{color:C.muted,fontSize:"12px",marginTop:"4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.bodyPreview}</div>}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",background:`${catColor}22`,color:catColor,marginBottom:"6px",display:"inline-block"}}>
          {e.categories?.[0]||"Diğer"}
        </div>
        <div style={{fontSize:"12px",fontWeight:700,color:isUrgent(e.start.dateTime)?C.danger:C.warning,display:"block"}}>
          ⏰ {timeUntil(e.start.dateTime)}
        </div>
        {e.reminderMinutesBeforeStart !== undefined && (
          <div style={{fontSize:"11px",color:C.muted,marginTop:"3px"}}>🔔 {e.reminderMinutesBeforeStart}dk</div>
        )}
      </div>
    </div>
  );
}

// ── DETAIL MODAL ──────────────────────────────────────────────────────────────
function DetailModal({ event, onClose, onDelete, C, isMobile }) {
  const catColor = CAT_COLORS[event.categories?.[0]] || CAT_COLORS["Diğer"];
  const modalStyle = isMobile
    ? {position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}
    : {position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"};
  const contentStyle = isMobile
    ? {background:C.surface,borderRadius:"20px 20px 0 0",padding:"24px",width:"100%",maxHeight:"80vh",overflowY:"auto",borderTop:`4px solid ${catColor}`}
    : {background:C.surface,borderRadius:"20px",padding:"32px",width:"100%",maxWidth:"500px",maxHeight:"80vh",overflowY:"auto",borderTop:`4px solid ${catColor}`,boxShadow:"0 25px 60px rgba(0,0,0,0.4)"};

  return (
    <div onClick={onClose} style={modalStyle}>
      <div onClick={e=>e.stopPropagation()} style={contentStyle}>
        {isMobile && <div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 20px"}} />}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}}>
          <h2 style={{margin:0,fontSize:"20px",fontWeight:800,flex:1,lineHeight:1.3}}>{event.subject}</h2>
          <span style={{fontSize:"12px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",background:`${catColor}22`,color:catColor,marginLeft:"10px"}}>
            {event.categories?.[0]||"Diğer"}
          </span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"20px"}}>
          <div style={{display:"flex",gap:"10px",fontSize:"14px",color:C.muted}}><span>🗓️</span><span>{fmtDT(event.start.dateTime)}</span></div>
          <div style={{display:"flex",gap:"10px",fontSize:"14px",color:C.muted}}><span>🏁</span><span>{fmtDT(event.end.dateTime)}</span></div>
          {event.location?.displayName && <div style={{display:"flex",gap:"10px",fontSize:"14px",color:C.muted}}><span>📍</span><span>{event.location.displayName}</span></div>}
          <div style={{display:"flex",gap:"10px",fontSize:"14px"}}><span>🔔</span><span style={{color:C.muted}}>{REMINDERS.find(r=>r.v===event.reminderMinutesBeforeStart)?.l||`${event.reminderMinutesBeforeStart}dk`} önce</span></div>
          <div style={{display:"flex",gap:"10px",fontSize:"14px"}}><span>⏰</span><span style={{color:isUrgent(event.start.dateTime)?C.danger:C.warning,fontWeight:700}}>{timeUntil(event.start.dateTime)}</span></div>
        </div>
        {event.bodyPreview && <div style={{padding:"14px",background:C.card,borderRadius:"12px",color:C.muted,fontSize:"14px",lineHeight:1.6,marginBottom:"20px"}}>{event.bodyPreview}</div>}
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:"12px",background:C.card,border:"1px solid "+C.border,color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>Kapat</button>
          <button onClick={()=>onDelete(event.id)} style={{flex:1,padding:"13px",borderRadius:"12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:C.danger,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>🗑️ Sil</button>
        </div>
      </div>
    </div>
  );
}

// ── ADD FORM ──────────────────────────────────────────────────────────────────
function AddForm({ form, setForm, onSave, onCancel, saving, C }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
      <div>
        <label style={{display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5}}>Başlık *</label>
        <input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Toplantı, Randevu..." style={{width:"100%",padding:"13px 16px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"15px"}} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        <div>
          <label style={{display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5}}>Başlangıç</label>
          <input type="datetime-local" value={form.start} onChange={e=>setForm({...form,start:e.target.value})} style={{width:"100%",padding:"12px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"13px"}} />
        </div>
        <div>
          <label style={{display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5}}>Bitiş</label>
          <input type="datetime-local" value={form.end} onChange={e=>setForm({...form,end:e.target.value})} style={{width:"100%",padding:"12px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"13px"}} />
        </div>
      </div>
      <div>
        <label style={{display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5}}>Kategori</label>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {Object.keys(CAT_COLORS).map(cat=>(
            <button key={cat} onClick={()=>setForm({...form,category:cat})} style={{padding:"8px 14px",borderRadius:"20px",border:"1px solid",borderColor:form.category===cat?CAT_COLORS[cat]:C.border,background:form.category===cat?`${CAT_COLORS[cat]}22`:"transparent",color:form.category===cat?CAT_COLORS[cat]:C.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={{display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5}}>Hatırlatıcı</label>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {REMINDERS.map(r=>(
            <button key={r.v} onClick={()=>setForm({...form,reminder:r.v})} style={{padding:"8px 14px",borderRadius:"20px",border:"1px solid",borderColor:form.reminder===r.v?C.teal:C.border,background:form.reminder===r.v?`${C.teal}22`:"transparent",color:form.reminder===r.v?C.teal:C.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
              {r.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={{display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5}}>Konum</label>
        <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Adres veya link" style={{width:"100%",padding:"13px 16px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"15px"}} />
      </div>
      <div>
        <label style={{display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5}}>Notlar</label>
        <textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Ek bilgiler..." rows={3} style={{width:"100%",padding:"13px 16px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"15px",resize:"none",fontFamily:"inherit"}} />
      </div>
      <div style={{display:"flex",gap:"12px"}}>
        {onCancel && (
          <button onClick={onCancel} style={{flex:1,padding:"14px",borderRadius:"12px",background:"transparent",border:"1px solid "+C.border,color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>İptal</button>
        )}
        <button onClick={onSave} disabled={saving} style={{flex:2,padding:"14px",borderRadius:"12px",background:`linear-gradient(135deg,${C.teal},#0096c7)`,border:"none",color:"#000",fontSize:"16px",fontWeight:700,cursor:"pointer",boxShadow:`0 4px 20px ${C.teal}44`}}>
          {saving?"⏳ Kaydediliyor...":"✅ Outlook'a Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const [themeKey, setThemeKey] = useState(()=>localStorage.getItem("theme")||"dark");
  const C = THEMES[themeKey];
  const toggleTheme = () => { const t=themeKey==="dark"?"light":"dark"; setThemeKey(t); localStorage.setItem("theme",t); };

  const [screen, setScreen]     = useState("login");
  const [tab, setTab]           = useState("list");
  const [user, setUser]         = useState(null);
  const [events, setEvents]     = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [selected, setSelected] = useState(null);
  const [dayEvents, setDayEvents] = useState(null);
  const [toast, setToast]       = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [notifPerm, setNotifPerm] = useState(typeof Notification!=="undefined"?Notification.permission:"denied");
  const [showAddPanel, setShowAddPanel] = useState(false); // desktop side panel
  const initDone = useRef(false);

  const [form, setForm] = useState({
    subject:"",start:fmtInput(new Date()),end:fmtInput(new Date(Date.now()+3600000)),
    location:"",body:"",reminder:15,category:"Toplantı",
  });

  const showToast = useCallback((msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); },[]);

  useEffect(()=>{ if("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(()=>{}); },[]);

  useEffect(()=>{
    if(initDone.current) return; initDone.current=true;
    const params=new URLSearchParams(window.location.search);
    const code=params.get("code"), state=params.get("state");
    const savedState=sessionStorage.getItem("oauth_state"), verifier=sessionStorage.getItem("pkce_verifier");
    if(code&&state&&state===savedState&&verifier){
      window.history.replaceState({},document.title,window.location.pathname);
      sessionStorage.removeItem("pkce_verifier"); sessionStorage.removeItem("oauth_state");
      setAuthLoading(true); doTokenExchange(code,verifier); return;
    }
    const savedToken=sessionStorage.getItem("ms_token"), expiry=sessionStorage.getItem("ms_expiry");
    if(savedToken&&expiry&&Date.now()<parseInt(expiry)){ setScreen("app"); loadUser(savedToken); loadEvents(savedToken); }
  },[]);

  useEffect(()=>{
    if(notifPerm!=="granted"||events.length===0) return;
    const timers=events.map(e=>{
      const reminderMs=(e.reminderMinutesBeforeStart||15)*60000;
      const delay=new Date(toUTC(e.start.dateTime)).getTime()-reminderMs-Date.now();
      if(delay>0&&delay<24*3600000) return setTimeout(()=>new Notification(`⏰ ${e.subject}`,{body:`${fmtTime(e.start.dateTime)} • ${e.location?.displayName||""}`,icon:"/logo192.png"}),delay);
      return null;
    }).filter(Boolean);
    return ()=>timers.forEach(clearTimeout);
  },[events,notifPerm]);

  const doTokenExchange=async(code,verifier)=>{
    try{
      const body=new URLSearchParams({client_id:CLIENT_ID,code,redirect_uri:REDIRECT_URI,grant_type:"authorization_code",code_verifier:verifier,scope:SCOPES});
      const res=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});
      const data=await res.json();
      if(data.access_token){
        sessionStorage.setItem("ms_token",data.access_token);
        sessionStorage.setItem("ms_expiry",String(Date.now()+data.expires_in*1000));
        if(data.refresh_token) sessionStorage.setItem("ms_refresh",data.refresh_token);
        setScreen("app"); loadUser(data.access_token); loadEvents(data.access_token);
      } else showToast("Giriş hatası: "+(data.error_description||""),"error");
    } catch { showToast("Bağlantı hatası","error"); }
    setAuthLoading(false);
  };

  const getToken=async()=>{
    const token=sessionStorage.getItem("ms_token"), expiry=sessionStorage.getItem("ms_expiry");
    if(token&&expiry&&Date.now()<parseInt(expiry)-60000) return token;
    const refresh=sessionStorage.getItem("ms_refresh");
    if(!refresh){ doLogout(); return null; }
    try{
      const body=new URLSearchParams({client_id:CLIENT_ID,grant_type:"refresh_token",refresh_token:refresh,scope:SCOPES});
      const res=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});
      const data=await res.json();
      if(data.access_token){
        sessionStorage.setItem("ms_token",data.access_token);
        sessionStorage.setItem("ms_expiry",String(Date.now()+data.expires_in*1000));
        if(data.refresh_token) sessionStorage.setItem("ms_refresh",data.refresh_token);
        return data.access_token;
      }
    } catch {}
    doLogout(); return null;
  };

  const loadUser=async(token)=>{ try{ const res=await fetch("https://graph.microsoft.com/v1.0/me",{headers:{Authorization:`Bearer ${token}`}}); setUser(await res.json()); } catch {} };
  const loadEvents=async(token)=>{
    setLoadingEvents(true);
    try{
      const now=new Date().toISOString(), future=new Date(Date.now()+60*24*3600000).toISOString();
      const res=await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now}&endDateTime=${future}&$orderby=start/dateTime&$top=50`,{headers:{Authorization:`Bearer ${token}`}});
      const data=await res.json();
      if(data.value) setEvents(data.value);
      else showToast("Yüklenemedi","error");
    } catch { showToast("Bağlantı hatası","error"); }
    setLoadingEvents(false);
  };

  const loginMicrosoft=async()=>{
    const verifier=await genVerifier(), challenge=await genChallenge(verifier), state=Math.random().toString(36).substring(2);
    sessionStorage.setItem("pkce_verifier",verifier); sessionStorage.setItem("oauth_state",state);
    window.location.href=`${AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256&response_mode=query`;
  };

  const loginDemo=()=>{
    setDemoMode(true); setScreen("app");
    setUser({displayName:"Demo Kullanıcı",mail:"demo@outlook.com"});
    const now=Date.now();
    setEvents([
      {id:"1",subject:"Proje Toplantısı",start:{dateTime:new Date(now+3600000*2).toISOString()},end:{dateTime:new Date(now+3600000*3).toISOString()},location:{displayName:"Zoom"},bodyPreview:"Q2 hedefleri tartışılacak",reminderMinutesBeforeStart:15,categories:["Toplantı"]},
      {id:"2",subject:"Doktor Randevusu",start:{dateTime:new Date(now+3600000*26).toISOString()},end:{dateTime:new Date(now+3600000*27).toISOString()},location:{displayName:"Acıbadem Hastanesi"},bodyPreview:"Yıllık check-up",reminderMinutesBeforeStart:60,categories:["Kişisel"]},
      {id:"3",subject:"Sprint Review",start:{dateTime:new Date(now+3600000*50).toISOString()},end:{dateTime:new Date(now+3600000*52).toISOString()},location:{displayName:"Konferans Salonu"},bodyPreview:"Sprint 14 değerlendirmesi",reminderMinutesBeforeStart:30,categories:["İş"]},
      {id:"4",subject:"Aile Yemeği",start:{dateTime:new Date(now+3600000*75).toISOString()},end:{dateTime:new Date(now+3600000*77).toISOString()},location:{displayName:"Ev"},bodyPreview:"Hafta sonu yemeği",reminderMinutesBeforeStart:60,categories:["Kişisel"]},
    ]);
  };

  const saveEvent=async()=>{
    if(!form.subject.trim()) return showToast("Başlık gerekli!","error");
    if(demoMode){
      const e={id:Date.now().toString(),subject:form.subject,start:{dateTime:new Date(form.start).toISOString()},end:{dateTime:new Date(form.end).toISOString()},location:{displayName:form.location},bodyPreview:form.body,reminderMinutesBeforeStart:form.reminder,categories:[form.category]};
      setEvents(prev=>[...prev,e].sort((a,b)=>new Date(toUTC(a.start.dateTime))-new Date(toUTC(b.start.dateTime))));
      showToast("✅ Eklendi!"); resetForm();
      if(isMobile) setTab("list"); else setShowAddPanel(false);
      return;
    }
    const token=await getToken(); if(!token) return;
    setSaving(true);
    try{
      const res=await fetch("https://graph.microsoft.com/v1.0/me/events",{
        method:"POST",
        headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify({subject:form.subject,start:{dateTime:new Date(form.start).toISOString(),timeZone:"Europe/Istanbul"},end:{dateTime:new Date(form.end).toISOString(),timeZone:"Europe/Istanbul"},location:{displayName:form.location},body:{contentType:"text",content:form.body},isReminderOn:true,reminderMinutesBeforeStart:form.reminder,categories:[form.category]})
      });
      if(res.ok){
        const newEvent=await res.json();
        setEvents(prev=>[...prev,newEvent].sort((a,b)=>new Date(toUTC(a.start.dateTime))-new Date(toUTC(b.start.dateTime))));
        showToast("✅ Outlook'a kaydedildi!"); resetForm();
        if(isMobile) setTab("list"); else setShowAddPanel(false);
      } else {
        const err=await res.json(); showToast("Hata: "+(err.error?.message||"Eklenemedi"),"error");
      }
    } catch { showToast("Bağlantı hatası","error"); }
    setSaving(false);
  };

  const deleteEvent=async(id)=>{
    if(demoMode){ setEvents(prev=>prev.filter(e=>e.id!==id)); showToast("Silindi"); setSelected(null); return; }
    const token=await getToken(); if(!token) return;
    try{
      await fetch(`https://graph.microsoft.com/v1.0/me/events/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
      setEvents(prev=>prev.filter(e=>e.id!==id)); showToast("Silindi"); setSelected(null);
    } catch { showToast("Silinemedi","error"); }
  };

  const doLogout=()=>{ sessionStorage.clear(); setScreen("login"); setUser(null); setEvents([]); setDemoMode(false); };
  const resetForm=()=>setForm({subject:"",start:fmtInput(new Date()),end:fmtInput(new Date(Date.now()+3600000)),location:"",body:"",reminder:15,category:"Toplantı"});
  const upcoming=events.filter(e=>new Date(toUTC(e.start.dateTime))>Date.now()-3600000);

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if(screen==="login"){
    return(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:"24px"}}>
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}.lc{animation:float 4s ease-in-out infinite}.btn:active{transform:scale(0.97)}`}</style>
        <div className="lc" style={{width:"100%",maxWidth:"400px"}}>
          <div style={{textAlign:"center",marginBottom:"36px"}}>
            <div style={{fontSize:"72px",marginBottom:"8px"}}>📅</div>
            <h1 style={{color:C.teal,fontSize:"28px",margin:0,fontWeight:800}}>Takvim Yöneticisi</h1>
            <p style={{color:C.muted,marginTop:"8px",fontSize:"15px"}}>Outlook takviminizi her yerden yönetin</p>
          </div>
          <div style={{background:C.surface,borderRadius:"20px",padding:"32px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:"1px solid "+C.border}}>
            {authLoading?(
              <div style={{textAlign:"center",padding:"24px",color:C.muted}}>
                <div style={{fontSize:"32px",marginBottom:"8px"}}>⏳</div>Giriş yapılıyor...
              </div>
            ):(<>
              <button className="btn" onClick={loginMicrosoft} style={{width:"100%",padding:"16px",borderRadius:"14px",background:"linear-gradient(135deg,#0078d4,#106ebe)",border:"none",color:"white",fontSize:"16px",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",marginBottom:"12px",boxShadow:"0 4px 20px rgba(0,120,212,0.3)",transition:"all 0.2s"}}>
                🔑 Microsoft ile Giriş Yap
              </button>
              <button className="btn" onClick={loginDemo} style={{width:"100%",padding:"16px",borderRadius:"14px",background:"linear-gradient(135deg,#7b2d8b,#533483)",border:"none",color:"white",fontSize:"16px",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",boxShadow:"0 4px 20px rgba(123,45,139,0.3)",transition:"all 0.2s"}}>
                🎮 Demo Olarak Dene
              </button>
            </>)}
          </div>
          <p style={{color:C.muted,fontSize:"12px",textAlign:"center",marginTop:"20px",lineHeight:1.6}}>📱 Telefonda ana ekrana ekleyerek uygulama gibi kullanabilirsiniz</p>
        </div>
      </div>
    );
  }

  // ── APP ────────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:C.text}}>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input,textarea,select{outline:none;-webkit-appearance:none}
        input:focus,textarea:focus,select:focus{border-color:${C.teal}!important;box-shadow:0 0 0 3px ${C.teal}22!important}
        .ec:hover{background:#1e2a45!important;transform:translateX(2px)}
        .ec:active{opacity:0.8}
        .navbtn:hover{background:${C.teal}22!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        .pg{animation:fadeUp 0.2s ease}
        .toast{animation:slideDown 0.3s ease}
        select option{background:${C.surface};color:${C.text}}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>

      {/* Toast */}
      {toast&&(
        <div className="toast" style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="error"?C.danger:C.success,color:"white",padding:"12px 24px",borderRadius:"12px",boxShadow:"0 8px 30px rgba(0,0,0,0.3)",fontWeight:600,fontSize:"14px",whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {selected&&<DetailModal event={selected} onClose={()=>setSelected(null)} onDelete={(id)=>{deleteEvent(id);}} C={C} isMobile={isMobile} />}
      {dayEvents&&(
        <div onClick={()=>setDayEvents(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:isMobile?"20px 20px 0 0":"20px",padding:"24px",width:"100%",maxWidth:isMobile?"100%":"460px",maxHeight:"70vh",overflowY:"auto"}}>
            {isMobile&&<div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 16px"}} />}
            <h3 style={{margin:"0 0 16px",fontSize:"16px",fontWeight:700}}>{fmtDay(dayEvents[0].start.dateTime)} etkinlikleri</h3>
            {dayEvents.map(e=>(
              <div key={e.id} onClick={()=>{setDayEvents(null);setSelected(e);}} style={{padding:"14px",background:C.card,borderRadius:"12px",marginBottom:"10px",borderLeft:`3px solid ${CAT_COLORS[e.categories?.[0]]||CAT_COLORS["Diğer"]}`,cursor:"pointer"}}>
                <div style={{fontWeight:700}}>{e.subject}</div>
                <div style={{color:C.muted,fontSize:"13px",marginTop:"4px"}}>🕐 {fmtTime(e.start.dateTime)} – {fmtTime(e.end.dateTime)}</div>
              </div>
            ))}
            <button onClick={()=>setDayEvents(null)} style={{width:"100%",padding:"13px",borderRadius:"12px",background:C.card,border:"1px solid "+C.border,color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer",marginTop:"8px"}}>Kapat</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{background:C.header,padding:"0 24px",height:"60px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <span style={{fontSize:"24px"}}>📅</span>
          <div>
            <div style={{fontWeight:700,fontSize:"16px",color:"white"}}>Outlook Takvim</div>
            <div style={{fontSize:"11px",color:"rgba(255,255,255,0.7)"}}>{demoMode?"Demo Mod":(user?.displayName||"")}</div>
          </div>
        </div>

        {/* Desktop Nav */}
        {!isMobile&&(
          <nav style={{display:"flex",gap:"4px"}}>
            {[{id:"list",icon:"📋",label:"Etkinlikler"},{id:"calendar",icon:"🗓️",label:"Takvim"}].map(t=>(
              <button key={t.id} className="navbtn" onClick={()=>setTab(t.id)} style={{padding:"8px 18px",borderRadius:"10px",border:"none",background:tab===t.id?"rgba(255,255,255,0.2)":"transparent",color:"white",fontWeight:600,fontSize:"14px",cursor:"pointer",transition:"all 0.2s"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        )}

        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          {notifPerm!=="granted"&&!demoMode&&(
            <button onClick={async()=>{ const p=await Notification.requestPermission(); setNotifPerm(p); if(p==="granted")showToast("🔔 Bildirimler açıldı!"); }} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"10px",padding:"8px 12px",color:"white",fontSize:"13px",cursor:"pointer",fontWeight:600}}>
              🔔 Bildirim
            </button>
          )}
          <button onClick={toggleTheme} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"10px",padding:"8px 12px",color:"white",fontSize:"16px",cursor:"pointer"}}>
            {themeKey==="dark"?"☀️":"🌙"}
          </button>
          {!isMobile&&(
            <button onClick={()=>setShowAddPanel(!showAddPanel)} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"10px",padding:"8px 16px",color:"white",fontSize:"14px",fontWeight:700,cursor:"pointer"}}>
              ➕ Yeni Ekle
            </button>
          )}
          <button onClick={doLogout} style={{background:"rgba(239,68,68,0.2)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:"10px",padding:"8px 12px",color:"#fca5a5",fontSize:"13px",cursor:"pointer",fontWeight:600}}>
            Çıkış
          </button>
        </div>
      </header>

      {/* DESKTOP LAYOUT */}
      {!isMobile ? (
        <div style={{display:"flex",gap:"0",minHeight:"calc(100vh - 60px)"}}>

          {/* Main Content */}
          <div style={{flex:1,padding:"28px",overflowY:"auto"}}>

            {tab==="list"&&(
              <div className="pg">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
                  <div>
                    <h2 style={{margin:0,fontSize:"24px",fontWeight:700}}>Yaklaşan Etkinlikler</h2>
                    <p style={{margin:"4px 0 0",color:C.muted,fontSize:"14px"}}>{upcoming.length} etkinlik · önümüzdeki 60 gün</p>
                  </div>
                  {!demoMode&&(
                    <button onClick={async()=>{const t=await getToken();if(t)loadEvents(t);}} disabled={loadingEvents} style={{padding:"10px 20px",borderRadius:"10px",border:"1px solid "+C.border,background:C.surface,color:C.teal,fontSize:"14px",fontWeight:700,cursor:"pointer"}}>
                      {loadingEvents?"⟳ Yükleniyor...":"🔄 Yenile"}
                    </button>
                  )}
                </div>
                {loadingEvents&&<div style={{textAlign:"center",padding:"60px",color:C.muted}}><div style={{fontSize:"40px"}}>⟳</div>Yükleniyor...</div>}
                {!loadingEvents&&upcoming.length===0&&(
                  <div style={{textAlign:"center",padding:"80px",background:C.card,borderRadius:"16px",border:"1px solid "+C.border}}>
                    <div style={{fontSize:"56px",marginBottom:"16px"}}>🗓️</div>
                    <div style={{color:C.muted,fontSize:"18px",marginBottom:"20px"}}>Yaklaşan etkinlik yok</div>
                    <button onClick={()=>setShowAddPanel(true)} style={{padding:"12px 32px",borderRadius:"12px",background:C.teal,border:"none",color:"#000",fontWeight:700,cursor:"pointer",fontSize:"16px"}}>+ Etkinlik Ekle</button>
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(520px,1fr))",gap:"12px"}}>
                  {upcoming.map(e=><EventCard key={e.id} e={e} onClick={()=>setSelected(e)} C={C} />)}
                </div>
              </div>
            )}

            {tab==="calendar"&&(
              <div className="pg">
                <h2 style={{margin:"0 0 20px",fontSize:"24px",fontWeight:700}}>Takvim Görünümü</h2>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px"}}>
                  <CalendarGrid events={events} onDayClick={setDayEvents} C={C} />
                  <div>
                    <div style={{fontWeight:600,fontSize:"14px",color:C.muted,marginBottom:"12px",textTransform:"uppercase",letterSpacing:0.5}}>Yaklaşan Etkinlikler</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                      {upcoming.slice(0,8).map(e=>(
                        <div key={e.id} onClick={()=>setSelected(e)} style={{display:"flex",gap:"12px",padding:"12px 14px",background:C.card,borderRadius:"12px",cursor:"pointer",border:"1px solid "+C.border,borderLeft:`3px solid ${CAT_COLORS[e.categories?.[0]]||CAT_COLORS["Diğer"]}`,transition:"all 0.15s"}}>
                          <div style={{minWidth:"40px",textAlign:"center"}}>
                            <div style={{fontSize:"10px",color:C.muted,textTransform:"uppercase"}}>{new Date(toUTC(e.start.dateTime)).toLocaleDateString("tr-TR",{month:"short"})}</div>
                            <div style={{fontSize:"20px",fontWeight:800,color:C.teal,lineHeight:1}}>{new Date(toUTC(e.start.dateTime)).getDate()}</div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:"14px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</div>
                            <div style={{color:C.muted,fontSize:"12px",marginTop:"2px"}}>{fmtTime(e.start.dateTime)} • {e.location?.displayName||""}</div>
                          </div>
                          <div style={{fontSize:"12px",fontWeight:700,color:C.warning,alignSelf:"center"}}>{timeUntil(e.start.dateTime)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Add Panel (right side) */}
          {showAddPanel&&(
            <div style={{width:"380px",background:C.surface,borderLeft:"1px solid "+C.border,padding:"28px",overflowY:"auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
                <h3 style={{margin:0,fontSize:"18px",fontWeight:700}}>➕ Yeni Etkinlik</h3>
                <button onClick={()=>setShowAddPanel(false)} style={{background:"none",border:"none",color:C.muted,fontSize:"20px",cursor:"pointer"}}>✕</button>
              </div>
              <AddForm form={form} setForm={setForm} onSave={saveEvent} onCancel={()=>setShowAddPanel(false)} saving={saving} C={C} />
            </div>
          )}
        </div>
      ) : (
        /* MOBILE LAYOUT */
        <div style={{paddingBottom:"70px"}}>
          <div style={{padding:"16px",overflowY:"auto"}}>
            {tab==="list"&&(
              <div className="pg">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:"18px"}}>Etkinlikler</div>
                    <div style={{fontSize:"13px",color:C.muted}}>{upcoming.length} yaklaşan</div>
                  </div>
                  {!demoMode&&(
                    <button onClick={async()=>{const t=await getToken();if(t)loadEvents(t);}} disabled={loadingEvents} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"8px 14px",color:C.teal,fontSize:"13px",fontWeight:700,cursor:"pointer"}}>
                      {loadingEvents?"⟳":"🔄"} Yenile
                    </button>
                  )}
                </div>
                {loadingEvents&&<div style={{textAlign:"center",padding:"50px",color:C.muted}}><div style={{fontSize:"36px"}}>⟳</div>Yükleniyor...</div>}
                {!loadingEvents&&upcoming.length===0&&(
                  <div style={{textAlign:"center",padding:"50px 20px",background:C.card,borderRadius:"16px",border:"1px solid "+C.border}}>
                    <div style={{fontSize:"48px",marginBottom:"12px"}}>🗓️</div>
                    <div style={{color:C.muted,marginBottom:"16px"}}>Yaklaşan etkinlik yok</div>
                    <button onClick={()=>setTab("add")} style={{padding:"12px 28px",borderRadius:"12px",background:C.teal,border:"none",color:"#000",fontWeight:700,cursor:"pointer",fontSize:"15px"}}>+ Ekle</button>
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {upcoming.map(e=><EventCard key={e.id} e={e} onClick={()=>setSelected(e)} C={C} />)}
                </div>
              </div>
            )}
            {tab==="calendar"&&(
              <div className="pg">
                <div style={{fontWeight:700,fontSize:"18px",marginBottom:"16px"}}>Takvim</div>
                <CalendarGrid events={events} onDayClick={setDayEvents} C={C} />
                <div style={{marginTop:"20px"}}>
                  <div style={{fontWeight:600,fontSize:"13px",color:C.muted,marginBottom:"10px",textTransform:"uppercase",letterSpacing:0.5}}>Yaklaşan</div>
                  {upcoming.slice(0,5).map(e=>(
                    <div key={e.id} onClick={()=>setSelected(e)} style={{display:"flex",gap:"12px",padding:"12px",background:C.card,borderRadius:"12px",marginBottom:"8px",cursor:"pointer",border:"1px solid "+C.border,borderLeft:`3px solid ${CAT_COLORS[e.categories?.[0]]||CAT_COLORS["Diğer"]}`}}>
                      <div style={{textAlign:"center",minWidth:"40px"}}>
                        <div style={{fontSize:"10px",color:C.muted,textTransform:"uppercase"}}>{new Date(toUTC(e.start.dateTime)).toLocaleDateString("tr-TR",{month:"short"})}</div>
                        <div style={{fontSize:"20px",fontWeight:800,color:C.teal,lineHeight:1}}>{new Date(toUTC(e.start.dateTime)).getDate()}</div>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:"14px"}}>{e.subject}</div>
                        <div style={{color:C.muted,fontSize:"12px",marginTop:"2px"}}>{fmtTime(e.start.dateTime)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab==="add"&&(
              <div className="pg">
                <div style={{fontWeight:700,fontSize:"18px",marginBottom:"16px"}}>➕ Yeni Etkinlik</div>
                <AddForm form={form} setForm={setForm} onSave={saveEvent} saving={saving} C={C} />
              </div>
            )}
          </div>

          {/* Mobile Bottom Nav */}
          <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.navBg,borderTop:"1px solid "+C.border,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -4px 20px rgba(0,0,0,0.15)"}}>
            {[{id:"list",icon:"📋",label:"Etkinlikler"},{id:"calendar",icon:"🗓️",label:"Takvim"},{id:"add",icon:"➕",label:"Ekle"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
                <span style={{fontSize:t.id==="add"?"24px":"20px",filter:tab===t.id?"none":"grayscale(0.4) opacity(0.5)"}}>{t.icon}</span>
                <span style={{fontSize:"11px",fontWeight:600,color:tab===t.id?C.teal:C.muted}}>{t.label}</span>
                {tab===t.id&&<div style={{width:"20px",height:"3px",background:C.teal,borderRadius:"2px"}} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
