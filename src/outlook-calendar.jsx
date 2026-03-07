/* eslint-disable */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const MS_CLIENT_ID    = "774d7d5a-1c96-42e8-8ce0-41fa960bab14";
const GOOGLE_CLIENT_ID = "923407886232-76tom5gvm5b7cnrdeonknc5mjb63vv7i.apps.googleusercontent.com";
const REDIRECT_URI    = window.location.origin;
const MS_SCOPES       = "openid profile User.Read Calendars.ReadWrite";
const MS_AUTH_URL     = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL    = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GG_SCOPES       = "https://www.googleapis.com/auth/calendar";
const GG_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth";

// ── THEMES ────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:"#080812", surface:"#12122a", card:"#1a1a35", header:"#0d0d24",
    teal:"#00d4ff", accent:"#7c3aed", text:"#f0f0ff", muted:"#7878a0",
    border:"#25254a", success:"#00e5a0", warning:"#ffb020", danger:"#ff4466",
    navBg:"#12122a", tag:"#1e1e40",
    gradient:"linear-gradient(135deg,#7c3aed,#00d4ff)",
    ms:"linear-gradient(135deg,#0078d4,#106ebe)",
    google:"linear-gradient(135deg,#ea4335,#fbbc04,#34a853,#4285f4)",
    googleSolid:"linear-gradient(135deg,#4285f4,#34a853)",
  },
  light: {
    bg:"#f5f5ff", surface:"#ffffff", card:"#ffffff", header:"#6d28d9",
    teal:"#6d28d9", accent:"#06b6d4", text:"#1a1a2e", muted:"#6b7280",
    border:"#e5e7eb", success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
    navBg:"#ffffff", tag:"#f3f4f6",
    gradient:"linear-gradient(135deg,#6d28d9,#06b6d4)",
    ms:"linear-gradient(135deg,#0078d4,#106ebe)",
    google:"linear-gradient(135deg,#ea4335,#fbbc04,#34a853,#4285f4)",
    googleSolid:"linear-gradient(135deg,#4285f4,#34a853)",
  }
};

