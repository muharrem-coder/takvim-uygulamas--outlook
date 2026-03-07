/* eslint-disable */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── TEMA ──────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#080812", surface: "#12122a", card: "#1a1a35", header: "#0d0d24",
    teal: "#00d4ff", accent: "#7c3aed", text: "#f0f0ff", muted: "#7878a0",
    border: "#25254a", success: "#00e5a0", warning: "#ffb020", danger: "#ff4466",
    navBg: "#12122a", tag: "#1e1e40", gradient: "linear-gradient(135deg,#7c3aed,#00d4ff)",
  },
  light: {
    bg: "#f5f5ff", surface: "#ffffff", card: "#ffffff", header: "#6d28d9",
    teal: "#6d28d9", accent: "#06b6d4", text: "#1a1a2e", muted: "#6b7280",
    border: "#e5e7eb", success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
    navBg: "#ffffff", tag: "#f3f4f6", gradient: "linear-gradient(135deg,#6d28d9,#06b6d4)",
  }
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
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

// ── HELPERS ───────────────────────────────────────────────────────────────────
const toUTC    = d => d.endsWith("Z") ? d : d + "Z";
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

const CAT_COLORS = {
  "Toplantı": { bg:"#1e3a5f", text:"#60a5fa", dot:"#3b82f6" },
  "Kişisel":  { bg:"#3b1f5e", text:"#c084fc", dot:"#a855f7" },
  "İş":       { bg:"#1e4d3b", text:"#34d399", dot:"#10b981" },
  "Önemli":   { bg:"#5c1c1c", text:"#fca5a5", dot:"#ef4444" },
  "Diğer":    { bg:"#1e3a2e", text:"#6ee7b7", dot:"#059669" },
};
const getCat = e => CAT_COLORS[e.categories?.[0]] || CAT_COLORS["Diğer"];