const CAT_COLORS = {
  "Toplantı": { bg:"#1e3a5f", text:"#60a5fa", dot:"#3b82f6" },
  "Kişisel":  { bg:"#3b1f5e", text:"#c084fc", dot:"#a855f7" },
  "İş":       { bg:"#1e4d3b", text:"#34d399", dot:"#10b981" },
  "Önemli":   { bg:"#5c1c1c", text:"#fca5a5", dot:"#ef4444" },
  "Diğer":    { bg:"#1e3a2e", text:"#6ee7b7", dot:"#059669" },
};
const getCat = e => CAT_COLORS[e.categories?.[0] || e._category] || CAT_COLORS["Diğer"];
const REMINDERS = [{l:"5 dk",v:5},{l:"15 dk",v:15},{l:"30 dk",v:30},{l:"1 sa",v:60},{l:"1 gün",v:1440},{l:"2 gün",v:2880}];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const toUTC    = d => !d ? "" : d.endsWith("Z") ? d : d + "Z";
const pad      = n => String(n).padStart(2,"0");
const fmtDT    = d => new Date(toUTC(d)).toLocaleString("tr-TR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtInput = d => { const x=new Date(d); return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const fmtTime  = d => new Date(toUTC(d)).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
const fmtShort = d => new Date(toUTC(d)).toLocaleDateString("tr-TR",{weekday:"short",day:"numeric",month:"short"});
const timeUntil = d => {
  const diff = new Date(toUTC(d)) - Date.now();
  if (diff < 0) return "Geçti";
  const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
  if (h > 48) return `${Math.floor(h/24)} gün`;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m} dk`;
};
const isUrgent = d => { const diff = new Date(toUTC(d)) - Date.now(); return diff > 0 && diff < 3600000; };
const isPast   = d => new Date(toUTC(d)) < Date.now();
const getStartDT = e => e.start?.dateTime || e.start?.date || "";
const getEndDT   = e => e.end?.dateTime   || e.end?.date   || "";

// Normalize event from either source into unified format
function normalizeEvent(e, source) {
  if (source === "google") {
    const startDT = e.start?.dateTime || (e.start?.date ? e.start.date + "T00:00:00Z" : "");
    const endDT   = e.end?.dateTime   || (e.end?.date   ? e.end.date   + "T00:00:00Z" : "");
    return {
      ...e,
      _id: "g_" + e.id,
      _source: "google",
      _raw: e,
      subject: e.summary || "(Başlıksız)",
      start: { dateTime: startDT },
      end:   { dateTime: endDT },
      location: { displayName: e.location || "" },
      bodyPreview: e.description || "",
      categories: e.colorId ? [] : [],
      _category: "Diğer",
      reminderMinutesBeforeStart: e.reminders?.overrides?.[0]?.minutes || 15,
      attendees: (e.attendees||[]).map(a=>({ emailAddress:{ address:a.email, name:a.displayName||a.email }, status:{ response: a.responseStatus==="accepted"?"accepted":a.responseStatus==="declined"?"declined":"none" } })),
    };
  }
  return { ...e, _id: "m_" + e.id, _source: "outlook", _raw: e, subject: e.subject || "(Başlıksız)", _category: e.categories?.[0] || "Diğer" };
}

// ── PKCE ──────────────────────────────────────────────────────────────────────
async function genVerifier() {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function genChallenge(v) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(()=>{ const h=()=>setM(window.innerWidth<768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);
  return m;
}

// ── SOURCE BADGE ──────────────────────────────────────────────────────────────
function SourceBadge({ source, small }) {
  const size = small ? "10px" : "11px";
  const pad  = small ? "2px 6px" : "3px 8px";
  if (source === "google") return <span style={{fontSize:size,fontWeight:700,padding:pad,borderRadius:"20px",background:"rgba(66,133,244,0.2)",color:"#4285f4",border:"1px solid rgba(66,133,244,0.3)",flexShrink:0}}>G Calendar</span>;
  return <span style={{fontSize:size,fontWeight:700,padding:pad,borderRadius:"20px",background:"rgba(0,120,212,0.2)",color:"#0078d4",border:"1px solid rgba(0,120,212,0.3)",flexShrink:0}}>Outlook</span>;
}

// ── CALENDAR GRID ─────────────────────────────────────────────────────────────
function CalendarGrid({ events, onDayClick, C }) {
  const [month, setMonth] = useState(new Date());
  const y=month.getFullYear(), m=month.getMonth();
  const firstDay=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate(), today=new Date();
  const byDay={};
  events.forEach(e=>{
    const d=new Date(toUTC(getStartDT(e)));
    if(d.getFullYear()===y&&d.getMonth()===m){ if(!byDay[d.getDate()])byDay[d.getDate()]=[];byDay[d.getDate()].push(e); }
  });
  const cells=[];
  for(let i=0;i<(firstDay+6)%7;i++) cells.push(null);
  for(let i=1;i<=days;i++) cells.push(i);
  return (
    <div style={{background:C.card,borderRadius:"20px",padding:"20px",border:"1px solid "+C.border}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <button onClick={()=>setMonth(new Date(y,m-1,1))} style={{background:C.tag,border:"none",color:C.teal,fontSize:"18px",cursor:"pointer",padding:"6px 12px",borderRadius:"10px"}}>‹</button>
        <span style={{fontWeight:700,fontSize:"16px",color:C.text}}>{month.toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</span>
        <button onClick={()=>setMonth(new Date(y,m+1,1))} style={{background:C.tag,border:"none",color:C.teal,fontSize:"18px",cursor:"pointer",padding:"6px 12px",borderRadius:"10px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px",marginBottom:"6px"}}>
        {["Pt","Sa","Ça","Pe","Cu","Ct","Pz"].map(d=><div key={d} style={{textAlign:"center",fontSize:"11px",fontWeight:700,color:C.muted,padding:"4px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={`e${i}`}/>;
          const isToday=day===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
          const evs=byDay[day];
          return (
            <div key={day} onClick={()=>evs&&onDayClick(evs)} style={{textAlign:"center",padding:"8px 2px",borderRadius:"10px",cursor:evs?"pointer":"default",background:isToday?C.teal:"transparent",color:isToday?"#000":C.text,fontWeight:isToday||evs?700:400,fontSize:"14px",position:"relative",transition:"all 0.15s"}}>
              {day}
              {evs&&!isToday&&(
                <div style={{display:"flex",gap:"2px",justifyContent:"center",marginTop:"2px"}}>
                  {evs.slice(0,3).map((e,j)=><div key={j} style={{width:"4px",height:"4px",borderRadius:"50%",background:e._source==="google"?"#4285f4":"#0078d4"}}/>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{display:"flex",gap:"12px",marginTop:"14px",paddingTop:"14px",borderTop:"1px solid "+C.border,justifyContent:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"12px",color:C.muted}}><div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#0078d4"}}/> Outlook</div>
        <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"12px",color:C.muted}}><div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#4285f4"}}/> Google</div>
      </div>
    </div>
  );
}

// ── STATS BAR ─────────────────────────────────────────────────────────────────
function StatsBar({ events, msConnected, googleConnected, C }) {
  const upcoming=events.filter(e=>!isPast(getEndDT(e)));
  const todayEvs=events.filter(e=>{ const d=new Date(toUTC(getStartDT(e))),n=new Date(); return d.getDate()===n.getDate()&&d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); });
  const msCount=events.filter(e=>e._source==="outlook").length;
  const ggCount=events.filter(e=>e._source==="google").length;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"20px"}}>
      {[
        {label:"Toplam",value:upcoming.length,icon:"📋",color:C.teal},
        {label:"Bugün",value:todayEvs.length,icon:"📅",color:C.warning},
        {label:"Outlook",value:msConnected?msCount:"—",icon:"📘",color:"#0078d4"},
        {label:"Google",value:googleConnected?ggCount:"—",icon:"📗",color:"#34a853"},
      ].map(s=>(
        <div key={s.label} style={{background:C.card,borderRadius:"14px",padding:"12px",border:"1px solid "+C.border,textAlign:"center"}}>
          <div style={{fontSize:"18px",marginBottom:"3px"}}>{s.icon}</div>
          <div style={{fontSize:"22px",fontWeight:800,color:s.color}}>{s.value}</div>
          <div style={{fontSize:"11px",color:C.muted,fontWeight:600}}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── EVENT CARD ────────────────────────────────────────────────────────────────
function EventCard({ e, onClick, C }) {
  const cat=getCat(e), past=isPast(getEndDT(e)), urgent=isUrgent(getStartDT(e));
  const startDT=getStartDT(e);
  return (
    <div onClick={onClick} className="ec" style={{background:C.card,borderRadius:"16px",padding:"14px 16px",border:`1px solid ${urgent?"rgba(255,68,102,0.4)":C.border}`,cursor:"pointer",transition:"all 0.18s",opacity:past?0.5:1,display:"flex",gap:"12px",alignItems:"flex-start"}}>
      <div style={{minWidth:"48px",textAlign:"center",background:cat.bg,borderRadius:"12px",padding:"7px 4px",flexShrink:0}}>
        <div style={{fontSize:"9px",color:cat.text,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{new Date(toUTC(startDT)).toLocaleDateString("tr-TR",{month:"short"})}</div>
        <div style={{fontSize:"21px",fontWeight:800,color:cat.text,lineHeight:1.1}}>{new Date(toUTC(startDT)).getDate()}</div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px",flexWrap:"wrap"}}>
          <span style={{fontWeight:700,fontSize:"14px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{e.subject}</span>
          <SourceBadge source={e._source} small/>
        </div>
        <div style={{color:C.muted,fontSize:"12px",marginBottom:"3px"}}>🕐 {fmtTime(startDT)} – {fmtTime(getEndDT(e))}{e.location?.displayName?` · 📍${e.location.displayName}`:""}</div>
        {e.bodyPreview&&<div style={{color:C.muted,fontSize:"11px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.bodyPreview}</div>}
        {e.attendees?.length>0&&<div style={{fontSize:"11px",color:C.muted,marginTop:"3px"}}>👥 {e.attendees.length} katılımcı</div>}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontSize:"11px",fontWeight:700,color:urgent?C.danger:past?"#555":C.warning}}>{urgent?"🔴 ":""}{timeUntil(startDT)}</div>
      </div>
    </div>
  );
}

// ── DETAIL MODAL ──────────────────────────────────────────────────────────────
function DetailModal({ event, onClose, onDelete, C, isMobile }) {
  const cat=getCat(event);
  const startDT=getStartDT(event), endDT=getEndDT(event);
  const wrap=isMobile?{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end"}:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"};
  const box=isMobile?{background:C.surface,borderRadius:"24px 24px 0 0",padding:"24px",width:"100%",maxHeight:"85vh",overflowY:"auto"}:{background:C.surface,borderRadius:"24px",padding:"32px",width:"100%",maxWidth:"520px",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.5)"};
  return (
    <div onClick={onClose} style={wrap}>
      <div onClick={e=>e.stopPropagation()} style={box}>
        {isMobile&&<div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 20px"}}/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"8px",flexWrap:"wrap"}}>
              <span style={{fontSize:"12px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",background:cat.bg,color:cat.text}}>{event.categories?.[0]||event._category||"Diğer"}</span>
              <SourceBadge source={event._source}/>
            </div>
            <h2 style={{margin:0,fontSize:"20px",fontWeight:800,lineHeight:1.3}}>{event.subject}</h2>
          </div>
          {!isMobile&&<button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:"22px",cursor:"pointer",marginLeft:"12px"}}>✕</button>}
        </div>
        <div style={{background:C.tag,borderRadius:"16px",padding:"16px",marginBottom:"16px",display:"flex",flexDirection:"column",gap:"10px"}}>
          <div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>🗓️</span><span style={{color:C.text}}>{fmtDT(startDT)}</span></div>
          <div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>🏁</span><span style={{color:C.text}}>{fmtDT(endDT)}</span></div>
          {event.location?.displayName&&<div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>📍</span><span style={{color:C.text}}>{event.location.displayName}</span></div>}
          <div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>⏰</span><span style={{color:isUrgent(startDT)?C.danger:C.warning,fontWeight:700}}>{timeUntil(startDT)}</span></div>
        </div>
        {event.attendees?.length>0&&(
          <div style={{marginBottom:"16px"}}>
            <div style={{fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"10px",textTransform:"uppercase",letterSpacing:0.5}}>Katılımcılar ({event.attendees.length})</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {event.attendees.map((a,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",background:C.tag,borderRadius:"12px"}}>
                  <div style={{width:"30px",height:"30px",borderRadius:"50%",background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:700,color:C.teal,flexShrink:0}}>
                    {(a.emailAddress?.name||a.emailAddress?.address||"?")[0].toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"13px",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.emailAddress?.name||a.emailAddress?.address}</div>
                    {a.emailAddress?.name&&<div style={{fontSize:"11px",color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.emailAddress?.address}</div>}
                  </div>
                  <span style={{fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",background:a.status?.response==="accepted"?"rgba(0,229,160,0.15)":a.status?.response==="declined"?"rgba(255,68,102,0.15)":"rgba(120,120,160,0.15)",color:a.status?.response==="accepted"?C.success:a.status?.response==="declined"?C.danger:C.muted,flexShrink:0}}>
                    {a.status?.response==="accepted"?"✓ Kabul":a.status?.response==="declined"?"✗ Ret":"Bekliyor"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {event.bodyPreview&&<div style={{padding:"14px",background:C.tag,borderRadius:"12px",color:C.muted,fontSize:"14px",lineHeight:1.6,marginBottom:"20px"}}>{event.bodyPreview}</div>}
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:"12px",background:C.tag,border:"none",color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>Kapat</button>
          <button onClick={()=>onDelete(event)} style={{flex:1,padding:"13px",borderRadius:"12px",background:"rgba(255,68,102,0.1)",border:"1px solid rgba(255,68,102,0.3)",color:C.danger,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>🗑️ Sil</button>
        </div>
      </div>
    </div>
  );
}

// ── ADD FORM ──────────────────────────────────────────────────────────────────
function AddForm({ form, setForm, onSave, onCancel, saving, C, msConnected, googleConnected }) {
  const [attendeeInput, setAttendeeInput] = useState("");
  const addAttendee = () => {
    const email=attendeeInput.trim();
    if(!email||!email.includes("@")) return;
    if(form.attendees?.some(a=>a.emailAddress.address===email)) return;
    setForm({...form,attendees:[...(form.attendees||[]),{emailAddress:{address:email,name:email}}]});
    setAttendeeInput("");
  };
  const removeAttendee = email => setForm({...form,attendees:(form.attendees||[]).filter(a=>a.emailAddress.address!==email)});
  const inp = {width:"100%",padding:"13px 16px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"15px",transition:"all 0.2s"};
  const lbl = {display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5};
  const bothConnected = msConnected && googleConnected;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>

      {/* Target Calendar Selector */}
      {bothConnected && (
        <div>
          <label style={lbl}>📅 Hangi Takvime Kaydet?</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <button onClick={()=>setForm({...form,target:"outlook"})} style={{padding:"14px",borderRadius:"14px",border:"2px solid",borderColor:form.target==="outlook"?"#0078d4":C.border,background:form.target==="outlook"?"rgba(0,120,212,0.12)":"transparent",cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{fontSize:"20px",marginBottom:"4px"}}>📘</div>
              <div style={{fontSize:"13px",fontWeight:700,color:form.target==="outlook"?"#0078d4":C.muted}}>Outlook</div>
              <div style={{fontSize:"11px",color:C.muted,marginTop:"2px"}}>Microsoft 365</div>
            </button>
            <button onClick={()=>setForm({...form,target:"google"})} style={{padding:"14px",borderRadius:"14px",border:"2px solid",borderColor:form.target==="google"?"#4285f4":C.border,background:form.target==="google"?"rgba(66,133,244,0.12)":"transparent",cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{fontSize:"20px",marginBottom:"4px"}}>📗</div>
              <div style={{fontSize:"13px",fontWeight:700,color:form.target==="google"?"#4285f4":C.muted}}>Google</div>
              <div style={{fontSize:"11px",color:C.muted,marginTop:"2px"}}>Google Calendar</div>
            </button>
          </div>
        </div>
      )}
      {!bothConnected && (
        <div style={{padding:"12px 16px",background:C.tag,borderRadius:"12px",fontSize:"13px",color:C.muted}}>
          📅 Kaydedilecek takvim: <strong style={{color:C.text}}>{msConnected?"Outlook":"Google Calendar"}</strong>
        </div>
      )}

      <div>
        <label style={lbl}>📌 Başlık *</label>
        <input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Toplantı, Randevu..." style={inp}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        <div>
          <label style={lbl}>🗓️ Başlangıç</label>
          <input type="datetime-local" value={form.start} onChange={e=>setForm({...form,start:e.target.value})} style={{...inp,fontSize:"13px",padding:"12px"}}/>
        </div>
        <div>
          <label style={lbl}>🏁 Bitiş</label>
          <input type="datetime-local" value={form.end} onChange={e=>setForm({...form,end:e.target.value})} style={{...inp,fontSize:"13px",padding:"12px"}}/>
        </div>
      </div>
      <div>
        <label style={lbl}>🏷️ Kategori</label>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {Object.keys(CAT_COLORS).map(cat=>(
            <button key={cat} onClick={()=>setForm({...form,category:cat})} style={{padding:"8px 14px",borderRadius:"20px",border:"1px solid",borderColor:form.category===cat?CAT_COLORS[cat].dot:C.border,background:form.category===cat?CAT_COLORS[cat].bg:"transparent",color:form.category===cat?CAT_COLORS[cat].text:C.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={lbl}>🔔 Hatırlatıcı</label>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {REMINDERS.map(r=>(
            <button key={r.v} onClick={()=>setForm({...form,reminder:r.v})} style={{padding:"8px 14px",borderRadius:"20px",border:"1px solid",borderColor:form.reminder===r.v?C.teal:C.border,background:form.reminder===r.v?C.teal+"22":"transparent",color:form.reminder===r.v?C.teal:C.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
              {r.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={lbl}>📍 Konum</label>
        <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Adres veya link" style={inp}/>
      </div>
      <div>
        <label style={lbl}>👥 Davet Gönder</label>
        <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
          <input value={attendeeInput} onChange={e=>setAttendeeInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addAttendee()} placeholder="ornek@email.com" type="email" style={{...inp,flex:1}}/>
          <button onClick={addAttendee} style={{padding:"13px 18px",borderRadius:"12px",background:C.teal,border:"none",color:"#000",fontWeight:700,cursor:"pointer",flexShrink:0}}>Ekle</button>
        </div>
        {(form.attendees||[]).length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {form.attendees.map(a=>(
              <div key={a.emailAddress.address} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",background:C.tag,borderRadius:"12px"}}>
                <div style={{width:"28px",height:"28px",borderRadius:"50%",background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:700,color:C.teal,flexShrink:0}}>{a.emailAddress.address[0].toUpperCase()}</div>
                <span style={{flex:1,fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.emailAddress.address}</span>
                <button onClick={()=>removeAttendee(a.emailAddress.address)} style={{background:"none",border:"none",color:C.muted,fontSize:"18px",cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label style={lbl}>📝 Notlar</label>
        <textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Ek bilgiler..." rows={3} style={{...inp,resize:"none",fontFamily:"inherit"}}/>
      </div>
      <div style={{display:"flex",gap:"12px"}}>
        {onCancel&&<button onClick={onCancel} style={{flex:1,padding:"14px",borderRadius:"14px",background:"transparent",border:"1px solid "+C.border,color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>İptal</button>}
        <button onClick={onSave} disabled={saving} style={{flex:2,padding:"14px",borderRadius:"14px",background:C.gradient,border:"none",color:"white",fontSize:"16px",fontWeight:700,cursor:"pointer",boxShadow:`0 4px 20px ${C.teal}33`}}>
          {saving?"⏳ Kaydediliyor...":"✅ Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ── ACCOUNT PANEL ─────────────────────────────────────────────────────────────
function AccountPanel({ msUser, googleUser, onConnectMs, onConnectGoogle, onDisconnectMs, onDisconnectGoogle, C, isMobile, onClose }) {
  const wrap = isMobile
    ? {position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end"}
    : {position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"};
  const box = isMobile
    ? {background:C.surface,borderRadius:"24px 24px 0 0",padding:"24px",width:"100%",maxHeight:"85vh",overflowY:"auto"}
    : {background:C.surface,borderRadius:"24px",padding:"32px",width:"100%",maxWidth:"460px",boxShadow:"0 30px 80px rgba(0,0,0,0.5)"};
  return (
    <div onClick={onClose} style={wrap}>
      <div onClick={e=>e.stopPropagation()} style={box}>
        {isMobile&&<div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 20px"}}/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <h3 style={{margin:0,fontSize:"20px",fontWeight:700}}>🔗 Hesap Bağlantıları</h3>
          {!isMobile&&<button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:"22px",cursor:"pointer"}}>✕</button>}
        </div>

        {/* Outlook */}
        <div style={{background:C.card,borderRadius:"16px",padding:"20px",marginBottom:"14px",border:"1px solid "+C.border}}>
          <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
            <div style={{width:"44px",height:"44px",borderRadius:"12px",background:"rgba(0,120,212,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",flexShrink:0}}>📘</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:"16px"}}>Microsoft Outlook</div>
              {msUser ? (
                <div style={{fontSize:"13px",color:C.muted,marginTop:"2px"}}>{msUser.displayName} · {msUser.mail||msUser.userPrincipalName}</div>
              ) : (
                <div style={{fontSize:"13px",color:C.muted,marginTop:"2px"}}>Bağlı değil</div>
              )}
            </div>
            {msUser ? (
              <button onClick={onDisconnectMs} style={{padding:"8px 14px",borderRadius:"10px",background:"rgba(255,68,102,0.1)",border:"1px solid rgba(255,68,102,0.3)",color:C.danger,fontSize:"13px",fontWeight:600,cursor:"pointer",flexShrink:0}}>Çıkış</button>
            ) : (
              <button onClick={onConnectMs} style={{padding:"8px 14px",borderRadius:"10px",background:"rgba(0,120,212,0.2)",border:"1px solid rgba(0,120,212,0.4)",color:"#0078d4",fontSize:"13px",fontWeight:600,cursor:"pointer",flexShrink:0}}>Bağlan</button>
            )}
          </div>
        </div>

        {/* Google */}
        <div style={{background:C.card,borderRadius:"16px",padding:"20px",marginBottom:"24px",border:"1px solid "+C.border}}>
          <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
            <div style={{width:"44px",height:"44px",borderRadius:"12px",background:"rgba(66,133,244,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",flexShrink:0}}>📗</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:"16px"}}>Google Calendar</div>
              {googleUser ? (
                <div style={{fontSize:"13px",color:C.muted,marginTop:"2px"}}>{googleUser.name} · {googleUser.email}</div>
              ) : (
                <div style={{fontSize:"13px",color:C.muted,marginTop:"2px"}}>Bağlı değil</div>
              )}
            </div>
            {googleUser ? (
              <button onClick={onDisconnectGoogle} style={{padding:"8px 14px",borderRadius:"10px",background:"rgba(255,68,102,0.1)",border:"1px solid rgba(255,68,102,0.3)",color:C.danger,fontSize:"13px",fontWeight:600,cursor:"pointer",flexShrink:0}}>Çıkış</button>
            ) : (
              <button onClick={onConnectGoogle} style={{padding:"8px 14px",borderRadius:"10px",background:"rgba(66,133,244,0.2)",border:"1px solid rgba(66,133,244,0.4)",color:"#4285f4",fontSize:"13px",fontWeight:600,cursor:"pointer",flexShrink:0}}>Bağlan</button>
            )}
          </div>
        </div>

        <button onClick={onClose} style={{width:"100%",padding:"14px",borderRadius:"14px",background:C.tag,border:"none",color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>Kapat</button>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const [themeKey, setThemeKey] = useState(()=>localStorage.getItem("theme")||"dark");
  const C = THEMES[themeKey];
  const toggleTheme = ()=>{ const t=themeKey==="dark"?"light":"dark"; setThemeKey(t); localStorage.setItem("theme",t); };

  // Auth states
  const [msUser,  setMsUser]  = useState(null);
  const [ggUser,  setGgUser]  = useState(null);

  // Events
  const [msEvents, setMsEvents]   = useState([]);
  const [ggEvents, setGgEvents]   = useState([]);
  const [loadingMs, setLoadingMs] = useState(false);
  const [loadingGg, setLoadingGg] = useState(false);

  // UI
  const [screen,        setScreen]        = useState("login");
  const [tab,           setTab]           = useState("list");
  const [selected,      setSelected]      = useState(null);
  const [dayEvents,     setDayEvents]     = useState(null);
  const [toast,         setToast]         = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [showAddPanel,  setShowAddPanel]  = useState(false);
  const [showAccounts,  setShowAccounts]  = useState(false);
  const [search,        setSearch]        = useState("");
  const [activeFilter,  setActiveFilter]  = useState("all");
  const [demoMode,      setDemoMode]      = useState(false);
  const [notifPerm,     setNotifPerm]     = useState(typeof Notification!=="undefined"?Notification.permission:"denied");
  const initDone = useRef(false);

  const [form, setForm] = useState({
    subject:"", start:fmtInput(new Date()), end:fmtInput(new Date(Date.now()+3600000)),
    location:"", body:"", reminder:15, category:"Toplantı", attendees:[],
    target: "outlook"
  });

  const showToast = useCallback((msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); },[]);

  // All events merged & normalized
  const allEvents = useMemo(()=>{
    const ms = msEvents.map(e=>normalizeEvent(e,"outlook"));
    const gg = ggEvents.map(e=>normalizeEvent(e,"google"));
    return [...ms,...gg].sort((a,b)=>new Date(toUTC(getStartDT(a)))-new Date(toUTC(getStartDT(b))));
  },[msEvents,ggEvents]);

  const filteredEvents = useMemo(()=>{
    let evs = allEvents.filter(e=>new Date(toUTC(getStartDT(e)))>Date.now()-3600000);
    if(search) evs=evs.filter(e=>
      e.subject?.toLowerCase().includes(search.toLowerCase())||
      e.location?.displayName?.toLowerCase().includes(search.toLowerCase())||
      e.bodyPreview?.toLowerCase().includes(search.toLowerCase())
    );
    if(activeFilter==="outlook")  evs=evs.filter(e=>e._source==="outlook");
    else if(activeFilter==="google") evs=evs.filter(e=>e._source==="google");
    else if(activeFilter==="urgent") evs=evs.filter(e=>isUrgent(getStartDT(e)));
    else if(activeFilter==="today") evs=evs.filter(e=>{ const d=new Date(toUTC(getStartDT(e))),n=new Date(); return d.getDate()===n.getDate()&&d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); });
    return evs;
  },[allEvents,search,activeFilter]);

  // ── Init ──
  useEffect(()=>{
    if(initDone.current) return; initDone.current=true;
    const params=new URLSearchParams(window.location.search);
    const code=params.get("code"), state=params.get("state"), scope=params.get("scope")||"";

    // Google callback (scope contains google)
    if(code && state && state===sessionStorage.getItem("oauth_state") && scope.includes("googleapis")) {
      window.history.replaceState({},document.title,window.location.pathname);
      sessionStorage.removeItem("oauth_state");
      handleGoogleCode(code);
      // Restore MS session if any
      const msToken=sessionStorage.getItem("ms_token"), msExpiry=sessionStorage.getItem("ms_expiry");
      if(msToken&&msExpiry&&Date.now()<parseInt(msExpiry)){ loadMsUser(msToken); loadMsEvents(msToken); }
      setScreen("app"); return;
    }

    // MS callback
    const verifier=sessionStorage.getItem("pkce_verifier");
    if(code && state && state===sessionStorage.getItem("oauth_state") && verifier) {
      window.history.replaceState({},document.title,window.location.pathname);
      sessionStorage.removeItem("pkce_verifier"); sessionStorage.removeItem("oauth_state");
      doMsTokenExchange(code,verifier);
      // Restore Google session if any
      const ggToken=sessionStorage.getItem("gg_token"), ggExpiry=sessionStorage.getItem("gg_expiry");
      if(ggToken&&ggExpiry&&Date.now()<parseInt(ggExpiry)){ loadGgUser(ggToken); loadGgEvents(ggToken); }
      return;
    }

    // Restore sessions
    const msToken=sessionStorage.getItem("ms_token"), msExpiry=sessionStorage.getItem("ms_expiry");
    const ggToken=sessionStorage.getItem("gg_token"), ggExpiry=sessionStorage.getItem("gg_expiry");
    let hasSession=false;
    if(msToken&&msExpiry&&Date.now()<parseInt(msExpiry)){ loadMsUser(msToken); loadMsEvents(msToken); hasSession=true; }
    if(ggToken&&ggExpiry&&Date.now()<parseInt(ggExpiry)){ loadGgUser(ggToken); loadGgEvents(ggToken); hasSession=true; }
    if(hasSession) setScreen("app");
  },[]);

  // Notification timers
  useEffect(()=>{
    if(notifPerm!=="granted"||allEvents.length===0) return;
    const timers=allEvents.map(e=>{
      const delay=new Date(toUTC(getStartDT(e))).getTime()-(e.reminderMinutesBeforeStart||15)*60000-Date.now();
      if(delay>0&&delay<24*3600000) return setTimeout(()=>new Notification(`⏰ ${e.subject}`,{body:fmtTime(getStartDT(e)),icon:"/logo192.png"}),delay);
      return null;
    }).filter(Boolean);
    return()=>timers.forEach(clearTimeout);
  },[allEvents,notifPerm]);

  // Set default target when connections change
  useEffect(()=>{
    if(!msUser && ggUser) setForm(f=>({...f,target:"google"}));
    else setForm(f=>({...f,target:"outlook"}));
  },[msUser,ggUser]);

  // ── MS Auth ────────────────────────────────────────────────────────────────
  const loginMs = async()=>{
    const v=await genVerifier(), c=await genChallenge(v), s=Math.random().toString(36).substring(2);
    sessionStorage.setItem("pkce_verifier",v); sessionStorage.setItem("oauth_state",s);
    window.location.href=`${MS_AUTH_URL}?client_id=${MS_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(MS_SCOPES)}&state=${s}&code_challenge=${c}&code_challenge_method=S256&response_mode=query`;
  };
  const doMsTokenExchange=async(code,verifier)=>{
    try{
      const body=new URLSearchParams({client_id:MS_CLIENT_ID,code,redirect_uri:REDIRECT_URI,grant_type:"authorization_code",code_verifier:verifier,scope:MS_SCOPES});
      const res=await fetch(MS_TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});
      const data=await res.json();
      if(data.access_token){
        sessionStorage.setItem("ms_token",data.access_token);
        sessionStorage.setItem("ms_expiry",String(Date.now()+data.expires_in*1000));
        if(data.refresh_token) sessionStorage.setItem("ms_refresh",data.refresh_token);
        loadMsUser(data.access_token); loadMsEvents(data.access_token); setScreen("app");
      } else showToast("Outlook giriş hatası","error");
    } catch { showToast("Bağlantı hatası","error"); }
  };
  const getMsToken=async()=>{
    const t=sessionStorage.getItem("ms_token"), ex=sessionStorage.getItem("ms_expiry");
    if(t&&ex&&Date.now()<parseInt(ex)-60000) return t;
    const ref=sessionStorage.getItem("ms_refresh"); if(!ref){ disconnectMs(); return null; }
    try{
      const body=new URLSearchParams({client_id:MS_CLIENT_ID,grant_type:"refresh_token",refresh_token:ref,scope:MS_SCOPES});
      const res=await fetch(MS_TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});
      const data=await res.json();
      if(data.access_token){ sessionStorage.setItem("ms_token",data.access_token); sessionStorage.setItem("ms_expiry",String(Date.now()+data.expires_in*1000)); if(data.refresh_token)sessionStorage.setItem("ms_refresh",data.refresh_token); return data.access_token; }
    } catch {}
    disconnectMs(); return null;
  };
  const loadMsUser=async(token)=>{ try{ const r=await fetch("https://graph.microsoft.com/v1.0/me",{headers:{Authorization:`Bearer ${token}`}}); setMsUser(await r.json()); } catch {} };
  const loadMsEvents=async(token)=>{
    setLoadingMs(true);
    try{
      const now=new Date().toISOString(), future=new Date(Date.now()+60*24*3600000).toISOString();
      const r=await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now}&endDateTime=${future}&$orderby=start/dateTime&$top=50`,{headers:{Authorization:`Bearer ${token}`}});
      const data=await r.json();
      if(data.value) setMsEvents(data.value);
    } catch { showToast("Outlook yüklenemedi","error"); }
    setLoadingMs(false);
  };
  const disconnectMs=()=>{ ["ms_token","ms_expiry","ms_refresh"].forEach(k=>sessionStorage.removeItem(k)); setMsUser(null); setMsEvents([]); };

  // ── Google Auth ────────────────────────────────────────────────────────────
  const loginGoogle=()=>{
    const s=Math.random().toString(36).substring(2);
    sessionStorage.setItem("oauth_state",s);
    const params=new URLSearchParams({ client_id:GOOGLE_CLIENT_ID, redirect_uri:REDIRECT_URI, response_type:"token", scope:GG_SCOPES+" https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email", state:s, prompt:"select_account" });
    window.location.href=`${GG_AUTH_URL}?${params}`;
  };
  const handleGoogleCode=async(code)=>{
    // This is for implicit flow — token comes in hash
  };

  // Google uses implicit flow (token in URL hash)
  useEffect(()=>{
    const hash=window.location.hash;
    if(!hash.includes("access_token")) return;
    const params=new URLSearchParams(hash.substring(1));
    const token=params.get("access_token"), expiresIn=params.get("expires_in"), state=params.get("state");
    if(!token) return;
    if(state && state!==sessionStorage.getItem("oauth_state")) return;
    sessionStorage.removeItem("oauth_state");
    window.history.replaceState({},document.title,window.location.pathname);
    sessionStorage.setItem("gg_token",token);
    sessionStorage.setItem("gg_expiry",String(Date.now()+parseInt(expiresIn||3600)*1000));
    loadGgUser(token); loadGgEvents(token); setScreen("app");
  },[]);

  const getGgToken=()=>{
    const t=sessionStorage.getItem("gg_token"), ex=sessionStorage.getItem("gg_expiry");
    if(t&&ex&&Date.now()<parseInt(ex)-60000) return t;
    disconnectGoogle(); return null;
  };
  const loadGgUser=async(token)=>{ try{ const r=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{Authorization:`Bearer ${token}`}}); setGgUser(await r.json()); } catch {} };
  const loadGgEvents=async(token)=>{
    setLoadingGg(true);
    try{
      const now=new Date().toISOString(), future=new Date(Date.now()+60*24*3600000).toISOString();
      const r=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&orderBy=startTime&singleEvents=true&maxResults=50`,{headers:{Authorization:`Bearer ${token}`}});
      const data=await r.json();
      if(data.items) setGgEvents(data.items);
    } catch { showToast("Google Calendar yüklenemedi","error"); }
    setLoadingGg(false);
  };
  const disconnectGoogle=()=>{ ["gg_token","gg_expiry"].forEach(k=>sessionStorage.removeItem(k)); setGgUser(null); setGgEvents([]); };

  // ── Save Event ─────────────────────────────────────────────────────────────
  const saveEvent=async()=>{
    if(!form.subject.trim()) return showToast("Başlık gerekli!","error");
    const target = (msUser&&ggUser) ? form.target : msUser ? "outlook" : "google";

    if(demoMode){
      const e={id:Date.now().toString(),summary:form.subject,subject:form.subject,start:{dateTime:new Date(form.start).toISOString()},end:{dateTime:new Date(form.end).toISOString()},location:{displayName:form.location},description:form.body,bodyPreview:form.body,reminderMinutesBeforeStart:form.reminder,categories:[form.category],attendees:form.attendees||[]};
      if(target==="google") setGgEvents(prev=>[...prev,e]);
      else setMsEvents(prev=>[...prev,e]);
      showToast(`✅ ${target==="google"?"Google Calendar":"Outlook"}'a eklendi!`);
      resetForm(); if(isMobile) setTab("list"); else setShowAddPanel(false); return;
    }

    setSaving(true);
    if(target==="outlook"){
      const token=await getMsToken(); if(!token){ setSaving(false); return; }
      try{
        const body={subject:form.subject,start:{dateTime:new Date(form.start).toISOString(),timeZone:"Europe/Istanbul"},end:{dateTime:new Date(form.end).toISOString(),timeZone:"Europe/Istanbul"},location:{displayName:form.location},body:{contentType:"text",content:form.body},isReminderOn:true,reminderMinutesBeforeStart:form.reminder,categories:[form.category]};
        if(form.attendees?.length) body.attendees=form.attendees.map(a=>({...a,type:"required"}));
        const res=await fetch("https://graph.microsoft.com/v1.0/me/events",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
        if(res.ok){ const ev=await res.json(); setMsEvents(prev=>[...prev,ev]); showToast("✅ Outlook'a kaydedildi!"); resetForm(); if(isMobile)setTab("list"); else setShowAddPanel(false); }
        else { const err=await res.json(); showToast("Hata: "+(err.error?.message||""),"error"); }
      } catch { showToast("Bağlantı hatası","error"); }
    } else {
      const token=getGgToken(); if(!token){ showToast("Google oturumu doldu, yeniden giriş yapın","error"); setSaving(false); return; }
      try{
        const body={summary:form.subject,start:{dateTime:new Date(form.start).toISOString(),timeZone:"Europe/Istanbul"},end:{dateTime:new Date(form.end).toISOString(),timeZone:"Europe/Istanbul"},location:form.location,description:form.body,reminders:{useDefault:false,overrides:[{method:"popup",minutes:form.reminder}]}};
        if(form.attendees?.length) body.attendees=form.attendees.map(a=>({email:a.emailAddress.address,displayName:a.emailAddress.name}));
        const res=await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
        if(res.ok){ const ev=await res.json(); setGgEvents(prev=>[...prev,ev]); showToast("✅ Google Calendar'a kaydedildi!"); resetForm(); if(isMobile)setTab("list"); else setShowAddPanel(false); }
        else { const err=await res.json(); showToast("Hata: "+(err.error?.message||""),"error"); }
      } catch { showToast("Bağlantı hatası","error"); }
    }
    setSaving(false);
  };

  // ── Delete Event ───────────────────────────────────────────────────────────
  const deleteEvent=async(event)=>{
    const rawId = event._raw?.id || event.id;
    if(demoMode){ if(event._source==="google")setGgEvents(p=>p.filter(e=>e.id!==rawId)); else setMsEvents(p=>p.filter(e=>e.id!==rawId)); showToast("Silindi"); setSelected(null); return; }
    if(event._source==="outlook"){
      const token=await getMsToken(); if(!token) return;
      try{ await fetch(`https://graph.microsoft.com/v1.0/me/events/${rawId}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}}); setMsEvents(p=>p.filter(e=>e.id!==rawId)); showToast("Outlook'tan silindi"); setSelected(null); } catch { showToast("Silinemedi","error"); }
    } else {
      const token=getGgToken(); if(!token) return;
      try{ await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${rawId}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}}); setGgEvents(p=>p.filter(e=>e.id!==rawId)); showToast("Google Calendar'dan silindi"); setSelected(null); } catch { showToast("Silinemedi","error"); }
    }
  };

  const loginDemo=()=>{
    setDemoMode(true); setScreen("app");
    setMsUser({displayName:"Demo (Outlook)",mail:"demo@outlook.com"});
    setGgUser({name:"Demo (Google)",email:"demo@gmail.com"});
    const now=Date.now();
    setMsEvents([
      {id:"m1",subject:"Proje Toplantısı",start:{dateTime:new Date(now+3600000*2).toISOString()},end:{dateTime:new Date(now+3600000*3).toISOString()},location:{displayName:"Zoom"},bodyPreview:"Q2 hedefleri",reminderMinutesBeforeStart:15,categories:["Toplantı"],attendees:[{emailAddress:{address:"ali@test.com",name:"Ali"},status:{response:"accepted"}}]},
      {id:"m2",subject:"Performans Görüşmesi",start:{dateTime:new Date(now+3600000*50).toISOString()},end:{dateTime:new Date(now+3600000*51).toISOString()},location:{displayName:"İK Ofisi"},bodyPreview:"Yıllık değerlendirme",reminderMinutesBeforeStart:1440,categories:["Önemli"],attendees:[]},
    ]);
    setGgEvents([
      {id:"g1",summary:"Doktor Randevusu",start:{dateTime:new Date(now+3600000*26).toISOString()},end:{dateTime:new Date(now+3600000*27).toISOString()},location:"Acıbadem Hastanesi",description:"Yıllık check-up",reminders:{overrides:[{minutes:60}]},attendees:[]},
      {id:"g2",summary:"Aile Yemeği",start:{dateTime:new Date(now+3600000*75).toISOString()},end:{dateTime:new Date(now+3600000*77).toISOString()},location:"Ev",description:"Hafta sonu yemeği",reminders:{overrides:[{minutes:60}]},attendees:[]},
      {id:"g3",summary:"Spor Salonu",start:{dateTime:new Date(now+3600000*30).toISOString()},end:{dateTime:new Date(now+3600000*31).toISOString()},location:"FitLife Gym",description:"Cardio + ağırlık",reminders:{overrides:[{minutes:30}]},attendees:[]},
    ]);
  };

  const resetForm=()=>setForm({subject:"",start:fmtInput(new Date()),end:fmtInput(new Date(Date.now()+3600000)),location:"",body:"",reminder:15,category:"Toplantı",attendees:[],target:msUser?"outlook":"google"});
  const loading = loadingMs || loadingGg;
  const msConnected = !!msUser;
  const ggConnected = !!ggUser;
  const hasAnyAccount = msConnected || ggConnected;
  const upcoming = allEvents.filter(e=>!isPast(getEndDT(e)));

  // ── LOGIN SCREEN ───────────────────────────────────────────────────────────
  if(screen==="login"){
    return(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:"24px"}}>
        <style>{`
          @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
          .lc{animation:float 4s ease-in-out infinite}
          .lbtn{transition:all 0.2s;cursor:pointer}
          .lbtn:hover{transform:translateY(-2px)}
        `}</style>
        <div className="lc" style={{width:"100%",maxWidth:"420px"}}>
          <div style={{textAlign:"center",marginBottom:"32px"}}>
            <div style={{fontSize:"72px",marginBottom:"8px",filter:"drop-shadow(0 0 24px rgba(0,212,255,0.4))"}}>📅</div>
            <h1 style={{background:C.gradient,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:"28px",margin:0,fontWeight:800}}>Evrensel Takvim</h1>
            <p style={{color:C.muted,marginTop:"8px",fontSize:"14px"}}>Outlook & Google Calendar tek uygulamada</p>
          </div>
          <div style={{background:C.surface,borderRadius:"24px",padding:"32px",boxShadow:"0 25px 80px rgba(0,0,0,0.4)",border:"1px solid "+C.border}}>
            <div style={{fontSize:"13px",fontWeight:600,color:C.muted,marginBottom:"16px",textAlign:"center",textTransform:"uppercase",letterSpacing:0.5}}>Hesabınızla giriş yapın</div>
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              <button className="lbtn" onClick={loginMs} style={{padding:"15px",borderRadius:"14px",background:"linear-gradient(135deg,#0078d4,#106ebe)",border:"none",color:"white",fontSize:"15px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",boxShadow:"0 4px 20px rgba(0,120,212,0.35)"}}>
                <span style={{fontSize:"20px"}}>📘</span> Microsoft Outlook ile Giriş
              </button>
              <button className="lbtn" onClick={loginGoogle} style={{padding:"15px",borderRadius:"14px",background:"linear-gradient(135deg,#4285f4,#34a853)",border:"none",color:"white",fontSize:"15px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",boxShadow:"0 4px 20px rgba(66,133,244,0.35)"}}>
                <span style={{fontSize:"20px"}}>📗</span> Google Calendar ile Giriş
              </button>
              <div style={{display:"flex",alignItems:"center",gap:"10px",margin:"4px 0"}}>
                <div style={{flex:1,height:"1px",background:C.border}}/><span style={{color:C.muted,fontSize:"12px"}}>veya</span><div style={{flex:1,height:"1px",background:C.border}}/>
              </div>
              <button className="lbtn" onClick={loginDemo} style={{padding:"15px",borderRadius:"14px",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",border:"none",color:"white",fontSize:"15px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",boxShadow:"0 4px 20px rgba(124,58,237,0.35)"}}>
                <span style={{fontSize:"20px"}}>🎮</span> Demo Olarak Dene
              </button>
            </div>
            <p style={{color:C.muted,fontSize:"12px",textAlign:"center",marginTop:"16px",lineHeight:1.6}}>
              Her iki hesabı da bağlayabilirsiniz — giriş sonrası hesap ayarlarından ekleyebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── APP ────────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:C.text}}>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input,textarea{outline:none;-webkit-appearance:none}
        input:focus,textarea:focus{border-color:${C.teal}!important;box-shadow:0 0 0 3px ${C.teal}18!important}
        .ec:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.2)!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        .pg{animation:fadeUp 0.22s ease}
        .toast{animation:slideDown 0.3s ease}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>

      {toast&&<div className="toast" style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="error"?C.danger:C.success,color:"white",padding:"12px 24px",borderRadius:"14px",boxShadow:"0 8px 30px rgba(0,0,0,0.3)",fontWeight:600,fontSize:"14px",whiteSpace:"nowrap",maxWidth:"90vw"}}>{toast.msg}</div>}
      {selected&&<DetailModal event={selected} onClose={()=>setSelected(null)} onDelete={deleteEvent} C={C} isMobile={isMobile}/>}
      {showAccounts&&<AccountPanel msUser={msUser} googleUser={ggUser} onConnectMs={loginMs} onConnectGoogle={loginGoogle} onDisconnectMs={()=>{disconnectMs();if(!ggUser){setScreen("login");}}} onDisconnectGoogle={()=>{disconnectGoogle();if(!msUser){setScreen("login");}}} C={C} isMobile={isMobile} onClose={()=>setShowAccounts(false)}/>}
      {dayEvents&&(
        <div onClick={()=>setDayEvents(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:isMobile?"24px 24px 0 0":"24px",padding:"24px",width:"100%",maxWidth:isMobile?"100%":"460px",maxHeight:"70vh",overflowY:"auto"}}>
            {isMobile&&<div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 16px"}}/>}
            <h3 style={{margin:"0 0 16px",fontSize:"16px",fontWeight:700}}>{fmtShort(getStartDT(dayEvents[0]))} etkinlikleri</h3>
            {dayEvents.map((e,i)=>(
              <div key={i} onClick={()=>{setDayEvents(null);setSelected(e);}} style={{padding:"12px 14px",background:C.card,borderRadius:"14px",marginBottom:"8px",borderLeft:`3px solid ${e._source==="google"?"#4285f4":"#0078d4"}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontWeight:700,fontSize:"14px"}}>{e.subject}</div>
                  <SourceBadge source={e._source} small/>
                </div>
                <div style={{color:C.muted,fontSize:"12px",marginTop:"4px"}}>🕐 {fmtTime(getStartDT(e))} – {fmtTime(getEndDT(e))}</div>
              </div>
            ))}
            <button onClick={()=>setDayEvents(null)} style={{width:"100%",padding:"13px",borderRadius:"12px",background:C.tag,border:"none",color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer",marginTop:"8px"}}>Kapat</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{background:C.header,padding:"0 20px",height:"60px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 30px rgba(0,0,0,0.3)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{width:"34px",height:"34px",borderRadius:"10px",background:C.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>📅</div>
          <div>
            <div style={{fontWeight:700,fontSize:"15px",color:"white"}}>{demoMode?"Demo — ":""}Evrensel Takvim</div>
            <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
              {msUser&&<span style={{fontSize:"10px",background:"rgba(0,120,212,0.4)",color:"#7ec8ff",padding:"1px 6px",borderRadius:"20px",fontWeight:600}}>📘 Outlook</span>}
              {ggUser&&<span style={{fontSize:"10px",background:"rgba(66,133,244,0.4)",color:"#93c5fd",padding:"1px 6px",borderRadius:"20px",fontWeight:600}}>📗 Google</span>}
            </div>
          </div>
        </div>
        {!isMobile&&(
          <nav style={{display:"flex",gap:"4px",background:"rgba(255,255,255,0.06)",borderRadius:"12px",padding:"4px"}}>
            {[{id:"list",icon:"📋",label:"Etkinlikler"},{id:"calendar",icon:"🗓️",label:"Takvim"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 16px",borderRadius:"9px",border:"none",background:tab===t.id?"rgba(255,255,255,0.15)":"transparent",color:"white",fontWeight:600,fontSize:"14px",cursor:"pointer",transition:"all 0.2s"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        )}
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          {notifPerm!=="granted"&&<button onClick={async()=>{const p=await Notification.requestPermission();setNotifPerm(p);if(p==="granted")showToast("🔔 Bildirimler açıldı!");}} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"10px",padding:"8px 10px",color:"white",fontSize:"14px",cursor:"pointer"}}>🔔</button>}
          <button onClick={()=>setShowAccounts(true)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"10px",padding:"8px 12px",color:"white",fontSize:"13px",fontWeight:600,cursor:"pointer"}}>👤 Hesaplar</button>
          <button onClick={toggleTheme} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"10px",padding:"8px 10px",color:"white",fontSize:"15px",cursor:"pointer"}}>{themeKey==="dark"?"☀️":"🌙"}</button>
          {!isMobile&&<button onClick={()=>setShowAddPanel(!showAddPanel)} style={{background:C.gradient,border:"none",borderRadius:"10px",padding:"8px 18px",color:"white",fontSize:"14px",fontWeight:700,cursor:"pointer",boxShadow:`0 4px 14px ${C.teal}33`}}>➕ Yeni Ekle</button>}
        </div>
      </header>

      {/* DESKTOP */}
      {!isMobile?(
        <div style={{display:"flex",minHeight:"calc(100vh - 60px)"}}>
          <div style={{flex:1,padding:"24px",overflowY:"auto"}}>
            {tab==="list"&&(
              <div className="pg">
                <StatsBar events={allEvents} msConnected={msConnected} googleConnected={ggConnected} C={C}/>
                {/* Filter row */}
                <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{flex:1,minWidth:"200px",position:"relative"}}>
                    <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",fontSize:"15px",pointerEvents:"none"}}>🔍</span>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Etkinlik ara..." style={{width:"100%",padding:"11px 16px 11px 40px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"14px"}}/>
                    {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,fontSize:"18px",cursor:"pointer"}}>×</button>}
                  </div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    {[{id:"all",l:"Tümü"},{id:"outlook",l:"📘 Outlook"},{id:"google",l:"📗 Google"},{id:"today",l:"📅 Bugün"},{id:"urgent",l:"⚡ Acil"}].map(f=>(
                      <button key={f.id} onClick={()=>setActiveFilter(f.id)} style={{padding:"8px 14px",borderRadius:"20px",border:"1px solid",borderColor:activeFilter===f.id?C.teal:C.border,background:activeFilter===f.id?C.teal+"22":"transparent",color:activeFilter===f.id?C.teal:C.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.15s"}}>
                        {f.l}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>{ if(msUser){getMsToken().then(t=>t&&loadMsEvents(t));} if(ggUser){const t=getGgToken();if(t)loadGgEvents(t);} }} disabled={loading} style={{padding:"10px 16px",borderRadius:"12px",border:"1px solid "+C.border,background:C.surface,color:C.teal,fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>
                    {loading?"⟳":"🔄"} Yenile
                  </button>
                </div>
                {loading&&<div style={{textAlign:"center",padding:"60px",color:C.muted}}><div style={{fontSize:"40px",marginBottom:"8px"}}>⟳</div>Yükleniyor...</div>}
                {!loading&&filteredEvents.length===0&&(
                  <div style={{textAlign:"center",padding:"70px",background:C.card,borderRadius:"20px",border:"1px solid "+C.border}}>
                    <div style={{fontSize:"52px",marginBottom:"12px"}}>{search?"🔍":"🗓️"}</div>
                    <div style={{color:C.muted,fontSize:"17px",marginBottom:"20px"}}>{search?`"${search}" için sonuç yok`:"Yaklaşan etkinlik yok"}</div>
                    {!search&&<button onClick={()=>setShowAddPanel(true)} style={{padding:"12px 28px",borderRadius:"12px",background:C.gradient,border:"none",color:"white",fontWeight:700,cursor:"pointer",fontSize:"15px"}}>+ Etkinlik Ekle</button>}
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(480px,1fr))",gap:"10px"}}>
                  {filteredEvents.map(e=><EventCard key={e._id} e={e} onClick={()=>setSelected(e)} C={C}/>)}
                </div>
              </div>
            )}
            {tab==="calendar"&&(
              <div className="pg">
                <h2 style={{margin:"0 0 20px",fontSize:"22px",fontWeight:700}}>Takvim</h2>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px"}}>
                  <CalendarGrid events={allEvents} onDayClick={setDayEvents} C={C}/>
                  <div>
                    <div style={{fontWeight:600,fontSize:"13px",color:C.muted,marginBottom:"12px",textTransform:"uppercase",letterSpacing:0.5}}>Yaklaşan ({upcoming.length})</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                      {upcoming.slice(0,8).map(e=>(
                        <div key={e._id} onClick={()=>setSelected(e)} className="ec" style={{display:"flex",gap:"10px",padding:"12px 14px",background:C.card,borderRadius:"14px",cursor:"pointer",border:"1px solid "+C.border,borderLeft:`3px solid ${e._source==="google"?"#4285f4":"#0078d4"}`,transition:"all 0.15s"}}>
                          <div style={{minWidth:"36px",textAlign:"center"}}>
                            <div style={{fontSize:"9px",color:C.muted,textTransform:"uppercase"}}>{new Date(toUTC(getStartDT(e))).toLocaleDateString("tr-TR",{month:"short"})}</div>
                            <div style={{fontSize:"18px",fontWeight:800,color:e._source==="google"?"#4285f4":"#0078d4",lineHeight:1}}>{new Date(toUTC(getStartDT(e))).getDate()}</div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</div>
                            <div style={{color:C.muted,fontSize:"11px",marginTop:"2px"}}>{fmtTime(getStartDT(e))}</div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px"}}>
                            <SourceBadge source={e._source} small/>
                            <div style={{fontSize:"11px",fontWeight:700,color:C.warning}}>{timeUntil(getStartDT(e))}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {showAddPanel&&(
            <div style={{width:"400px",background:C.surface,borderLeft:"1px solid "+C.border,padding:"24px",overflowY:"auto",boxShadow:"-4px 0 30px rgba(0,0,0,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
                <h3 style={{margin:0,fontSize:"18px",fontWeight:700}}>➕ Yeni Etkinlik</h3>
                <button onClick={()=>setShowAddPanel(false)} style={{background:C.tag,border:"none",color:C.muted,fontSize:"16px",cursor:"pointer",padding:"6px 10px",borderRadius:"8px"}}>✕</button>
              </div>
              <AddForm form={form} setForm={setForm} onSave={saveEvent} onCancel={()=>setShowAddPanel(false)} saving={saving} C={C} msConnected={msConnected} googleConnected={ggConnected}/>
            </div>
          )}
        </div>
      ):(
        /* MOBILE */
        <div style={{paddingBottom:"70px"}}>
          <div style={{padding:"14px"}}>
            {tab==="list"&&(
              <div className="pg">
                <StatsBar events={allEvents} msConnected={msConnected} googleConnected={ggConnected} C={C}/>
                <div style={{position:"relative",marginBottom:"10px"}}>
                  <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",fontSize:"15px",pointerEvents:"none"}}>🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Etkinlik ara..." style={{width:"100%",padding:"11px 16px 11px 40px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"14px"}}/>
                  {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,fontSize:"18px",cursor:"pointer"}}>×</button>}
                </div>
                <div style={{display:"flex",gap:"6px",overflowX:"auto",paddingBottom:"4px",marginBottom:"12px",scrollbarWidth:"none"}}>
                  {[{id:"all",l:"Tümü"},{id:"outlook",l:"📘"},{id:"google",l:"📗"},{id:"today",l:"Bugün"},{id:"urgent",l:"⚡ Acil"}].map(f=>(
                    <button key={f.id} onClick={()=>setActiveFilter(f.id)} style={{padding:"7px 12px",borderRadius:"20px",border:"1px solid",borderColor:activeFilter===f.id?C.teal:C.border,background:activeFilter===f.id?C.teal+"22":"transparent",color:activeFilter===f.id?C.teal:C.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s"}}>
                      {f.l}
                    </button>
                  ))}
                </div>
                {loading&&<div style={{textAlign:"center",padding:"40px",color:C.muted}}>⟳ Yükleniyor...</div>}
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {filteredEvents.map(e=><EventCard key={e._id} e={e} onClick={()=>setSelected(e)} C={C}/>)}
                </div>
                {!loading&&filteredEvents.length===0&&(
                  <div style={{textAlign:"center",padding:"50px",background:C.card,borderRadius:"16px",border:"1px solid "+C.border}}>
                    <div style={{fontSize:"44px",marginBottom:"12px"}}>{search?"🔍":"🗓️"}</div>
                    <div style={{color:C.muted,marginBottom:"14px"}}>{search?`"${search}" bulunamadı`:"Etkinlik yok"}</div>
                    {!search&&<button onClick={()=>setTab("add")} style={{padding:"10px 24px",borderRadius:"12px",background:C.gradient,border:"none",color:"white",fontWeight:700,cursor:"pointer",fontSize:"14px"}}>+ Ekle</button>}
                  </div>
                )}
              </div>
            )}
            {tab==="calendar"&&(
              <div className="pg">
                <div style={{fontWeight:700,fontSize:"18px",marginBottom:"16px"}}>Takvim</div>
                <CalendarGrid events={allEvents} onDayClick={setDayEvents} C={C}/>
                <div style={{marginTop:"18px"}}>
                  <div style={{fontWeight:600,fontSize:"12px",color:C.muted,marginBottom:"10px",textTransform:"uppercase",letterSpacing:0.5}}>Yaklaşan</div>
                  {upcoming.slice(0,5).map(e=>(
                    <div key={e._id} onClick={()=>setSelected(e)} style={{display:"flex",gap:"10px",padding:"12px",background:C.card,borderRadius:"14px",marginBottom:"8px",cursor:"pointer",border:"1px solid "+C.border,borderLeft:`3px solid ${e._source==="google"?"#4285f4":"#0078d4"}`}}>
                      <div style={{textAlign:"center",minWidth:"36px"}}>
                        <div style={{fontSize:"9px",color:C.muted,textTransform:"uppercase"}}>{new Date(toUTC(getStartDT(e))).toLocaleDateString("tr-TR",{month:"short"})}</div>
                        <div style={{fontSize:"18px",fontWeight:800,color:e._source==="google"?"#4285f4":"#0078d4",lineHeight:1}}>{new Date(toUTC(getStartDT(e))).getDate()}</div>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</div>
                        <div style={{display:"flex",gap:"6px",alignItems:"center",marginTop:"3px"}}>
                          <span style={{color:C.muted,fontSize:"11px"}}>{fmtTime(getStartDT(e))}</span>
                          <SourceBadge source={e._source} small/>
                        </div>
                      </div>
                      <div style={{fontSize:"11px",fontWeight:700,color:C.warning,alignSelf:"center"}}>{timeUntil(getStartDT(e))}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab==="add"&&(
              <div className="pg">
                <div style={{fontWeight:700,fontSize:"18px",marginBottom:"16px"}}>➕ Yeni Etkinlik</div>
                <AddForm form={form} setForm={setForm} onSave={saveEvent} saving={saving} C={C} msConnected={msConnected} googleConnected={ggConnected}/>
              </div>
            )}
          </div>
          <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.navBg,borderTop:"1px solid "+C.border,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -4px 20px rgba(0,0,0,0.2)"}}>
            {[{id:"list",icon:"📋",label:"Etkinlikler"},{id:"calendar",icon:"🗓️",label:"Takvim"},{id:"add",icon:"➕",label:"Ekle"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",position:"relative"}}>
                <span style={{fontSize:t.id==="add"?"24px":"20px",filter:tab===t.id?"none":"grayscale(0.5) opacity(0.45)",transition:"all 0.2s"}}>{t.icon}</span>
                <span style={{fontSize:"11px",fontWeight:700,color:tab===t.id?C.teal:C.muted}}>{t.label}</span>
                {tab===t.id&&<div style={{position:"absolute",top:0,left:"20%",right:"20%",height:"2px",background:C.gradient,borderRadius:"0 0 4px 4px"}}/>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