const REMINDERS = [
  {l:"5 dk",v:5},{l:"15 dk",v:15},{l:"30 dk",v:30},
  {l:"1 sa",v:60},{l:"1 gün",v:1440},{l:"2 gün",v:2880}
];

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────
function CalendarGrid({ events, onDayClick, C }) {
  const [month, setMonth] = useState(new Date());
  const y = month.getFullYear(), m = month.getMonth();
  const firstDay = new Date(y,m,1).getDay();
  const days = new Date(y,m+1,0).getDate();
  const today = new Date();
  const byDay = {};
  events.forEach(e => {
    const d = new Date(toUTC(e.start.dateTime));
    if (d.getFullYear()===y && d.getMonth()===m) {
      if (!byDay[d.getDate()]) byDay[d.getDate()] = [];
      byDay[d.getDate()].push(e);
    }
  });
  const cells = [];
  for (let i=0; i<(firstDay+6)%7; i++) cells.push(null);
  for (let i=1; i<=days; i++) cells.push(i);

  return (
    <div style={{background:C.card,borderRadius:"20px",padding:"20px",border:"1px solid "+C.border}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <button onClick={()=>setMonth(new Date(y,m-1,1))} style={{background:C.tag,border:"none",color:C.teal,fontSize:"18px",cursor:"pointer",padding:"6px 12px",borderRadius:"10px"}}>‹</button>
        <span style={{fontWeight:700,fontSize:"16px",color:C.text}}>
          {month.toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}
        </span>
        <button onClick={()=>setMonth(new Date(y,m+1,1))} style={{background:C.tag,border:"none",color:C.teal,fontSize:"18px",cursor:"pointer",padding:"6px 12px",borderRadius:"10px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px",marginBottom:"6px"}}>
        {["Pt","Sa","Ça","Pe","Cu","Ct","Pz"].map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:"11px",fontWeight:700,color:C.muted,padding:"4px 0"}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
        {cells.map((day,i) => {
          if (!day) return <div key={`e${i}`}/>;
          const isToday = day===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
          const evs = byDay[day];
          return (
            <div key={day} onClick={()=>evs&&onDayClick(evs)} style={{
              textAlign:"center",padding:"8px 2px",borderRadius:"10px",
              cursor:evs?"pointer":"default",
              background:isToday?C.teal:"transparent",
              color:isToday?"#000":C.text,
              fontWeight:isToday||evs?700:400,fontSize:"14px",position:"relative",transition:"all 0.15s"
            }}>
              {day}
              {evs&&!isToday&&(
                <div style={{display:"flex",gap:"2px",justifyContent:"center",marginTop:"2px"}}>
                  {evs.slice(0,3).map((e,i)=>(
                    <div key={i} style={{width:"4px",height:"4px",borderRadius:"50%",background:getCat(e).dot}}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SEARCH BAR ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, C }) {
  return (
    <div style={{position:"relative"}}>
      <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",fontSize:"16px",pointerEvents:"none"}}>🔍</span>
      <input
        value={value} onChange={e=>onChange(e.target.value)}
        placeholder="Etkinlik ara..."
        style={{width:"100%",padding:"12px 16px 12px 42px",borderRadius:"14px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"14px",transition:"all 0.2s"}}
      />
      {value && (
        <button onClick={()=>onChange("")} style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,fontSize:"18px",cursor:"pointer",lineHeight:1}}>×</button>
      )}
    </div>
  );
}

// ── FILTER BAR ────────────────────────────────────────────────────────────────
function FilterBar({ activeFilter, onFilter, C }) {
  const filters = [
    {id:"all",label:"Tümü"},
    ...Object.keys(CAT_COLORS).map(k=>({id:k,label:k})),
    {id:"urgent",label:"⚡ Acil"},
    {id:"today",label:"📅 Bugün"},
  ];
  return (
    <div style={{display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"4px",scrollbarWidth:"none"}}>
      {filters.map(f=>(
        <button key={f.id} onClick={()=>onFilter(f.id)} style={{
          padding:"7px 14px",borderRadius:"20px",border:"1px solid",whiteSpace:"nowrap",
          borderColor:activeFilter===f.id?C.teal:C.border,
          background:activeFilter===f.id?`${C.teal}20`:"transparent",
          color:activeFilter===f.id?C.teal:C.muted,
          fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s",flexShrink:0,
        }}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── EVENT CARD ────────────────────────────────────────────────────────────────
function EventCard({ e, onClick, C }) {
  const cat = getCat(e);
  const past = isPast(e.end.dateTime);
  const urgent = isUrgent(e.start.dateTime);
  return (
    <div onClick={onClick} style={{
      background:C.card,borderRadius:"16px",padding:"16px 18px",
      border:`1px solid ${urgent?"rgba(255,68,102,0.4)":C.border}`,
      cursor:"pointer",transition:"all 0.18s",
      opacity:past?0.55:1,
      boxShadow:urgent?"0 0 0 1px rgba(255,68,102,0.3)":"none",
      display:"flex",gap:"14px",alignItems:"flex-start",
    }}>
      {/* Date badge */}
      <div style={{minWidth:"50px",textAlign:"center",background:cat.bg,borderRadius:"12px",padding:"8px 4px",flexShrink:0}}>
        <div style={{fontSize:"10px",color:cat.text,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>
          {new Date(toUTC(e.start.dateTime)).toLocaleDateString("tr-TR",{month:"short"})}
        </div>
        <div style={{fontSize:"22px",fontWeight:800,color:cat.text,lineHeight:1.1}}>
          {new Date(toUTC(e.start.dateTime)).getDate()}
        </div>
      </div>
      {/* Content */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"5px"}}>
          <span style={{fontWeight:700,fontSize:"15px",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>{e.subject}</span>
          <span style={{fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",background:cat.bg,color:cat.text,flexShrink:0}}>
            {e.categories?.[0]||"Diğer"}
          </span>
        </div>
        <div style={{color:C.muted,fontSize:"13px",marginBottom:"4px"}}>
          🕐 {fmtTime(e.start.dateTime)} – {fmtTime(e.end.dateTime)}
          {e.location?.displayName && <span> · 📍 {e.location.displayName}</span>}
        </div>
        {e.bodyPreview && <div style={{color:C.muted,fontSize:"12px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.bodyPreview}</div>}
        {/* Attendees preview */}
        {e.attendees?.length > 0 && (
          <div style={{marginTop:"6px",display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{fontSize:"12px",color:C.muted}}>👥</span>
            <span style={{fontSize:"12px",color:C.muted}}>{e.attendees.length} katılımcı</span>
          </div>
        )}
      </div>
      {/* Time badge */}
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontSize:"12px",fontWeight:700,color:urgent?C.danger:past?"#555":C.warning}}>
          {urgent?"🔴 ":""}{timeUntil(e.start.dateTime)}
        </div>
        {e.reminderMinutesBeforeStart!==undefined&&(
          <div style={{fontSize:"11px",color:C.muted,marginTop:"4px"}}>🔔{e.reminderMinutesBeforeStart}dk</div>
        )}
      </div>
    </div>
  );
}

// ── DETAIL MODAL ──────────────────────────────────────────────────────────────
function DetailModal({ event, onClose, onDelete, C, isMobile }) {
  const cat = getCat(event);
  const wrap = isMobile
    ? {position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end"}
    : {position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"};
  const box = isMobile
    ? {background:C.surface,borderRadius:"24px 24px 0 0",padding:"24px",width:"100%",maxHeight:"85vh",overflowY:"auto"}
    : {background:C.surface,borderRadius:"24px",padding:"32px",width:"100%",maxWidth:"520px",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.5)"};
  return (
    <div onClick={onClose} style={wrap}>
      <div onClick={e=>e.stopPropagation()} style={box}>
        {isMobile&&<div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 20px"}}/>}
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px"}}>
          <div style={{flex:1}}>
            <span style={{fontSize:"12px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",background:cat.bg,color:cat.text,display:"inline-block",marginBottom:"8px"}}>{event.categories?.[0]||"Diğer"}</span>
            <h2 style={{margin:0,fontSize:"22px",fontWeight:800,lineHeight:1.3}}>{event.subject}</h2>
          </div>
          {!isMobile&&<button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:"22px",cursor:"pointer",marginLeft:"12px"}}>✕</button>}
        </div>
        {/* Details */}
        <div style={{background:C.tag,borderRadius:"16px",padding:"16px",marginBottom:"16px",display:"flex",flexDirection:"column",gap:"10px"}}>
          <div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>🗓️</span><span style={{color:C.text}}>{fmtDT(event.start.dateTime)}</span></div>
          <div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>🏁</span><span style={{color:C.text}}>{fmtDT(event.end.dateTime)}</span></div>
          {event.location?.displayName&&<div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>📍</span><span style={{color:C.text}}>{event.location.displayName}</span></div>}
          <div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>🔔</span><span style={{color:C.muted}}>{REMINDERS.find(r=>r.v===event.reminderMinutesBeforeStart)?.l||`${event.reminderMinutesBeforeStart}dk`} önce hatırlat</span></div>
          <div style={{display:"flex",gap:"12px",fontSize:"14px"}}><span>⏰</span><span style={{color:isUrgent(event.start.dateTime)?C.danger:C.warning,fontWeight:700}}>{timeUntil(event.start.dateTime)}</span></div>
        </div>
        {/* Attendees */}
        {event.attendees?.length>0&&(
          <div style={{marginBottom:"16px"}}>
            <div style={{fontSize:"13px",fontWeight:700,color:C.muted,marginBottom:"10px",textTransform:"uppercase",letterSpacing:0.5}}>Katılımcılar ({event.attendees.length})</div>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {event.attendees.map((a,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",background:C.tag,borderRadius:"12px"}}>
                  <div style={{width:"32px",height:"32px",borderRadius:"50%",background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontWeight:700,color:C.teal,flexShrink:0}}>
                    {(a.emailAddress?.name||a.emailAddress?.address||"?")[0].toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"14px",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.emailAddress?.name||a.emailAddress?.address}</div>
                    {a.emailAddress?.name&&<div style={{fontSize:"12px",color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.emailAddress?.address}</div>}
                  </div>
                  <span style={{fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",
                    background:a.status?.response==="accepted"?"rgba(0,229,160,0.15)":a.status?.response==="declined"?"rgba(255,68,102,0.15)":"rgba(120,120,160,0.15)",
                    color:a.status?.response==="accepted"?C.success:a.status?.response==="declined"?C.danger:C.muted,
                    flexShrink:0
                  }}>
                    {a.status?.response==="accepted"?"✓ Kabul":a.status?.response==="declined"?"✗ Ret":"Bekliyor"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Notes */}
        {event.bodyPreview&&<div style={{padding:"14px",background:C.tag,borderRadius:"12px",color:C.muted,fontSize:"14px",lineHeight:1.6,marginBottom:"20px"}}>{event.bodyPreview}</div>}
        {/* Actions */}
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:"12px",background:C.tag,border:"none",color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>Kapat</button>
          <button onClick={()=>onDelete(event.id)} style={{flex:1,padding:"13px",borderRadius:"12px",background:"rgba(255,68,102,0.1)",border:"1px solid rgba(255,68,102,0.3)",color:C.danger,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>🗑️ Sil</button>
        </div>
      </div>
    </div>
  );
}

// ── ADD FORM ──────────────────────────────────────────────────────────────────
function AddForm({ form, setForm, onSave, onCancel, saving, C }) {
  const [attendeeInput, setAttendeeInput] = useState("");
  const addAttendee = () => {
    const email = attendeeInput.trim();
    if (!email || !email.includes("@")) return;
    if (form.attendees?.some(a=>a.emailAddress.address===email)) return;
    setForm({...form, attendees:[...(form.attendees||[]),{emailAddress:{address:email,name:email}}]});
    setAttendeeInput("");
  };
  const removeAttendee = (email) => setForm({...form, attendees:(form.attendees||[]).filter(a=>a.emailAddress.address!==email)});

  const inputStyle = {width:"100%",padding:"13px 16px",borderRadius:"12px",background:C.surface,border:"1px solid "+C.border,color:C.text,fontSize:"15px",transition:"all 0.2s"};
  const labelStyle = {display:"block",fontSize:"12px",fontWeight:700,color:C.muted,marginBottom:"6px",textTransform:"uppercase",letterSpacing:0.5};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
      <div>
        <label style={labelStyle}>📌 Başlık *</label>
        <input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Toplantı, Randevu..." style={inputStyle} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        <div>
          <label style={labelStyle}>🗓️ Başlangıç</label>
          <input type="datetime-local" value={form.start} onChange={e=>setForm({...form,start:e.target.value})} style={{...inputStyle,fontSize:"13px",padding:"12px"}} />
        </div>
        <div>
          <label style={labelStyle}>🏁 Bitiş</label>
          <input type="datetime-local" value={form.end} onChange={e=>setForm({...form,end:e.target.value})} style={{...inputStyle,fontSize:"13px",padding:"12px"}} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>🏷️ Kategori</label>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {Object.keys(CAT_COLORS).map(cat=>(
            <button key={cat} onClick={()=>setForm({...form,category:cat})} style={{padding:"8px 14px",borderRadius:"20px",border:"1px solid",borderColor:form.category===cat?CAT_COLORS[cat].dot:C.border,background:form.category===cat?CAT_COLORS[cat].bg:"transparent",color:form.category===cat?CAT_COLORS[cat].text:C.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>🔔 Hatırlatıcı</label>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {REMINDERS.map(r=>(
            <button key={r.v} onClick={()=>setForm({...form,reminder:r.v})} style={{padding:"8px 14px",borderRadius:"20px",border:"1px solid",borderColor:form.reminder===r.v?C.teal:C.border,background:form.reminder===r.v?C.teal+"22":"transparent",color:form.reminder===r.v?C.teal:C.muted,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
              {r.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>📍 Konum</label>
        <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Adres veya link" style={inputStyle} />
      </div>

      {/* Attendees */}
      <div>
        <label style={labelStyle}>👥 Davet Gönder</label>
        <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
          <input
            value={attendeeInput} onChange={e=>setAttendeeInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addAttendee()}
            placeholder="ornek@email.com" type="email"
            style={{...inputStyle,flex:1}}
          />
          <button onClick={addAttendee} style={{padding:"13px 18px",borderRadius:"12px",background:C.teal,border:"none",color:"#000",fontWeight:700,cursor:"pointer",flexShrink:0}}>
            Ekle
          </button>
        </div>
        {(form.attendees||[]).length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {form.attendees.map(a=>(
              <div key={a.emailAddress.address} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",background:C.tag,borderRadius:"12px"}}>
                <div style={{width:"28px",height:"28px",borderRadius:"50%",background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:700,color:C.teal,flexShrink:0}}>
                  {a.emailAddress.address[0].toUpperCase()}
                </div>
                <span style={{flex:1,fontSize:"14px",color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.emailAddress.address}</span>
                <button onClick={()=>removeAttendee(a.emailAddress.address)} style={{background:"none",border:"none",color:C.muted,fontSize:"18px",cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
              </div>
            ))}
            <div style={{fontSize:"12px",color:C.muted,padding:"6px 0"}}>
              ✉️ Davet e-postası otomatik gönderilecek
            </div>
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle}>📝 Notlar</label>
        <textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Ek bilgiler..." rows={3} style={{...inputStyle,resize:"none",fontFamily:"inherit"}} />
      </div>

      <div style={{display:"flex",gap:"12px"}}>
        {onCancel&&<button onClick={onCancel} style={{flex:1,padding:"14px",borderRadius:"14px",background:"transparent",border:"1px solid "+C.border,color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>İptal</button>}
        <button onClick={onSave} disabled={saving} style={{flex:2,padding:"14px",borderRadius:"14px",background:C.gradient,border:"none",color:"white",fontSize:"16px",fontWeight:700,cursor:"pointer",boxShadow:`0 4px 20px ${C.teal}33`}}>
          {saving?"⏳ Kaydediliyor...":"✅ Outlook'a Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ── STATS BAR ─────────────────────────────────────────────────────────────────
function StatsBar({ events, C }) {
  const upcoming = events.filter(e=>!isPast(e.end.dateTime));
  const today = events.filter(e=>{
    const d=new Date(toUTC(e.start.dateTime));
    const n=new Date();
    return d.getDate()===n.getDate()&&d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();
  });
  const urgent = events.filter(e=>isUrgent(e.start.dateTime));
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"20px"}}>
      {[
        {label:"Yaklaşan",value:upcoming.length,icon:"📋",color:C.teal},
        {label:"Bugün",value:today.length,icon:"📅",color:C.warning},
        {label:"Acil",value:urgent.length,icon:"⚡",color:C.danger},
      ].map(s=>(
        <div key={s.label} style={{background:C.card,borderRadius:"14px",padding:"14px 16px",border:"1px solid "+C.border,textAlign:"center"}}>
          <div style={{fontSize:"22px",marginBottom:"4px"}}>{s.icon}</div>
          <div style={{fontSize:"24px",fontWeight:800,color:s.color}}>{s.value}</div>
          <div style={{fontSize:"12px",color:C.muted,fontWeight:600}}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const [themeKey, setThemeKey] = useState(()=>localStorage.getItem("theme")||"dark");
  const C = THEMES[themeKey];
  const toggleTheme = ()=>{ const t=themeKey==="dark"?"light":"dark"; setThemeKey(t); localStorage.setItem("theme",t); };

  const [screen, setScreen]   = useState("login");
  const [tab, setTab]         = useState("list");
  const [user, setUser]       = useState(null);
  const [events, setEvents]   = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [selected, setSelected] = useState(null);
  const [dayEvents, setDayEvents] = useState(null);
  const [toast, setToast]     = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [notifPerm, setNotifPerm] = useState(typeof Notification!=="undefined"?Notification.permission:"denied");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [search, setSearch]   = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const initDone = useRef(false);

  const [form, setForm] = useState({
    subject:"",start:fmtInput(new Date()),end:fmtInput(new Date(Date.now()+3600000)),
    location:"",body:"",reminder:15,category:"Toplantı",attendees:[],
  });

  const showToast = useCallback((msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); },[]);

  useEffect(()=>{ if("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(()=>{}); },[]);

  useEffect(()=>{
    if(initDone.current) return; initDone.current=true;
    const params=new URLSearchParams(window.location.search);
    const code=params.get("code"),state=params.get("state");
    const savedState=sessionStorage.getItem("oauth_state"),verifier=sessionStorage.getItem("pkce_verifier");
    if(code&&state&&state===savedState&&verifier){
      window.history.replaceState({},document.title,window.location.pathname);
      sessionStorage.removeItem("pkce_verifier"); sessionStorage.removeItem("oauth_state");
      setAuthLoading(true); doTokenExchange(code,verifier); return;
    }
    const savedToken=sessionStorage.getItem("ms_token"),expiry=sessionStorage.getItem("ms_expiry");
    if(savedToken&&expiry&&Date.now()<parseInt(expiry)){ setScreen("app"); loadUser(savedToken); loadEvents(savedToken); }
  },[]);

  useEffect(()=>{
    if(notifPerm!=="granted"||events.length===0) return;
    const timers=events.map(e=>{
      const delay=new Date(toUTC(e.start.dateTime)).getTime()-(e.reminderMinutesBeforeStart||15)*60000-Date.now();
      if(delay>0&&delay<24*3600000) return setTimeout(()=>new Notification(`⏰ ${e.subject}`,{body:`${fmtTime(e.start.dateTime)}`,icon:"/logo192.png"}),delay);
      return null;
    }).filter(Boolean);
    return ()=>timers.forEach(clearTimeout);
  },[events,notifPerm]);

  // Filtered events
  const filteredEvents = useMemo(()=>{
    let evs = events.filter(e=>new Date(toUTC(e.start.dateTime))>Date.now()-3600000);
    if(search) evs=evs.filter(e=>
      e.subject?.toLowerCase().includes(search.toLowerCase())||
      e.location?.displayName?.toLowerCase().includes(search.toLowerCase())||
      e.bodyPreview?.toLowerCase().includes(search.toLowerCase())||
      e.attendees?.some(a=>a.emailAddress?.address?.toLowerCase().includes(search.toLowerCase()))
    );
    if(activeFilter==="urgent") evs=evs.filter(e=>isUrgent(e.start.dateTime));
    else if(activeFilter==="today") evs=evs.filter(e=>{ const d=new Date(toUTC(e.start.dateTime)),n=new Date(); return d.getDate()===n.getDate()&&d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); });
    else if(activeFilter!=="all") evs=evs.filter(e=>(e.categories?.[0]||"Diğer")===activeFilter);
    return evs;
  },[events,search,activeFilter]);

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
      } else showToast("Giriş hatası","error");
    } catch { showToast("Bağlantı hatası","error"); }
    setAuthLoading(false);
  };

  const getToken=async()=>{
    const token=sessionStorage.getItem("ms_token"),expiry=sessionStorage.getItem("ms_expiry");
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

  const loadUser=async(token)=>{ try{ const r=await fetch("https://graph.microsoft.com/v1.0/me",{headers:{Authorization:`Bearer ${token}`}}); setUser(await r.json()); } catch {} };
  const loadEvents=async(token)=>{
    setLoadingEvents(true);
    try{
      const now=new Date().toISOString(),future=new Date(Date.now()+60*24*3600000).toISOString();
      const r=await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now}&endDateTime=${future}&$orderby=start/dateTime&$top=50&$expand=attachments`,{headers:{Authorization:`Bearer ${token}`}});
      const data=await r.json();
      if(data.value) setEvents(data.value);
      else showToast("Yüklenemedi","error");
    } catch { showToast("Bağlantı hatası","error"); }
    setLoadingEvents(false);
  };

  const loginMicrosoft=async()=>{
    const v=await genVerifier(),c=await genChallenge(v),s=Math.random().toString(36).substring(2);
    sessionStorage.setItem("pkce_verifier",v); sessionStorage.setItem("oauth_state",s);
    window.location.href=`${AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&state=${s}&code_challenge=${c}&code_challenge_method=S256&response_mode=query`;
  };

  const loginDemo=()=>{
    setDemoMode(true); setScreen("app");
    setUser({displayName:"Demo Kullanıcı",mail:"demo@outlook.com"});
    const now=Date.now();
    setEvents([
      {id:"1",subject:"Proje Kickoff Toplantısı",start:{dateTime:new Date(now+3600000*1.5).toISOString()},end:{dateTime:new Date(now+3600000*2.5).toISOString()},location:{displayName:"Zoom"},bodyPreview:"Q2 hedefleri ve yol haritası tartışılacak",reminderMinutesBeforeStart:15,categories:["Toplantı"],attendees:[{emailAddress:{address:"ali@test.com",name:"Ali Yılmaz"},status:{response:"accepted"}},{emailAddress:{address:"ayse@test.com",name:"Ayşe Kaya"},status:{response:"tentative"}},{emailAddress:{address:"mehmet@test.com",name:"Mehmet Demir"},status:{response:"none"}}]},
      {id:"2",subject:"Doktor Randevusu",start:{dateTime:new Date(now+3600000*26).toISOString()},end:{dateTime:new Date(now+3600000*27).toISOString()},location:{displayName:"Acıbadem Hastanesi"},bodyPreview:"Yıllık genel check-up",reminderMinutesBeforeStart:60,categories:["Kişisel"],attendees:[]},
      {id:"3",subject:"Sprint Review & Retrospektif",start:{dateTime:new Date(now+3600000*50).toISOString()},end:{dateTime:new Date(now+3600000*52).toISOString()},location:{displayName:"Konferans Salonu B"},bodyPreview:"Sprint 14 değerlendirmesi, bir sonraki sprint planlaması",reminderMinutesBeforeStart:30,categories:["İş"],attendees:[{emailAddress:{address:"ceo@company.com",name:"CEO"},status:{response:"accepted"}}]},
      {id:"4",subject:"Aile Yemeği",start:{dateTime:new Date(now+3600000*75).toISOString()},end:{dateTime:new Date(now+3600000*77).toISOString()},location:{displayName:"Ev"},bodyPreview:"Hafta sonu aile yemeği",reminderMinutesBeforeStart:60,categories:["Kişisel"],attendees:[]},
      {id:"5",subject:"Yıllık Performans Görüşmesi",start:{dateTime:new Date(now+3600000*100).toISOString()},end:{dateTime:new Date(now+3600000*101).toISOString()},location:{displayName:"İK Ofisi"},bodyPreview:"2025 yılı değerlendirmesi",reminderMinutesBeforeStart:1440,categories:["Önemli"],attendees:[{emailAddress:{address:"hr@company.com",name:"İK Müdürü"},status:{response:"accepted"}}]},
    ]);
  };

  const saveEvent=async()=>{
    if(!form.subject.trim()) return showToast("Başlık gerekli!","error");
    if(demoMode){
      const e={id:Date.now().toString(),subject:form.subject,start:{dateTime:new Date(form.start).toISOString()},end:{dateTime:new Date(form.end).toISOString()},location:{displayName:form.location},bodyPreview:form.body,reminderMinutesBeforeStart:form.reminder,categories:[form.category],attendees:form.attendees||[]};
      setEvents(prev=>[...prev,e].sort((a,b)=>new Date(toUTC(a.start.dateTime))-new Date(toUTC(b.start.dateTime))));
      showToast(`✅ Eklendi!${form.attendees?.length?` ${form.attendees.length} davet gönderildi.`:""}`);
      resetForm(); if(isMobile) setTab("list"); else setShowAddPanel(false); return;
    }
    const token=await getToken(); if(!token) return;
    setSaving(true);
    try{
      const body={subject:form.subject,start:{dateTime:new Date(form.start).toISOString(),timeZone:"Europe/Istanbul"},end:{dateTime:new Date(form.end).toISOString(),timeZone:"Europe/Istanbul"},location:{displayName:form.location},body:{contentType:"text",content:form.body},isReminderOn:true,reminderMinutesBeforeStart:form.reminder,categories:[form.category]};
      if(form.attendees?.length) body.attendees=form.attendees.map(a=>({...a,type:"required"}));
      const res=await fetch("https://graph.microsoft.com/v1.0/me/events",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(res.ok){
        const newEvent=await res.json();
        setEvents(prev=>[...prev,newEvent].sort((a,b)=>new Date(toUTC(a.start.dateTime))-new Date(toUTC(b.start.dateTime))));
        showToast(`✅ Kaydedildi!${form.attendees?.length?` ${form.attendees.length} davet gönderildi.`:""}`);
        resetForm(); if(isMobile) setTab("list"); else setShowAddPanel(false);
      } else { const err=await res.json(); showToast("Hata: "+(err.error?.message||""),"error"); }
    } catch { showToast("Bağlantı hatası","error"); }
    setSaving(false);
  };

  const deleteEvent=async(id)=>{
    if(demoMode){ setEvents(prev=>prev.filter(e=>e.id!==id)); showToast("Silindi"); setSelected(null); return; }
    const token=await getToken(); if(!token) return;
    try{ await fetch(`https://graph.microsoft.com/v1.0/me/events/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}}); setEvents(prev=>prev.filter(e=>e.id!==id)); showToast("Silindi"); setSelected(null); }
    catch { showToast("Silinemedi","error"); }
  };

  const doLogout=()=>{ sessionStorage.clear(); setScreen("login"); setUser(null); setEvents([]); setDemoMode(false); };
  const resetForm=()=>setForm({subject:"",start:fmtInput(new Date()),end:fmtInput(new Date(Date.now()+3600000)),location:"",body:"",reminder:15,category:"Toplantı",attendees:[]});
  const upcoming=events.filter(e=>new Date(toUTC(e.start.dateTime))>Date.now()-3600000);

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  if(screen==="login"){
    return(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:"24px"}}>
        <style>{`
          @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
          @keyframes shimmer{0%{background-position:-200%}100%{background-position:200%}}
          .lc{animation:float 4s ease-in-out infinite}
          .btn-ms:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,120,212,0.5)!important}
          .btn-demo:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(124,58,237,0.5)!important}
        `}</style>
        <div className="lc" style={{width:"100%",maxWidth:"400px"}}>
          <div style={{textAlign:"center",marginBottom:"32px"}}>
            <div style={{fontSize:"80px",marginBottom:"8px",filter:"drop-shadow(0 0 20px rgba(0,212,255,0.5))"}}>📅</div>
            <h1 style={{background:C.gradient,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:"30px",margin:0,fontWeight:800}}>Takvim Yöneticisi</h1>
            <p style={{color:C.muted,marginTop:"8px",fontSize:"15px"}}>Outlook takviminizi her yerden yönetin</p>
          </div>
          <div style={{background:C.surface,borderRadius:"24px",padding:"32px",boxShadow:"0 25px 80px rgba(0,0,0,0.4)",border:"1px solid "+C.border}}>
            {authLoading?(
              <div style={{textAlign:"center",padding:"24px",color:C.muted}}>
                <div style={{fontSize:"36px",marginBottom:"10px"}}>⏳</div>Giriş yapılıyor...
              </div>
            ):(<>
              <button className="btn-ms" onClick={loginMicrosoft} style={{width:"100%",padding:"16px",borderRadius:"14px",background:"linear-gradient(135deg,#0078d4,#106ebe)",border:"none",color:"white",fontSize:"16px",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",marginBottom:"12px",boxShadow:"0 4px 20px rgba(0,120,212,0.3)",transition:"all 0.2s"}}>
                🔑 Microsoft ile Giriş Yap
              </button>
              <button className="btn-demo" onClick={loginDemo} style={{width:"100%",padding:"16px",borderRadius:"14px",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",border:"none",color:"white",fontSize:"16px",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",boxShadow:"0 4px 20px rgba(124,58,237,0.3)",transition:"all 0.2s"}}>
                🎮 Demo Olarak Dene
              </button>
            </>)}
          </div>
          <p style={{color:C.muted,fontSize:"12px",textAlign:"center",marginTop:"20px",lineHeight:1.6}}>📱 Ana ekrana ekleyerek uygulama gibi kullanabilirsiniz</p>
        </div>
      </div>
    );
  }

  // ── APP ──────────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:C.text}}>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input,textarea,select{outline:none;-webkit-appearance:none}
        input:focus,textarea:focus,select:focus{border-color:${C.teal}!important;box-shadow:0 0 0 3px ${C.teal}18!important}
        .ec:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.2)!important}
        .ec:active{transform:scale(0.99)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        .pg{animation:fadeUp 0.22s ease}
        .toast{animation:slideDown 0.3s ease}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
        select option{background:${C.surface};color:${C.text}}
      `}</style>

      {toast&&<div className="toast" style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="error"?C.danger:C.success,color:"white",padding:"12px 24px",borderRadius:"14px",boxShadow:"0 8px 30px rgba(0,0,0,0.3)",fontWeight:600,fontSize:"14px",whiteSpace:"nowrap",maxWidth:"90vw"}}>{toast.msg}</div>}

      {selected&&<DetailModal event={selected} onClose={()=>setSelected(null)} onDelete={(id)=>deleteEvent(id)} C={C} isMobile={isMobile}/>}

      {dayEvents&&(
        <div onClick={()=>setDayEvents(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:isMobile?"24px 24px 0 0":"24px",padding:"24px",width:"100%",maxWidth:isMobile?"100%":"460px",maxHeight:"70vh",overflowY:"auto"}}>
            {isMobile&&<div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 16px"}}/>}
            <h3 style={{margin:"0 0 16px",fontSize:"16px",fontWeight:700}}>{fmtShort(dayEvents[0].start.dateTime)} etkinlikleri</h3>
            {dayEvents.map(e=>(
              <div key={e.id} onClick={()=>{setDayEvents(null);setSelected(e);}} style={{padding:"14px",background:C.card,borderRadius:"14px",marginBottom:"10px",borderLeft:`3px solid ${getCat(e).dot}`,cursor:"pointer"}}>
                <div style={{fontWeight:700}}>{e.subject}</div>
                <div style={{color:C.muted,fontSize:"13px",marginTop:"4px"}}>🕐 {fmtTime(e.start.dateTime)} – {fmtTime(e.end.dateTime)}</div>
                {e.attendees?.length>0&&<div style={{fontSize:"12px",color:C.muted,marginTop:"4px"}}>👥 {e.attendees.length} katılımcı</div>}
              </div>
            ))}
            <button onClick={()=>setDayEvents(null)} style={{width:"100%",padding:"13px",borderRadius:"12px",background:C.tag,border:"none",color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer",marginTop:"8px"}}>Kapat</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{background:C.header,padding:"0 24px",height:"60px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 30px rgba(0,0,0,0.3)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{width:"36px",height:"36px",borderRadius:"10px",background:C.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>📅</div>
          <div>
            <div style={{fontWeight:700,fontSize:"16px",color:"white"}}>Outlook Takvim</div>
            <div style={{fontSize:"11px",color:"rgba(255,255,255,0.55)"}}>{demoMode?"Demo Mod":(user?.displayName||"")}</div>
          </div>
        </div>
        {!isMobile&&(
          <nav style={{display:"flex",gap:"4px",background:"rgba(255,255,255,0.06)",borderRadius:"12px",padding:"4px"}}>
            {[{id:"list",icon:"📋",label:"Etkinlikler"},{id:"calendar",icon:"🗓️",label:"Takvim"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 18px",borderRadius:"9px",border:"none",background:tab===t.id?"rgba(255,255,255,0.15)":"transparent",color:"white",fontWeight:600,fontSize:"14px",cursor:"pointer",transition:"all 0.2s"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        )}
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          {notifPerm!=="granted"&&!demoMode&&(
            <button onClick={async()=>{const p=await Notification.requestPermission();setNotifPerm(p);if(p==="granted")showToast("🔔 Bildirimler açıldı!");}} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"10px",padding:"8px 12px",color:"white",fontSize:"13px",cursor:"pointer",fontWeight:600}}>🔔</button>
          )}
          <button onClick={toggleTheme} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"10px",padding:"8px 12px",color:"white",fontSize:"15px",cursor:"pointer"}}>{themeKey==="dark"?"☀️":"🌙"}</button>
          {!isMobile&&<button onClick={()=>setShowAddPanel(!showAddPanel)} style={{background:C.gradient,border:"none",borderRadius:"10px",padding:"8px 18px",color:"white",fontSize:"14px",fontWeight:700,cursor:"pointer",boxShadow:`0 4px 14px ${C.teal}33`}}>➕ Yeni Ekle</button>}
          <button onClick={doLogout} style={{background:"rgba(255,68,102,0.15)",border:"1px solid rgba(255,68,102,0.3)",borderRadius:"10px",padding:"8px 12px",color:"#ff8099",fontSize:"13px",cursor:"pointer",fontWeight:600}}>Çıkış</button>
        </div>
      </header>

      {/* DESKTOP */}
      {!isMobile?(
        <div style={{display:"flex",minHeight:"calc(100vh - 60px)"}}>
          <div style={{flex:1,padding:"28px",overflowY:"auto"}}>

            {tab==="list"&&(
              <div className="pg">
                <StatsBar events={events} C={C}/>
                <div style={{display:"flex",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:"240px"}}><SearchBar value={search} onChange={setSearch} C={C}/></div>
                  {!demoMode&&<button onClick={async()=>{const t=await getToken();if(t)loadEvents(t);}} disabled={loadingEvents} style={{padding:"12px 20px",borderRadius:"14px",border:"1px solid "+C.border,background:C.surface,color:C.teal,fontSize:"14px",fontWeight:700,cursor:"pointer",flexShrink:0}}>{loadingEvents?"⟳":"🔄"} Yenile</button>}
                </div>
                <FilterBar activeFilter={activeFilter} onFilter={setActiveFilter} C={C}/>
                <div style={{marginTop:"16px"}}>
                  {loadingEvents&&<div style={{textAlign:"center",padding:"60px",color:C.muted}}><div style={{fontSize:"40px"}}>⟳</div>Yükleniyor...</div>}
                  {!loadingEvents&&filteredEvents.length===0&&(
                    <div style={{textAlign:"center",padding:"80px",background:C.card,borderRadius:"20px",border:"1px solid "+C.border}}>
                      <div style={{fontSize:"56px",marginBottom:"16px"}}>{search?"🔍":"🗓️"}</div>
                      <div style={{color:C.muted,fontSize:"18px",marginBottom:"20px"}}>{search?`"${search}" için sonuç yok`:"Yaklaşan etkinlik yok"}</div>
                      {!search&&<button onClick={()=>setShowAddPanel(true)} style={{padding:"12px 32px",borderRadius:"12px",background:C.gradient,border:"none",color:"white",fontWeight:700,cursor:"pointer",fontSize:"16px"}}>+ Etkinlik Ekle</button>}
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(500px,1fr))",gap:"12px"}}>
                    {filteredEvents.map(e=><EventCard key={e.id} e={e} onClick={()=>setSelected(e)} C={C}/>)}
                  </div>
                </div>
              </div>
            )}

            {tab==="calendar"&&(
              <div className="pg">
                <h2 style={{margin:"0 0 20px",fontSize:"22px",fontWeight:700}}>Takvim</h2>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px"}}>
                  <CalendarGrid events={events} onDayClick={setDayEvents} C={C}/>
                  <div>
                    <div style={{fontWeight:600,fontSize:"13px",color:C.muted,marginBottom:"12px",textTransform:"uppercase",letterSpacing:0.5}}>Yaklaşan Etkinlikler</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                      {upcoming.slice(0,8).map(e=>(
                        <div key={e.id} onClick={()=>setSelected(e)} className="ec" style={{display:"flex",gap:"12px",padding:"12px 14px",background:C.card,borderRadius:"14px",cursor:"pointer",border:"1px solid "+C.border,borderLeft:`3px solid ${getCat(e).dot}`,transition:"all 0.15s"}}>
                          <div style={{minWidth:"40px",textAlign:"center"}}>
                            <div style={{fontSize:"10px",color:C.muted,textTransform:"uppercase"}}>{new Date(toUTC(e.start.dateTime)).toLocaleDateString("tr-TR",{month:"short"})}</div>
                            <div style={{fontSize:"20px",fontWeight:800,color:getCat(e).text,lineHeight:1}}>{new Date(toUTC(e.start.dateTime)).getDate()}</div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:"14px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</div>
                            <div style={{color:C.muted,fontSize:"12px",marginTop:"2px"}}>{fmtTime(e.start.dateTime)}{e.attendees?.length>0?` · 👥${e.attendees.length}`:""}</div>
                          </div>
                          <div style={{fontSize:"12px",fontWeight:700,color:C.warning,alignSelf:"center",flexShrink:0}}>{timeUntil(e.start.dateTime)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {showAddPanel&&(
            <div style={{width:"400px",background:C.surface,borderLeft:"1px solid "+C.border,padding:"28px",overflowY:"auto",boxShadow:"-4px 0 30px rgba(0,0,0,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
                <h3 style={{margin:0,fontSize:"18px",fontWeight:700}}>➕ Yeni Etkinlik</h3>
                <button onClick={()=>setShowAddPanel(false)} style={{background:C.tag,border:"none",color:C.muted,fontSize:"16px",cursor:"pointer",padding:"6px 10px",borderRadius:"8px"}}>✕</button>
              </div>
              <AddForm form={form} setForm={setForm} onSave={saveEvent} onCancel={()=>setShowAddPanel(false)} saving={saving} C={C}/>
            </div>
          )}
        </div>
      ):(
        /* MOBILE */
        <div style={{paddingBottom:"70px"}}>
          <div style={{padding:"16px"}}>
            {tab==="list"&&(
              <div className="pg">
                <StatsBar events={events} C={C}/>
                <div style={{marginBottom:"12px"}}><SearchBar value={search} onChange={setSearch} C={C}/></div>
                <div style={{marginBottom:"14px"}}><FilterBar activeFilter={activeFilter} onFilter={setActiveFilter} C={C}/></div>
                {loadingEvents&&<div style={{textAlign:"center",padding:"50px",color:C.muted}}><div style={{fontSize:"36px"}}>⟳</div>Yükleniyor...</div>}
                {!loadingEvents&&filteredEvents.length===0&&(
                  <div style={{textAlign:"center",padding:"50px",background:C.card,borderRadius:"16px",border:"1px solid "+C.border}}>
                    <div style={{fontSize:"48px",marginBottom:"12px"}}>{search?"🔍":"🗓️"}</div>
                    <div style={{color:C.muted,marginBottom:"16px"}}>{search?`"${search}" bulunamadı`:"Etkinlik yok"}</div>
                    {!search&&<button onClick={()=>setTab("add")} style={{padding:"12px 28px",borderRadius:"12px",background:C.gradient,border:"none",color:"white",fontWeight:700,cursor:"pointer",fontSize:"15px"}}>+ Ekle</button>}
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {filteredEvents.map(e=><EventCard key={e.id} e={e} onClick={()=>setSelected(e)} C={C}/>)}
                </div>
              </div>
            )}
            {tab==="calendar"&&(
              <div className="pg">
                <div style={{fontWeight:700,fontSize:"18px",marginBottom:"16px"}}>Takvim</div>
                <CalendarGrid events={events} onDayClick={setDayEvents} C={C}/>
                <div style={{marginTop:"20px"}}>
                  <div style={{fontWeight:600,fontSize:"13px",color:C.muted,marginBottom:"10px",textTransform:"uppercase",letterSpacing:0.5}}>Yaklaşan</div>
                  {upcoming.slice(0,5).map(e=>(
                    <div key={e.id} onClick={()=>setSelected(e)} style={{display:"flex",gap:"12px",padding:"12px",background:C.card,borderRadius:"14px",marginBottom:"8px",cursor:"pointer",border:"1px solid "+C.border,borderLeft:`3px solid ${getCat(e).dot}`}}>
                      <div style={{textAlign:"center",minWidth:"40px"}}>
                        <div style={{fontSize:"10px",color:C.muted,textTransform:"uppercase"}}>{new Date(toUTC(e.start.dateTime)).toLocaleDateString("tr-TR",{month:"short"})}</div>
                        <div style={{fontSize:"20px",fontWeight:800,color:getCat(e).text,lineHeight:1}}>{new Date(toUTC(e.start.dateTime)).getDate()}</div>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:"14px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</div>
                        <div style={{color:C.muted,fontSize:"12px",marginTop:"2px"}}>{fmtTime(e.start.dateTime)}{e.attendees?.length>0?` · 👥${e.attendees.length}`:""}</div>
                      </div>
                      <div style={{fontSize:"12px",fontWeight:700,color:C.warning,alignSelf:"center"}}>{timeUntil(e.start.dateTime)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab==="add"&&(
              <div className="pg">
                <div style={{fontWeight:700,fontSize:"18px",marginBottom:"16px"}}>➕ Yeni Etkinlik</div>
                <AddForm form={form} setForm={setForm} onSave={saveEvent} saving={saving} C={C}/>
              </div>
            )}
          </div>

          <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.navBg,borderTop:"1px solid "+C.border,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -4px 20px rgba(0,0,0,0.2)"}}>
            {[{id:"list",icon:"📋",label:"Etkinlikler"},{id:"calendar",icon:"🗓️",label:"Takvim"},{id:"add",icon:"➕",label:"Ekle"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",position:"relative"}}>
                <span style={{fontSize:t.id==="add"?"26px":"20px",filter:tab===t.id?"none":"grayscale(0.5) opacity(0.45)",transition:"all 0.2s"}}>{t.icon}</span>
                <span style={{fontSize:"11px",fontWeight:700,color:tab===t.id?C.teal:C.muted,transition:"all 0.2s"}}>{t.label}</span>
                {tab===t.id&&<div style={{position:"absolute",top:0,left:"20%",right:"20%",height:"2px",background:C.gradient,borderRadius:"0 0 4px 4px"}}/>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
