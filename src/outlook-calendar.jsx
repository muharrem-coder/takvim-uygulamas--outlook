/* eslint-disable */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── ANIMATION HELPERS ─────────────────────────────────────────────────────────
function useRipple() {
  const [ripples, setRipples] = useState([]);
  const addRipple = useCallback((e) => {
    const btn = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - btn.left, y = e.clientY - btn.top;
    const id = Date.now();
    setRipples(r => [...r, { x, y, id }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 600);
  }, []);
  return [ripples, addRipple];
}

function RippleButton({ onClick, style, children, disabled, className, ...props }) {
  const [ripples, addRipple] = useRipple();
  return (
    <button
      {...props}
      className={className}
      disabled={disabled}
      onClick={e => { if (!disabled) { addRipple(e); onClick && onClick(e); } }}
      style={{ ...style, position: "relative", overflow: "hidden", cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {ripples.map(r => (
        <span key={r.id} style={{
          position: "absolute", left: r.x - 60, top: r.y - 60,
          width: 120, height: 120, borderRadius: "50%",
          background: "rgba(255,255,255,0.25)", pointerEvents: "none",
          animation: "rippleAnim 0.6s ease-out forwards",
        }} />
      ))}
      {children}
    </button>
  );
}


// ── DOT MATRIX CANVAS ANIMATION ──────────────────────────────────────────────
function DotMatrix({ reverse = false, colors = [[0,212,255],[124,58,237]] }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const DOT = 3, GAP = 18, TOTAL = DOT + GAP;
    let w, h, cells = [];
    const startTime = performance.now();

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      const cols = Math.ceil(w / TOTAL) + 1;
      const rows = Math.ceil(h / TOTAL) + 1;
      const cx = w / 2 / TOTAL, cy = h / 2 / TOTAL;
      cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dist = Math.hypot(c - cx, r - cy);
          const rand  = Math.random() * 0.15;
          cells.push({
            x: c * TOTAL, y: r * TOTAL, dist,
            delay: reverse
              ? (Math.max(cx, cy) * 1.4 - dist) * 0.018 + rand
              : dist * 0.012 + rand,
            colorIdx: Math.floor(Math.random() * colors.length),
            opacity: 0.3 + Math.random() * 0.7,
          });
        }
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now) => {
      const t = (now - startTime) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const cell of cells) {
        let progress = t * 0.55 - cell.delay;
        let alpha;
        if (reverse) {
          alpha = Math.max(0, 1 - Math.max(0, progress) * 1.8) * cell.opacity;
        } else {
          alpha = Math.min(1, Math.max(0, progress) * 2) * cell.opacity;
          if (progress > 0.5) alpha *= 0.75 + 0.25 * Math.sin(t * 2 + cell.dist);
        }
        if (alpha < 0.01) continue;
        const [r, g, b] = colors[cell.colorIdx];
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.arc(cell.x + DOT/2, cell.y + DOT/2, DOT/2, 0, Math.PI * 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [reverse]);

  return <canvas ref={canvasRef} style={{position:"absolute",inset:0,width:"100%",height:"100%"}} />;
}

// ── THEME TOGGLE ──────────────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }) {
  return (
    <div onClick={onToggle} role="button" tabIndex={0}
      onKeyDown={e=>e.key==="Enter"&&onToggle()}
      style={{display:"flex",width:"56px",height:"28px",padding:"3px",borderRadius:"999px",cursor:"pointer",
        transition:"all 0.3s",background:isDark?"#18182e":"#f0f0ff",
        border:"1px solid "+(isDark?"#3a3a6a":"#d0d0f0"),
        position:"relative",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
      <div style={{position:"absolute",width:"22px",height:"22px",borderRadius:"50%",
        transition:"transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        transform:isDark?"translateX(0)":"translateX(28px)",
        background:isDark?"#4a3828":"#e8ddd0",
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        {isDark
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
      </div>
      <div style={{width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center",
        opacity:0.4,marginLeft:isDark?"auto":"0",marginRight:isDark?"0":"auto"}}>
        {isDark
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
      </div>
    </div>
  );
}


// ── GLOW BUTTON ───────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha = 1) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  if (isNaN(r)||isNaN(g)||isNaN(b)) return "rgba(0,0,0,1)";
  return `rgba(${r},${g},${b},${alpha})`;
}

function GlowButton({ children, onClick, glowColor="#e8a838", icon, isDark=true, style={} }) {
  const gc      = hexToRgba(glowColor);
  const gcVia   = hexToRgba(glowColor, 0.09);
  const gcTo    = hexToRgba(glowColor, 0.22);
  const gcGlow  = hexToRgba(glowColor, 0.45);
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position:"relative", overflow:"hidden",
        width:"100%", padding:"14px 20px",
        borderRadius:"14px", cursor:"pointer",
        display:"flex", alignItems:"center", gap:"12px",
        fontFamily:"inherit", fontSize:"15px", fontWeight:700,
        color: isDark ? "#f5f0eb" : "#1c1410",
        background: isDark
          ? `linear-gradient(to top, #1c1917, #262220)`
          : `linear-gradient(to top, #fff, #f5f0e8)`,
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)"}`,
        borderRight: "none",
        boxShadow: hov
          ? `0 0 0 1px ${hexToRgba(glowColor,0.3)}, 0 8px 32px ${hexToRgba(glowColor,0.2)}`
          : `0 1px 3px rgba(0,0,0,0.2)`,
        transition: "all 0.22s ease",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        ...style,
      }}
    >
      {/* Right glow bar */}
      <span style={{
        position:"absolute", right:0, top:"20%", width:"5px", height:"60%",
        borderRadius:"4px 0 0 4px",
        background: gc,
        boxShadow: `-3px 0 12px ${gcGlow}, -1px 0 6px ${gc}`,
        transform: hov ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.22s ease",
      }}/>
      {/* Gradient overlay right side */}
      <span style={{
        position:"absolute", inset:0, borderRadius:"14px", pointerEvents:"none",
        background: `linear-gradient(to right, transparent 40%, ${gcVia} 70%, ${gcTo} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,${isDark?0.07:0.6})`,
      }}/>
      {/* Content */}
      {icon && <span style={{fontSize:"20px",flexShrink:0,position:"relative",zIndex:1}}>{icon}</span>}
      <span style={{position:"relative",zIndex:1,flex:1,textAlign:"left"}}>{children}</span>
      <span style={{
        position:"relative",zIndex:1,fontSize:"14px",
        opacity: hov ? 0.9 : 0.45,
        transform: hov ? "translateX(-2px)" : "translateX(0)",
        transition:"all 0.2s ease",
        color: hov ? glowColor : "inherit",
      }}>→</span>
    </button>
  );
}


// ── APP ICON SVG ──────────────────────────────────────────────────────────────
function AppIcon({ size = 32, style = {} }) {
  const s = size / 512;
  return (
    <svg width={size} height={size} viewBox='0 0 512 512' fill='none' xmlns='http://www.w3.org/2000/svg' style={style}>
      <defs>
        <linearGradient id='ibg' x1='0' y1='0' x2='512' y2='512' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stopColor='#2a2218'/>
          <stop offset='100%' stopColor='#141210'/>
        </linearGradient>
        <linearGradient id='iamber' x1='0' y1='0' x2='512' y2='512' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stopColor='#c97c2e'/>
          <stop offset='100%' stopColor='#e8a838'/>
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width='512' height='512' rx='112' fill='url(#ibg)'/>
      <rect x='1' y='1' width='510' height='510' rx='111' fill='none' stroke='rgba(255,255,255,0.08)' strokeWidth='2'/>
      {/* Envelope body */}
      <rect x='52' y='202' width='285' height='202' rx='18' fill='#201c18' stroke='url(#iamber)' strokeWidth='10'/>
      {/* Envelope V fold */}
      <path d='M52 224 L194 302 L337 224' fill='none' stroke='url(#iamber)' strokeWidth='10' strokeLinejoin='round' opacity='0.85'/>
      <path d='M52 384 L144 318' fill='none' stroke='url(#iamber)' strokeWidth='7' opacity='0.35'/>
      <path d='M337 384 L245 318' fill='none' stroke='url(#iamber)' strokeWidth='7' opacity='0.35'/>
      {/* Calendar body */}
      <rect x='268' y='68' width='196' height='196' rx='22' fill='#1c1814' stroke='url(#iamber)' strokeWidth='11'/>
      {/* Calendar header */}
      <rect x='268' y='68' width='196' height='58' rx='22' fill='url(#iamber)' opacity='0.2'/>
      <rect x='268' y='104' width='196' height='22' fill='url(#iamber)' opacity='0.18'/>
      {/* Rings */}
      <rect x='306' y='44' width='15' height='54' rx='7' fill='url(#iamber)'/>
      <rect x='411' y='44' width='15' height='54' rx='7' fill='url(#iamber)'/>
      {/* Grid dots */}
      <circle cx='310' cy='180' r='7' fill='#e8a838' opacity='0.45'/>
      <circle cx='364' cy='180' r='7' fill='#e8a838' opacity='0.65'/>
      <circle cx='418' cy='180' r='7' fill='#e8a838' opacity='0.35'/>
      <circle cx='310' cy='224' r='7' fill='#e8a838' opacity='0.35'/>
      <circle cx='418' cy='224' r='7' fill='#e8a838' opacity='0.5'/>
      {/* Highlight cell */}
      <rect x='340' y='200' width='52' height='48' rx='10' fill='url(#iamber)' opacity='0.88'/>
      <text x='366' y='234' textAnchor='middle' fontFamily='Georgia,serif' fontSize='28' fontWeight='700' fill='#141210'>7</text>
      {/* Dashed arc */}
      <path d='M274 166 Q210 130 194 132' fill='none' stroke='url(#iamber)' strokeWidth='6' strokeDasharray='10 8' opacity='0.55'/>
      <circle cx='192' cy='133' r='9' fill='url(#iamber)' opacity='0.7'/>
    </svg>
  );
}

// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen({ loginMs, loginGoogle, loginYandex, loginDemo, themeKey, toggleTheme, C }) {
  const isDark = themeKey === "dark";
  const [dotReverse, setDotReverse] = useState(false);
  const [visible, setVisible]       = useState(true);

  const handleLogin = async (fn) => {
    setDotReverse(true);
    await new Promise(r => setTimeout(r, 250));
    setVisible(false);
    await new Promise(r => setTimeout(r, 220));
    fn();
  };

  // GlowButton handles its own hover state

  const dotColors = isDark
    ? [[200,140,50],[160,90,30],[220,160,70]]
    : [[180,100,25],[140,80,20],[200,130,50]];

  return (
    <div style={{minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",position:"relative",overflow:"hidden",background:isDark?"#141210":"#faf8f5"}}>
      <style>{`
        @keyframes loginFadeIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes logoFloat{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-14px) rotate(1.5deg)}}
        .l-card{animation:loginFadeIn 0.65s 0.1s ease both}
        .l-logo{animation:loginFadeIn 0.65s ease both}
        .l-pills{animation:loginFadeIn 0.65s 0.28s ease both}
      `}</style>

      {/* Dot matrix BG */}
      <div style={{position:"absolute",inset:0,zIndex:0}}>
        <DotMatrix reverse={dotReverse} colors={dotColors} />
        <div style={{position:"absolute",inset:0,background:isDark
          ?"radial-gradient(ellipse 70% 70% at 50% 50%, rgba(20,18,16,0.82) 0%, rgba(20,18,16,0.38) 65%, transparent 100%)"
          :"radial-gradient(ellipse 70% 70% at 50% 50%, rgba(250,248,245,0.90) 0%, rgba(250,248,245,0.5) 65%, transparent 100%)"
        }}/>
        <div style={{position:"absolute",top:0,left:0,right:0,height:"30%",
          background:"linear-gradient(to bottom,"+(isDark?"#141210":"#faf8f5")+",transparent)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"20%",
          background:"linear-gradient(to top,"+(isDark?"#141210":"#faf8f5")+",transparent)"}}/>
      </div>

      {/* Top bar */}
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:50,padding:"16px 24px",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        background:isDark?"rgba(20,18,16,0.6)":"rgba(250,248,245,0.6)",
        backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",
        borderBottom:"1px solid "+(isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)")}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"32px",height:"32px",borderRadius:"10px",background:C.gradient,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 4px 16px rgba(200,130,40,0.35)"}}>
            <MailCalIcon size={32} /></div>
          <span style={{fontWeight:800,fontSize:"15px",color:isDark?"#f5f0eb":"#1c1410",letterSpacing:"-0.3px"}}>
            Evrensel Takvim
          </span>
        </div>
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      </div>

      {/* Content */}
      <div style={{position:"relative",zIndex:10,minHeight:"100vh",display:"flex",
        flexDirection:"column",alignItems:"center",justifyContent:"center",
        padding:"24px",paddingTop:"80px",paddingBottom:"40px",
        opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(-16px)",
        transition:"opacity 0.25s ease, transform 0.25s ease"}}>

        {/* Logo */}
        <div className="l-logo" style={{textAlign:"center",marginBottom:"36px"}}>
          <div style={{fontSize:"76px",marginBottom:"10px",display:"inline-block",
            animation:"logoFloat 5s ease-in-out infinite",
            filter:"drop-shadow(0 0 28px "+(isDark?"rgba(232,168,56,0.45)":"rgba(184,98,26,0.3)")+")"}}>
            <MailCalIcon size={80} />
          </div>
          <h1 key={themeKey} style={{margin:0,fontSize:"clamp(24px,5vw,34px)",fontWeight:900,letterSpacing:"-0.8px",
            background:isDark?"linear-gradient(135deg,#c97c2e,#e8a838)":"linear-gradient(135deg,#a0521a,#c97c2e)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
            backgroundClip:"text",lineHeight:1.1,display:"inline-block"}}>
            Evrensel Takvim
          </h1>
          <p style={{color:isDark?"rgba(245,240,235,0.5)":"rgba(40,28,16,0.52)",
            marginTop:"10px",fontSize:"15px",fontWeight:400}}>
            Outlook & Google Calendar — tek uygulamada
          </p>
        </div>

        {/* Card */}
        <div className="l-card" style={{
          width:"100%",maxWidth:"400px",
          background:isDark?"rgba(28,24,20,0.92)":"rgba(255,255,253,0.93)",
          backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",
          borderRadius:"24px",padding:"32px",
          border:"1px solid "+(isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"),
          boxShadow:isDark
            ?"0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)"
            :"0 32px 80px rgba(60,30,10,0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}>
          <div style={{fontSize:"11px",fontWeight:700,letterSpacing:"1.8px",textTransform:"uppercase",
            color:isDark?"rgba(220,200,175,0.45)":"rgba(60,40,20,0.42)",
            textAlign:"center",marginBottom:"20px"}}>
            Hesabınızla giriş yapın
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <GlowButton onClick={()=>handleLogin(loginMs)} glowColor="#2581c4" icon="📘" isDark={isDark}>
              Microsoft Outlook ile Giriş
            </GlowButton>

            <GlowButton onClick={()=>handleLogin(loginGoogle)} glowColor="#4a9e6a" icon="📗" isDark={isDark}>
              Google Calendar ile Giriş
            </GlowButton>

            <GlowButton onClick={()=>handleLogin(loginYandex)} glowColor="#e8180c" icon="📧" isDark={isDark}>
              Yandex ile Giriş
            </GlowButton>

            <div style={{display:"flex",alignItems:"center",gap:"12px",margin:"4px 0"}}>
              <div style={{flex:1,height:"1px",background:isDark?"rgba(255,255,255,0.07)":"rgba(60,30,10,0.08)"}}/>
              <span style={{color:isDark?"rgba(200,175,145,0.35)":"rgba(60,40,20,0.35)",fontSize:"12px"}}>veya</span>
              <div style={{flex:1,height:"1px",background:isDark?"rgba(255,255,255,0.07)":"rgba(60,30,10,0.08)"}}/>
            </div>

            <GlowButton onClick={loginDemo} glowColor="#e8a838" icon="🎮" isDark={isDark}>
              Demo Olarak Dene
            </GlowButton>
          </div>

          <p style={{color:isDark?"rgba(200,175,145,0.38)":"rgba(60,40,20,0.38)",
            fontSize:"12px",textAlign:"center",marginTop:"20px",lineHeight:1.75}}>
            Outlook, Google veya Yandex hesabınızla giriş yapın.{" "}
            <span style={{color:isDark?"rgba(232,168,56,0.7)":"rgba(184,98,26,0.75)"}}>
              Birden fazla hesap
            </span>{" "}
            bağlayabilirsiniz.
          </p>
        </div>

        {/* Feature pills */}
        <div className="l-pills" style={{display:"flex",gap:"8px",marginTop:"24px",flexWrap:"wrap",justifyContent:"center"}}>
          {[
            {icon:"📋",label:"Birleşik Liste"},
            {icon:"🗓️",label:"Takvim"},
            {icon:"🔔",label:"Bildirimler"},
            {icon:"👥",label:"Davet Gönder"},
            {icon:"📧",label:"Yandex Mail"},
          ].map(f=>(
            <div key={f.label} style={{display:"flex",alignItems:"center",gap:"6px",
              padding:"6px 14px",borderRadius:"999px",
              background:isDark?"rgba(255,255,255,0.04)":"rgba(60,30,10,0.04)",
              border:"1px solid "+(isDark?"rgba(255,255,255,0.07)":"rgba(60,30,10,0.07)"),
              fontSize:"13px",color:isDark?"rgba(220,195,165,0.65)":"rgba(60,40,20,0.6)",
              backdropFilter:"blur(8px)"}}>
              <span>{f.icon}</span><span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Animated modal hook: call close() to animate then unmount
function useAnimatedModal(setter) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setClosing(false); setter(null); }, 300);
  }, [setter]);
  const closeBool = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setClosing(false); setter(false); }, 300);
  }, [setter]);
  return [closing, close, closeBool];
}

function AnimatedCard({ children, index = 0 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), index * 70);
    return () => clearTimeout(t);
  }, [index]);
  return (
    <div style={{
      transition: "opacity 0.45s ease, transform 0.45s ease",
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
    }}>
      {children}
    </div>
  );
}

function SkeletonCard({ C }) {
  return (
    <div style={{ background: C.card, borderRadius: "16px", padding: "16px 18px", border: "1px solid " + C.border, display: "flex", gap: "12px" }}>
      <div style={{ width: 48, height: 60, borderRadius: 12, background: C.border, animation: "shimmer 1.6s infinite" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 15, borderRadius: 8, background: C.border, width: "65%", animation: "shimmer 1.6s infinite" }} />
        <div style={{ height: 12, borderRadius: 8, background: C.border, width: "48%", animation: "shimmer 1.6s infinite 0.2s" }} />
        <div style={{ height: 11, borderRadius: 8, background: C.border, width: "32%", animation: "shimmer 1.6s infinite 0.35s" }} />
      </div>
      <div style={{ width: 56, display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
        <div style={{ height: 20, width: 56, borderRadius: 20, background: C.border, animation: "shimmer 1.6s infinite 0.1s" }} />
        <div style={{ height: 14, width: 40, borderRadius: 8, background: C.border, animation: "shimmer 1.6s infinite 0.3s" }} />
      </div>
    </div>
  );
}


// ── CONFIG ────────────────────────────────────────────────────────────────────
const MS_CLIENT_ID     = "774d7d5a-1c96-42e8-8ce0-41fa960bab14";
const GOOGLE_CLIENT_ID = "923407886232-76tom5gvm5b7cnrdeonknc5mjb63vv7i.apps.googleusercontent.com";
const YANDEX_CLIENT_ID = "f74a62cb05144593b55d5bbb9153971f";
const REDIRECT_URI     = window.location.origin;
const MS_SCOPES        = "openid profile User.Read Calendars.ReadWrite";
const MS_AUTH_URL      = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL     = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GG_SCOPES        = "https://www.googleapis.com/auth/calendar";
const GG_AUTH_URL      = "https://accounts.google.com/o/oauth2/v2/auth";
const YA_AUTH_URL      = "https://oauth.yandex.com/authorize";

// API Base URL - use local server in development, Vercel in production
const API_BASE = process.env.NODE_ENV === "development" 
  ? "http://localhost:3001" 
  : "/api";

// ── THEMES ────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    // Warm Dark — derin kahve-gri zeminler, amber vurgular
    bg:      "#141210",   // Çok koyu kahve-siyah
    surface: "#1c1917",   // Koyu kahve (stone-900)
    card:    "#231f1c",   // Biraz açık kahve
    header:  "#1a1614",   // Header için derin ton

    teal:    "#e8a838",   // Ana vurgu: altın-amber
    accent:  "#c97c2e",   // İkincil: koyu amber
    text:    "#f5f0eb",   // Ana metin: warm white
    muted:   "#8a7e72",   // Soluk metin: warm gray
    border:  "#2e2924",   // Kenarlık: warm dark
    success: "#65a86e",   // Başarı: sage green
    warning: "#d4943a",   // Uyarı: amber
    danger:  "#c0514a",   // Tehlike: muted red
    navBg:   "#1c1917",
    tag:     "#262220",   // Tag arka planı

    // Gradient: amber'dan warm gold'a
    gradient: "linear-gradient(135deg,#c97c2e,#e8a838)",
    ms:       "linear-gradient(135deg,#1e6ba8,#2581c4)",
    google:   "linear-gradient(135deg,#c0514a,#d4943a,#65a86e,#3a7bd5)",
    googleSolid: "linear-gradient(135deg,#3a7bd5,#65a86e)",
  },
  light: {
    // Cream Light — krem/warm white zeminler, amber vurgular
    bg:      "#faf8f5",   // Warm white krem
    surface: "#ffffff",   // Saf beyaz
    card:    "#fffefb",   // Hafif warm beyaz
    header:  "#2c2420",   // Koyu kahve header

    teal:    "#b8621a",   // Ana vurgu: koyu amber
    accent:  "#d4943a",   // İkincil: amber
    text:    "#1c1410",   // Ana metin: neredeyse siyah-kahve
    muted:   "#7a6e65",   // Soluk metin: warm gray
    border:  "#e8e0d5",   // Kenarlık: warm gray
    success: "#3d7a46",   // Başarı: forest green
    warning: "#a0621a",   // Uyarı: amber
    danger:  "#a03030",   // Tehlike: muted red
    navBg:   "#ffffff",
    tag:     "#f5f0e8",   // Tag: warm cream

    gradient: "linear-gradient(135deg,#a0521a,#c97c2e)",
    ms:       "linear-gradient(135deg,#1e6ba8,#2581c4)",
    google:   "linear-gradient(135deg,#c0514a,#d4943a,#3d7a46,#3a7bd5)",
    googleSolid: "linear-gradient(135deg,#3a7bd5,#3d7a46)",
  }
};

const CAT_COLORS_DARK = {
  "Toplantı": { bg:"#1e2a1e", text:"#7ab87a", dot:"#5a9e5a" },
  "Kişisel":  { bg:"#2a1e1a", text:"#d4936a", dot:"#c0714a" },
  "İş":       { bg:"#1e2030", text:"#7a9ec0", dot:"#5a82a8" },
  "Önemli":   { bg:"#2a1a1a", text:"#c07070", dot:"#a85050" },
  "Diğer":    { bg:"#252018", text:"#c0a870", dot:"#a08050" },
};
const CAT_COLORS_LIGHT = {
  "Toplantı": { bg:"#e8f5e8", text:"#2d6a2d", dot:"#3d8a3d" },
  "Kişisel":  { bg:"#fdf0e8", text:"#8a4010", dot:"#b05a20" },
  "İş":       { bg:"#e8eff8", text:"#1a3f6a", dot:"#2a5f9a" },
  "Önemli":   { bg:"#fae8e8", text:"#7a1a1a", dot:"#a02a2a" },
  "Diğer":    { bg:"#f5f0e0", text:"#5a4010", dot:"#7a5820" },
};
// Will be set based on theme - default dark
let CAT_COLORS = CAT_COLORS_DARK;
const getCat = e => CAT_COLORS[e.categories?.[0] || e._category] || CAT_COLORS["Diğer"];
const REMINDERS = [{l:"5 dk",v:5},{l:"15 dk",v:15},{l:"30 dk",v:30},{l:"1 sa",v:60},{l:"1 gün",v:1440},{l:"2 gün",v:2880}];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const pad      = n => String(n).padStart(2,"0");

// Safely parse any date string into a valid Date object
const safeParse = d => {
  if (!d) return new Date(NaN);
  // Already ISO with time: "2024-03-15T10:00:00Z" or "2024-03-15T10:00:00+03:00"
  if (d.includes("T")) {
    // No timezone suffix → treat as UTC
    if (!d.endsWith("Z") && !d.includes("+") && !/\d{2}:\d{2}$/.test(d.slice(-5))) {
      return new Date(d + "Z");
    }
    return new Date(d);
  }
  // Date-only: "2024-03-15" → parse as local midnight
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
};

const toUTC    = d => !d ? "" : (d.includes("T") ? (d.endsWith("Z")||d.includes("+") ? d : d+"Z") : d+"T00:00:00Z");
const fmtDT    = d => { const x=safeParse(d); return isNaN(x)?"-":x.toLocaleString("tr-TR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
const fmtInput = d => { const x=new Date(d); return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const fmtTime  = d => { const x=safeParse(d); return isNaN(x)?"-":x.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}); };
const fmtShort = d => { const x=safeParse(d); return isNaN(x)?"-":x.toLocaleDateString("tr-TR",{weekday:"short",day:"numeric",month:"short"}); };
const timeUntil = d => {
  const x = safeParse(d); if (isNaN(x)) return "-";
  const diff = x - Date.now();
  if (diff < 0) return "Geçti";
  const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
  if (h > 48) return `${Math.floor(h/24)} gün`;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m} dk`;
};
const isUrgent = d => { const x=safeParse(d); if(isNaN(x))return false; const diff=x-Date.now(); return diff>0&&diff<3600000; };
const isPast   = d => { const x=safeParse(d); return isNaN(x)?false:x<Date.now(); };
const getStartDT = e => e.start?.dateTime || e.start?.date || "";
const getEndDT   = e => e.end?.dateTime   || e.end?.date   || "";

// Normalize event from either source into unified format
function normalizeEvent(e, source) {
  if (source === "google") {
    // Google returns dateTime (with timezone) or date (all-day, YYYY-MM-DD)
    const startDT = e.start?.dateTime || (e.start?.date ? e.start.date + "T00:00:00" : "");
    const endDT   = e.end?.dateTime   || (e.end?.date   ? e.end.date   + "T00:00:00" : "");
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

// ── MAIL-CALENDAR SVG ICON ────────────────────────────────────────────────────
function MailCalIcon({ size = 32, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <defs>
        <linearGradient id="mcBg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#231f1c"/>
          <stop offset="100%" stopColor="#1a1614"/>
        </linearGradient>
        <linearGradient id="mcAmber" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c97c2e"/>
          <stop offset="100%" stopColor="#e8a838"/>
        </linearGradient>
        <linearGradient id="mcMail" x1="60" y1="200" x2="340" y2="420" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2a2218"/>
          <stop offset="100%" stopColor="#1c1814"/>
        </linearGradient>
      </defs>
      {/* Arka plan */}
      <rect width="512" height="512" rx="112" fill="url(#mcBg)"/>
      <rect x="1" y="1" width="510" height="510" rx="111" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2"/>
      {/* Zarf gövde */}
      <rect x="52" y="210" width="288" height="198" rx="20" fill="url(#mcMail)" stroke="url(#mcAmber)" strokeWidth="14"/>
      {/* Zarf V kapak */}
      <path d="M52 228 L196 328 L340 228" fill="none" stroke="url(#mcAmber)" strokeWidth="14" strokeLinejoin="round"/>
      {/* Alt köşe çizgiler */}
      <path d="M52 390 L148 312" fill="none" stroke="rgba(232,168,56,0.28)" strokeWidth="9"/>
      <path d="M340 390 L244 312" fill="none" stroke="rgba(232,168,56,0.28)" strokeWidth="9"/>
      {/* Takvim gövde */}
      <rect x="276" y="72" width="190" height="192" rx="24" fill="#1c1917" stroke="url(#mcAmber)" strokeWidth="12"/>
      {/* Takvim üst bar */}
      <rect x="276" y="72" width="190" height="58" rx="24" fill="url(#mcAmber)" fillOpacity="0.22"/>
      <rect x="276" y="110" width="190" height="20" fill="url(#mcAmber)" fillOpacity="0.22"/>
      {/* Halkalar */}
      <rect x="316" y="48" width="17" height="54" rx="8.5" fill="url(#mcAmber)"/>
      <rect x="429" y="48" width="17" height="54" rx="8.5" fill="url(#mcAmber)"/>
      {/* Grid noktaları */}
      <circle cx="312" cy="172" r="7" fill="#e8a838" fillOpacity="0.4"/>
      <circle cx="371" cy="172" r="7" fill="#e8a838" fillOpacity="0.7"/>
      <circle cx="430" cy="172" r="7" fill="#e8a838" fillOpacity="0.3"/>
      <circle cx="312" cy="220" r="7" fill="#e8a838" fillOpacity="0.3"/>
      <circle cx="430" cy="220" r="7" fill="#e8a838" fillOpacity="0.5"/>
      {/* Vurgulu gün */}
      <rect x="344" y="196" width="54" height="52" rx="10" fill="url(#mcAmber)" fillOpacity="0.9"/>
      {/* Bağlantı çizgisi */}
      <path d="M338 262 Q308 230 290 210" fill="none" stroke="url(#mcAmber)" strokeWidth="7" strokeDasharray="8 6" strokeOpacity="0.55"/>
      <polygon points="282,202 300,202 291,220" fill="#e8a838" fillOpacity="0.7"/>
      {/* Üst ışık */}
      <rect x="112" y="1" width="288" height="2" rx="1" fill="rgba(255,255,255,0.08)"/>
    </svg>
  );
}

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
    const d=safeParse(getStartDT(e));
    if(!isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m){ if(!byDay[d.getDate()])byDay[d.getDate()]=[];byDay[d.getDate()].push(e); }
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
  const todayEvs=events.filter(e=>{ const d=safeParse(getStartDT(e)),n=new Date(); return d.getDate()===n.getDate()&&d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); });
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
function EventCard({ e, onClick, C, onRemove }) {
  const cat=getCat(e), past=isPast(getEndDT(e)), urgent=isUrgent(getStartDT(e));
  const startDT=getStartDT(e);
  const [removing, setRemoving] = useState(false);
  const handleDelete = (ev) => {
    ev.stopPropagation();
    setRemoving(true);
    setTimeout(() => onRemove && onRemove(e), 430);
  };
  return (
    <div className={"ec" + (removing ? " ec-removing" : "")} onClick={removing ? undefined : onClick} style={{background:C.card,borderRadius:"16px",padding:"14px 16px",border:`1px solid ${urgent?"rgba(255,68,102,0.4)":C.border}`,cursor:removing?"default":"pointer",opacity:past?0.5:1,display:"flex",gap:"12px",alignItems:"flex-start"}}>
      <div style={{minWidth:"48px",textAlign:"center",background:cat.bg,borderRadius:"12px",padding:"7px 4px",flexShrink:0}}>
        <div style={{fontSize:"9px",color:cat.text,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{safeParse(startDT).toLocaleDateString("tr-TR",{month:"short"})}</div>
        <div style={{fontSize:"21px",fontWeight:800,color:cat.text,lineHeight:1.1}}>{safeParse(startDT).getDate()}</div>
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
function DetailModal({ event, onClose, onDelete, C, isMobile, isClosing }) {
  const cat=getCat(event);
  const startDT=getStartDT(event), endDT=getEndDT(event);
  const closing = isClosing;
  const handleClose = onClose;
  const wrap=isMobile?{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end"}:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"};
  const box=isMobile?{background:C.surface,borderRadius:"24px 24px 0 0",padding:"24px",width:"100%",maxHeight:"85vh",overflowY:"auto"}:{background:C.surface,borderRadius:"24px",padding:"32px",width:"100%",maxWidth:"520px",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.5)"};
  return (
    <div onClick={handleClose} className={closing?"modal-backdrop-out":"modal-backdrop"} style={wrap}>
      <div onClick={e=>e.stopPropagation()} className={closing?(isMobile?"modal-content-mobile-out":"modal-content-desktop-out"):(isMobile?"modal-content-mobile":"modal-content-desktop")} style={box}>
        {isMobile&&<div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 20px"}}/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"8px",flexWrap:"wrap"}}>
              <span style={{fontSize:"12px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",background:cat.bg,color:cat.text}}>{event.categories?.[0]||event._category||"Diğer"}</span>
              <SourceBadge source={event._source}/>
            </div>
            <h2 style={{margin:0,fontSize:"20px",fontWeight:800,lineHeight:1.3}}>{event.subject}</h2>
          </div>
          {!isMobile&&<button onClick={handleClose} style={{background:"none",border:"none",color:C.muted,fontSize:"22px",cursor:"pointer",marginLeft:"12px"}}>✕</button>}
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
          <button onClick={handleClose} style={{flex:1,padding:"13px",borderRadius:"12px",background:C.tag,border:"none",color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer"}}>Kapat</button>
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
        <RippleButton onClick={onSave} disabled={saving} style={{flex:2,padding:"14px",borderRadius:"14px",background:saving?"#333":C.gradient,border:"none",color:"white",fontSize:"16px",fontWeight:700,boxShadow:saving?"none":`0 4px 20px ${C.teal}33`,transition:"all 0.2s"}}>
          {saving?"⏳ Kaydediliyor...":"✅ Kaydet"}
        </RippleButton>
      </div>
    </div>
  );
}

// ── ACCOUNT PANEL ─────────────────────────────────────────────────────────────
// ── YANDEX MAIL SECTION ───────────────────────────────────────────────────────
function YandexMailSection({ C, yandexUser, onClose }) {
  const [appPass, setAppPass]     = useState(sessionStorage.getItem("ya_app_pass")||"");
  const [loading, setLoading]     = useState(false);
  const [mails, setMails]         = useState([]);
  const [error, setError]         = useState("");
  const [scanning, setScanning]   = useState(false);
  const [events, setEvents]       = useState([]);
  const [savedPass, setSavedPass] = useState(!!sessionStorage.getItem("ya_app_pass"));

  const email = yandexUser?.default_email || yandexUser?.login
    ? (yandexUser.default_email || yandexUser.login + "@yandex.ru")
    : "";

  const savePass = () => {
    sessionStorage.setItem("ya_app_pass", appPass);
    setSavedPass(true);
  };

  const scanMails = async () => {
    if (!appPass) return;
    setLoading(true); setError(""); setMails([]); setEvents([]);
    try {
      const res = await fetch(`${API_BASE}/yandex-mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, appPassword: appPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bağlantı hatası");
      setMails(data.messages || []);
      // AI ile event tara
      setScanning(true);
      const found = [];
      for (const mail of data.messages) {
        try {
          if (!mail.subject && !mail.body) continue;
          const r = await fetch(`${API_BASE}/parse-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject: mail.subject, body: mail.body, from: mail.from, date: mail.date }),
          });
          if (!r.ok) continue;
          const text = await r.text();
          if (!text || text.trim() === "") continue;
          let parsed;
          try { parsed = JSON.parse(text); } catch { continue; }
          if (parsed && parsed.event && parsed.event.title && parsed.event.start) {
            found.push({ ...parsed.event, _from: mail.from, _subject: mail.subject });
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch {}
      }
      setEvents(found);
      setScanning(false);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{background:C.card,borderRadius:"16px",padding:"18px",border:`1px solid rgba(232,24,12,0.2)`,marginBottom:"16px"}}>
      <div style={{fontWeight:700,fontSize:"14px",color:C.text,marginBottom:"12px"}}>📧 Yandex Mail Tarama</div>

      {/* Email göster */}
      <div style={{fontSize:"12px",color:C.muted,marginBottom:"10px"}}>Hesap: <span style={{color:C.teal}}>{email}</span></div>

      {/* App password input */}
      <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
        <input
          type="password"
          placeholder="Uygulama şifresi (16 karakter)"
          value={appPass}
          onChange={e=>setAppPass(e.target.value)}
          style={{flex:1,padding:"10px 12px",borderRadius:"10px",border:`1px solid ${C.border}`,
            background:C.surface,color:C.text,fontSize:"13px",outline:"none"}}
        />
        <RippleButton onClick={savePass} style={{padding:"10px 14px",borderRadius:"10px",
          background:C.tag,border:`1px solid ${C.border}`,color:C.muted,fontSize:"13px",fontWeight:600}}>
          💾
        </RippleButton>
        <RippleButton onClick={scanMails} disabled={!appPass||loading}
          style={{padding:"10px 16px",borderRadius:"10px",background:"rgba(232,24,12,0.15)",
            border:"1px solid rgba(232,24,12,0.3)",color:"#e8180c",fontSize:"13px",fontWeight:700}}>
          {loading ? "⏳" : "Tara"}
        </RippleButton>
      </div>

      {savedPass && !loading && mails.length===0 && !error &&
        <div style={{fontSize:"12px",color:C.muted}}>✅ Şifre kaydedildi. "Tara" butonuna basın.</div>}

      {error && <div style={{fontSize:"12px",color:"#e8180c",padding:"8px",background:"rgba(232,24,12,0.1)",borderRadius:"8px"}}>{error}</div>}

      {scanning && <div style={{fontSize:"12px",color:C.muted,marginTop:"8px"}}>🤖 AI mailler analiz ediyor...</div>}

      {/* Bulunan etkinlikler */}
      {events.length > 0 && (
        <div style={{marginTop:"12px"}}>
          <div style={{fontSize:"12px",fontWeight:700,color:C.teal,marginBottom:"8px"}}>
            🎉 {events.length} etkinlik bulundu!
          </div>
          {events.map((ev, i) => (
            <FoundEventCard key={i} ev={ev} C={C} onClose={onClose} />
          ))}
        </div>
      )}

      {!loading && !scanning && mails.length > 0 && events.length === 0 &&
        <div style={{fontSize:"12px",color:C.muted,marginTop:"8px"}}>📭 Maillerinizde takvim etkinliği bulunamadı.</div>}

      {/* Yardım linki */}
      <div style={{fontSize:"11px",color:C.muted,marginTop:"10px",lineHeight:1.6}}>
        Uygulama şifresi nasıl oluşturulur?{" "}
        <a href="https://id.yandex.com/security/app-passwords" target="_blank" rel="noreferrer"
          style={{color:C.teal}}>id.yandex.com →</a>
      </div>
    </div>
  );
}

function FoundEventCard({ ev, C, onClose }) {
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [target, setTarget]   = useState("outlook");

  const save = async () => {
    setSaving(true);
    // ms_token veya gg_token al
    const msToken  = sessionStorage.getItem("ms_token");
    const ggToken  = sessionStorage.getItem("gg_token");
    const token    = target === "outlook" ? msToken : ggToken;
    if (!token) { alert("Önce " + (target==="outlook"?"Outlook":"Google") + " hesabına giriş yapın!"); setSaving(false); return; }

    try {
      if (target === "outlook") {
        const body = {
          subject: ev.title,
          start: { dateTime: ev.start, timeZone: "Europe/Istanbul" },
          end:   { dateTime: ev.end || ev.start, timeZone: "Europe/Istanbul" },
          location: { displayName: ev.location || "" },
          body: { contentType: "text", content: ev.description || "" },
        };
        const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) setSaved(true);
      } else {
        const body = {
          summary: ev.title,
          start: { dateTime: ev.start, timeZone: "Europe/Istanbul" },
          end:   { dateTime: ev.end || ev.start, timeZone: "Europe/Istanbul" },
          location: ev.location || "",
          description: ev.description || "",
        };
        const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) setSaved(true);
      }
    } catch {}
    setSaving(false);
  };

  return (
    <div style={{background:C.surface,borderRadius:"12px",padding:"14px",border:`1px solid ${C.border}`,marginBottom:"8px"}}>
      <div style={{fontWeight:700,fontSize:"13px",color:C.text,marginBottom:"4px"}}>📅 {ev.title}</div>
      <div style={{fontSize:"12px",color:C.muted,marginBottom:"2px"}}>🕐 {ev.start?.replace("T"," ").substring(0,16)}</div>
      {ev.location && <div style={{fontSize:"12px",color:C.muted,marginBottom:"2px"}}>📍 {ev.location}</div>}
      {ev.description && <div style={{fontSize:"11px",color:C.muted,marginBottom:"8px",lineHeight:1.5}}>{ev.description}</div>}
      <div style={{fontSize:"11px",color:C.muted,marginBottom:"8px"}}>📨 {ev._from}</div>

      {!saved ? (
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <select value={target} onChange={e=>setTarget(e.target.value)}
            style={{padding:"6px 10px",borderRadius:"8px",border:`1px solid ${C.border}`,
              background:C.tag,color:C.text,fontSize:"12px",flex:1}}>
            <option value="outlook">📘 Outlook'a Ekle</option>
            <option value="google">📗 Google'a Ekle</option>
          </select>
          <RippleButton onClick={save} disabled={saving}
            style={{padding:"7px 14px",borderRadius:"8px",background:C.gradient,
              border:"none",color:"white",fontSize:"12px",fontWeight:700}}>
            {saving ? "⏳" : "Ekle"}
          </RippleButton>
        </div>
      ) : (
        <div style={{fontSize:"12px",color:"#65a86e",fontWeight:700}}>✅ Takvime eklendi!</div>
      )}
    </div>
  );
}

function AccountPanel({ msUser, googleUser, yandexUser, onConnectMs, onConnectGoogle, onConnectYandex, onDisconnectMs, onDisconnectGoogle, onDisconnectYandex, C, isMobile, onClose, isClosing }) {
  const closing = isClosing;
  const handleClose = onClose;
  const wrap = isMobile
    ? {position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex:300,display:"flex",alignItems:"flex-end"}
    : {position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"};
  const box = isMobile
    ? {background:C.surface,borderRadius:"28px 28px 0 0",padding:"28px 24px 32px",width:"100%",maxHeight:"90vh",overflowY:"auto"}
    : {background:C.surface,borderRadius:"28px",padding:"36px",width:"100%",maxWidth:"480px",boxShadow:"0 40px 100px rgba(0,0,0,0.55)"};

  const AccountRow = ({ icon, title, subtitle, connected, user, onConnect, onDisconnect, accentColor, bgColor }) => (
    <div style={{background:C.card,borderRadius:"20px",padding:"20px",border:`1px solid ${connected ? accentColor+"44" : C.border}`,transition:"all 0.3s ease",boxShadow:connected?`0 4px 20px ${accentColor}22`:"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
        {/* Icon */}
        <div style={{width:"52px",height:"52px",borderRadius:"16px",background:bgColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",flexShrink:0,boxShadow:`0 4px 14px ${accentColor}33`}}>
          {icon}
        </div>
        {/* Info */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:"16px",color:C.text}}>{title}</div>
          {connected && user ? (
            <div style={{fontSize:"13px",color:C.muted,marginTop:"3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              <span style={{color:accentColor,fontWeight:600}}>✓ Bağlı</span>
              {" · "}{user.displayName||user.name||user.mail||user.email}
            </div>
          ) : (
            <div style={{fontSize:"13px",color:C.muted,marginTop:"3px"}}>Bağlı değil</div>
          )}
        </div>
        {/* Button */}
        {connected ? (
          <RippleButton onClick={onDisconnect} style={{padding:"9px 16px",borderRadius:"12px",background:"rgba(255,68,102,0.1)",border:"1px solid rgba(255,68,102,0.25)",color:"#ff4466",fontSize:"13px",fontWeight:700,flexShrink:0,transition:"all 0.2s"}}>
            Çıkış
          </RippleButton>
        ) : (
          <RippleButton onClick={onConnect} style={{padding:"9px 16px",borderRadius:"12px",background:`${accentColor}22`,border:`1px solid ${accentColor}44`,color:accentColor,fontSize:"13px",fontWeight:700,flexShrink:0,transition:"all 0.2s"}}>
            Bağlan
          </RippleButton>
        )}
      </div>
      {/* Connected details */}
      {connected && user && (
        <div style={{marginTop:"14px",padding:"12px 14px",background:C.tag,borderRadius:"12px",display:"flex",gap:"10px",alignItems:"center"}}>
          <div style={{width:"32px",height:"32px",borderRadius:"50%",background:`${accentColor}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontWeight:800,color:accentColor,flexShrink:0}}>
            {((user.displayName||user.name||user.mail||user.email||"?")[0]).toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"13px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.displayName||user.name||"Kullanıcı"}</div>
            <div style={{fontSize:"12px",color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.mail||user.userPrincipalName||user.email||""}</div>
          </div>
          <div style={{fontSize:"11px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",background:`${accentColor}22`,color:accentColor,flexShrink:0}}>Aktif</div>
        </div>
      )}
    </div>
  );

  return (
    <div onClick={handleClose} className={closing?"modal-backdrop-out":"modal-backdrop"} style={wrap}>
      <div onClick={e=>e.stopPropagation()} className={closing?(isMobile?"modal-content-mobile-out":"modal-content-desktop-out"):(isMobile?"modal-content-mobile":"modal-content-desktop")} style={box}>
        {isMobile && <div style={{width:"44px",height:"5px",background:C.border,borderRadius:"3px",margin:"0 auto 24px"}}/>}

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <div>
            <h3 style={{margin:0,fontSize:"22px",fontWeight:800,color:C.text}}>🔗 Hesap Bağlantıları</h3>
            <p style={{margin:"4px 0 0",fontSize:"13px",color:C.muted}}>
              {[msUser,googleUser,yandexUser].filter(Boolean).length} / 3 hesap bağlı
            </p>
          </div>
          {!isMobile && (
            <button onClick={handleClose} style={{background:C.tag,border:"none",color:C.muted,fontSize:"18px",cursor:"pointer",padding:"8px 12px",borderRadius:"12px",transition:"all 0.2s" }}>✕</button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{marginBottom:"24px"}}>
          <div style={{height:"6px",background:C.border,borderRadius:"3px",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:"3px",background:C.gradient,width:`${[msUser,googleUser,yandexUser].filter(Boolean).length * 33.33}%`,transition:"width 0.6s cubic-bezier(0.34,1.56,0.64,1)"}}/> 
          </div>
        </div>

        {/* Account rows */}
        <div style={{display:"flex",flexDirection:"column",gap:"14px",marginBottom:"24px"}}>
          <AccountRow
            icon="📘" title="Microsoft Outlook" connected={!!msUser} user={msUser}
            onConnect={onConnectMs} onDisconnect={onDisconnectMs}
            accentColor="#0078d4" bgColor="rgba(0,120,212,0.2)"
          />
          <AccountRow
            icon="📗" title="Google Calendar" connected={!!googleUser} user={googleUser}
            onConnect={onConnectGoogle} onDisconnect={onDisconnectGoogle}
            accentColor="#4285f4" bgColor="rgba(66,133,244,0.2)"
          />
          <AccountRow
            icon="📧" title="Yandex Mail" connected={!!yandexUser} user={yandexUser}
            onConnect={onConnectYandex} onDisconnect={onDisconnectYandex}
            accentColor="#e8180c" bgColor="rgba(232,24,12,0.15)"
          />
        </div>

        {/* Info note */}
        <div style={{padding:"14px 16px",background:C.tag,borderRadius:"14px",fontSize:"13px",color:C.muted,lineHeight:1.6,marginBottom:"20px"}}>
          💡 Yandex Mail'den etkinlik taramak için <strong style={{color:C.teal}}>uygulama şifresi</strong> gereklidir. <a href="https://id.yandex.com/security/app-passwords" target="_blank" rel="noreferrer" style={{color:C.teal}}>Buradan oluşturun →</a>
        </div>

        {/* Yandex App Password input — only show if yandex connected */}
        {yandexUser && <YandexMailSection C={C} yandexUser={yandexUser} onClose={onClose} />}

        <RippleButton onClick={handleClose} style={{width:"100%",padding:"14px",borderRadius:"14px",background:C.gradient,border:"none",color:"white",fontSize:"15px",fontWeight:700}}>
          Tamam
        </RippleButton>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const [themeKey, setThemeKey] = useState(()=>localStorage.getItem("theme")||"dark");
  const C = THEMES[themeKey];
  // Update category colors based on theme
  CAT_COLORS = themeKey === "dark" ? CAT_COLORS_DARK : CAT_COLORS_LIGHT;
  const toggleTheme = ()=>{ const t=themeKey==="dark"?"light":"dark"; setThemeKey(t); localStorage.setItem("theme",t); };

  // Auth states
  const [msUser,  setMsUser]  = useState(null);
  const [ggUser,  setGgUser]  = useState(null);
  const [yaUser,  setYaUser]  = useState(null);

  // Events
  const [msEvents, setMsEvents]   = useState([]);
  const [ggEvents, setGgEvents]   = useState([]);
  const [loadingMs, setLoadingMs] = useState(false);
  const [loadingGg, setLoadingGg] = useState(false);

  // UI
  const [screen,        setScreen]        = useState("login");
  const [tab,           setTab]           = useState("list");
  const [prevTab,       setPrevTab]       = useState("list");
  const tabOrder = ["list","calendar","add"];
  const changeTab = useCallback((newTab) => {
    setPrevTab(t => t);
    setTab(prev => { setPrevTab(prev); return newTab; });
  }, []);
  const getPageClass = (currentTab) => {
    const tabOrder = ["list","calendar","add"];
    const curr = tabOrder.indexOf(currentTab), prev = tabOrder.indexOf(prevTab);
    if (curr === prev) return "pg-up";
    return curr > prev ? "pg-right" : "pg-left";
  };
  const [selected,      setSelected]      = useState(null);
  const [selectedClosing, setSelectedClosing] = useState(false);
  const closeSelected = useCallback(() => {
    setSelectedClosing(true);
    setTimeout(() => { setSelectedClosing(false); setSelected(null); }, 320);
  }, []);
  const [dayEvents,     setDayEvents]     = useState(null);
  const [dayEventsClosing, setDayEventsClosing] = useState(false);
  const closeDayEvents = useCallback(() => {
    setDayEventsClosing(true);
    setTimeout(() => { setDayEventsClosing(false); setDayEvents(null); }, 300);
  }, []);
  const [toast,         setToast]         = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [showAddPanel,  setShowAddPanel]  = useState(false);
  const [addPanelClosing, setAddPanelClosing] = useState(false);
  const closeAddPanel = useCallback(() => {
    setAddPanelClosing(true);
    setTimeout(() => { setAddPanelClosing(false); setShowAddPanel(false); }, 320);
  }, []);
  const [showAccounts,  setShowAccounts]  = useState(false);
  const [accountsClosing, setAccountsClosing] = useState(false);
  const closeAccounts = useCallback(() => {
    setAccountsClosing(true);
    setTimeout(() => { setAccountsClosing(false); setShowAccounts(false); }, 320);
  }, []);
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
    return [...ms,...gg].sort((a,b)=>safeParse(getStartDT(a))-safeParse(getStartDT(b)));
  },[msEvents,ggEvents]);

  const filteredEvents = useMemo(()=>{
    let evs = allEvents.filter(e=>safeParse(getStartDT(e))>Date.now()-3600000);
    if(search) evs=evs.filter(e=>
      e.subject?.toLowerCase().includes(search.toLowerCase())||
      e.location?.displayName?.toLowerCase().includes(search.toLowerCase())||
      e.bodyPreview?.toLowerCase().includes(search.toLowerCase())
    );
    if(activeFilter==="outlook")  evs=evs.filter(e=>e._source==="outlook");
    else if(activeFilter==="google") evs=evs.filter(e=>e._source==="google");
    else if(activeFilter==="urgent") evs=evs.filter(e=>isUrgent(getStartDT(e)));
    else if(activeFilter==="today") evs=evs.filter(e=>{ const d=safeParse(getStartDT(e)),n=new Date(); return d.getDate()===n.getDate()&&d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); });
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
    const yaToken=sessionStorage.getItem("ya_token"), yaExpiry=sessionStorage.getItem("ya_expiry");
    let hasSession=false;
    if(msToken&&msExpiry&&Date.now()<parseInt(msExpiry)){ loadMsUser(msToken); loadMsEvents(msToken); hasSession=true; }
    if(ggToken&&ggExpiry&&Date.now()<parseInt(ggExpiry)){ loadGgUser(ggToken); loadGgEvents(ggToken); hasSession=true; }
    if(yaToken&&yaExpiry&&Date.now()<parseInt(yaExpiry)){ loadYaUser(yaToken); hasSession=true; }
    if(hasSession) setScreen("app");
  },[]);

  // Notification timers
  useEffect(()=>{
    if(notifPerm!=="granted"||allEvents.length===0) return;
    const timers=allEvents.map(e=>{
      const delay=safeParse(getStartDT(e)).getTime()-(e.reminderMinutesBeforeStart||15)*60000-Date.now();
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
      if(data.items) setGgEvents(data.items.filter(e=>e.status!=="cancelled"));
    } catch { showToast("Google Calendar yüklenemedi","error"); }
    setLoadingGg(false);
  };
  const disconnectGoogle=()=>{ ["gg_token","gg_expiry"].forEach(k=>sessionStorage.removeItem(k)); setGgUser(null); setGgEvents([]); };

  // ── Yandex Auth ────────────────────────────────────────────────────────────
  const loginYandex=()=>{
    const s=Math.random().toString(36).substring(2);
    sessionStorage.setItem("ya_state",s);
    const params=new URLSearchParams({
      client_id: YANDEX_CLIENT_ID,
      response_type: "token",
      redirect_uri: REDIRECT_URI,
      state: s,
      force_confirm: "no",
    });
    window.location.href=`${YA_AUTH_URL}?${params}`;
  };

  // Yandex implicit flow — token in URL hash
  useEffect(()=>{
    const hash=window.location.hash;
    if(!hash.includes("access_token")) return;
    const params=new URLSearchParams(hash.substring(1));
    const token=params.get("access_token"), expiresIn=params.get("expires_in"), state=params.get("state");
    if(!token) return;
    // Only handle if ya_state is set (Yandex login)
    const yaState=sessionStorage.getItem("ya_state");
    if(!yaState) return;
    if(state && state!==yaState) return;
    sessionStorage.removeItem("ya_state");
    window.history.replaceState({},document.title,window.location.pathname);
    sessionStorage.setItem("ya_token",token);
    sessionStorage.setItem("ya_expiry",String(Date.now()+parseInt(expiresIn||3600)*1000));
    loadYaUser(token);
    setScreen("app");
  },[]);

  const loadYaUser=async(token)=>{
    try{
      const r=await fetch("https://login.yandex.ru/info?format=json",{headers:{Authorization:`OAuth ${token}`}});
      const data=await r.json();
      setYaUser(data);
    } catch {}
  };
  const disconnectYandex=()=>{ ["ya_token","ya_expiry","ya_state"].forEach(k=>sessionStorage.removeItem(k)); setYaUser(null); };

  // ── Save Event ─────────────────────────────────────────────────────────────
  const saveEvent=async()=>{
    if(!form.subject.trim()) return showToast("Başlık gerekli!","error");
    const target = (msUser&&ggUser) ? form.target : msUser ? "outlook" : "google";

    if(demoMode){
      const e={id:Date.now().toString(),summary:form.subject,subject:form.subject,start:{dateTime:new Date(form.start).toISOString()},end:{dateTime:new Date(form.end).toISOString()},location:{displayName:form.location},description:form.body,bodyPreview:form.body,reminderMinutesBeforeStart:form.reminder,categories:[form.category],attendees:form.attendees||[]};
      if(target==="google") setGgEvents(prev=>[...prev,e]);
      else setMsEvents(prev=>[...prev,e]);
      showToast(`✅ ${target==="google"?"Google Calendar":"Outlook"}'a eklendi!`);
      resetForm(); if(isMobile) changeTab("list"); else closeAddPanel(); return;
    }

    setSaving(true);
    if(target==="outlook"){
      const token=await getMsToken(); if(!token){ setSaving(false); return; }
      try{
        const body={subject:form.subject,start:{dateTime:new Date(form.start).toISOString(),timeZone:"Europe/Istanbul"},end:{dateTime:new Date(form.end).toISOString(),timeZone:"Europe/Istanbul"},location:{displayName:form.location},body:{contentType:"text",content:form.body},isReminderOn:true,reminderMinutesBeforeStart:form.reminder,categories:[form.category]};
        if(form.attendees?.length) body.attendees=form.attendees.map(a=>({...a,type:"required"}));
        const res=await fetch("https://graph.microsoft.com/v1.0/me/events",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
        if(res.ok){ const ev=await res.json(); setMsEvents(prev=>[...prev,ev]); showToast("✅ Outlook'a kaydedildi!"); resetForm(); if(isMobile)changeTab("list"); else closeAddPanel(); }
        else { const err=await res.json(); showToast("Hata: "+(err.error?.message||""),"error"); }
      } catch { showToast("Bağlantı hatası","error"); }
    } else {
      const token=getGgToken(); if(!token){ showToast("Google oturumu doldu, yeniden giriş yapın","error"); setSaving(false); return; }
      try{
        const body={summary:form.subject,start:{dateTime:new Date(form.start).toISOString(),timeZone:"Europe/Istanbul"},end:{dateTime:new Date(form.end).toISOString(),timeZone:"Europe/Istanbul"},location:form.location,description:form.body,reminders:{useDefault:false,overrides:[{method:"popup",minutes:form.reminder}]}};
        if(form.attendees?.length) body.attendees=form.attendees.map(a=>({email:a.emailAddress.address,displayName:a.emailAddress.name}));
        const res=await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
        if(res.ok){ const ev=await res.json(); setGgEvents(prev=>[...prev,ev]); showToast("✅ Google Calendar'a kaydedildi!"); resetForm(); if(isMobile)changeTab("list"); else closeAddPanel(); }
        else { const err=await res.json(); showToast("Hata: "+(err.error?.message||""),"error"); }
      } catch { showToast("Bağlantı hatası","error"); }
    }
    setSaving(false);
  };

  // ── Delete Event ───────────────────────────────────────────────────────────
  const deleteEvent=async(event)=>{
    const rawId = event._raw?.id || event.id;
    if(demoMode){ if(event._source==="google")setGgEvents(p=>p.filter(e=>e.id!==rawId)); else setMsEvents(p=>p.filter(e=>e.id!==rawId)); showToast("Silindi"); closeSelected(); return; }
    if(event._source==="outlook"){
      const token=await getMsToken(); if(!token) return;
      try{ await fetch(`https://graph.microsoft.com/v1.0/me/events/${rawId}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}}); setMsEvents(p=>p.filter(e=>e.id!==rawId)); showToast("Outlook'tan silindi"); closeSelected(); } catch { showToast("Silinemedi","error"); }
    } else {
      const token=getGgToken(); if(!token) return;
      try{ await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${rawId}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}}); setGgEvents(p=>p.filter(e=>e.id!==rawId)); showToast("Google Calendar'dan silindi"); closeSelected(); } catch { showToast("Silinemedi","error"); }
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
    return <LoginScreen loginMs={loginMs} loginGoogle={loginGoogle} loginYandex={loginYandex} loginDemo={loginDemo} themeKey={themeKey} toggleTheme={toggleTheme} C={C} />;
  }

  // ── APP ────────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:C.text}}>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input,textarea{outline:none;-webkit-appearance:none}
        input:focus,textarea:focus{border-color:${C.teal}!important;box-shadow:0 0 0 3px ${C.teal}18!important}
        .ec{transition:transform 0.2s ease,box-shadow 0.2s ease}
        .ec:hover{transform:translateY(-3px) scale(1.01);box-shadow:0 8px 32px rgba(0,0,0,0.28)!important}
        .ec:active{transform:scale(0.98)!important}
        .ec-removing{animation:cardRemove 0.45s cubic-bezier(0.4,0,0.2,1) forwards;overflow:hidden}
        @keyframes cardRemove{0%{opacity:1;transform:translateX(0) scale(1);max-height:200px;margin-bottom:10px}40%{opacity:0.3;transform:translateX(60px) scale(0.94)}100%{opacity:0;transform:translateX(120px) scale(0.85);max-height:0;margin-bottom:0;padding-top:0;padding-bottom:0}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideInLeft{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideInUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        .pg-right{animation:slideInRight 0.32s cubic-bezier(0.25,0.46,0.45,0.94)}
        .pg-left{animation:slideInLeft 0.32s cubic-bezier(0.25,0.46,0.45,0.94)}
        .pg-up{animation:slideInUp 0.28s cubic-bezier(0.25,0.46,0.45,0.94)}
        @keyframes modalBackdrop{from{opacity:0}to{opacity:1}}
        @keyframes modalPopIn{from{opacity:0;transform:scale(0.88) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes sheetSlideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        .modal-backdrop{animation:modalBackdrop 0.25s ease}
        .modal-content-desktop{animation:modalPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1)}
        .modal-content-mobile{animation:sheetSlideUp 0.4s cubic-bezier(0.25,0.46,0.45,0.94)}
        @keyframes panelSlideIn{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}
        @keyframes panelSlideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(100%)}}
        .add-panel{animation:panelSlideIn 0.38s cubic-bezier(0.25,0.46,0.45,0.94)}
        .add-panel-out{animation:panelSlideOut 0.32s cubic-bezier(0.55,0,1,0.45) forwards}

        @keyframes modalBackdropOut{from{opacity:1}to{opacity:0}}
        @keyframes modalPopOut{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(0.88) translateY(20px)}}
        @keyframes sheetSlideDown{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(100%)}}
        .modal-backdrop-out{animation:modalBackdropOut 0.28s ease forwards}
        .modal-content-desktop-out{animation:modalPopOut 0.28s cubic-bezier(0.55,0,1,0.45) forwards}
        .modal-content-mobile-out{animation:sheetSlideDown 0.32s cubic-bezier(0.55,0,1,0.45) forwards}
        @keyframes rippleAnim{from{transform:scale(0);opacity:1}to{transform:scale(4);opacity:0}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-16px) scale(0.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        .toast-in{animation:toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1)}
        @keyframes shimmer{0%{background:linear-gradient(90deg,${C.border} 25%,${C.tag} 50%,${C.border} 75%);background-size:400px 100%}100%{background-position:400px 0}}
        .skeleton{background:linear-gradient(90deg,${C.border} 25%,${C.tag} 50%,${C.border} 75%);background-size:400px 100%;animation:shimmerMove 1.6s infinite linear}
        @keyframes shimmerMove{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .logo-icon{transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1)}
        .logo-icon:hover{transform:rotate(20deg) scale(1.15)}
        .nav-tab{transition:all 0.2s ease}
        .nav-tab:hover{background:rgba(255,255,255,0.12)!important}
        @keyframes fabBounce{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        .fab{animation:fabBounce 2.5s ease-in-out infinite}
        .fab:hover{animation:none;transform:scale(1.1) rotate(90deg)!important;transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1)!important}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>

      {toast&&<div className="toast-in" style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="error"?C.danger:C.success,color:"white",padding:"13px 26px",borderRadius:"16px",boxShadow:`0 10px 40px ${toast.type==="error"?"rgba(255,68,102,0.4)":"rgba(0,229,160,0.35)"}`,fontWeight:700,fontSize:"14px",whiteSpace:"nowrap",maxWidth:"90vw",display:"flex",alignItems:"center",gap:"8px"}}>{toast.msg}</div>}
      {selected&&<DetailModal event={selected} onClose={closeSelected} onDelete={deleteEvent} C={C} isMobile={isMobile} isClosing={selectedClosing}/>}
      {(showAccounts||accountsClosing)&&<AccountPanel msUser={msUser} googleUser={ggUser} yandexUser={yaUser} onConnectMs={loginMs} onConnectGoogle={loginGoogle} onConnectYandex={loginYandex} onDisconnectMs={()=>{disconnectMs();if(!ggUser&&!yaUser){setScreen("login");}}} onDisconnectGoogle={()=>{disconnectGoogle();if(!msUser&&!yaUser){setScreen("login");}}} onDisconnectYandex={()=>{disconnectYandex();if(!msUser&&!ggUser){setScreen("login");}}} C={C} isMobile={isMobile} onClose={closeAccounts} isClosing={accountsClosing}/>}
      {dayEvents&&(
        <div onClick={closeDayEvents} className={dayEventsClosing?"modal-backdrop-out":"modal-backdrop"} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} className={dayEventsClosing?(isMobile?"modal-content-mobile-out":"modal-content-desktop-out"):(isMobile?"modal-content-mobile":"modal-content-desktop")} style={{background:C.surface,borderRadius:isMobile?"24px 24px 0 0":"24px",padding:"24px",width:"100%",maxWidth:isMobile?"100%":"460px",maxHeight:"70vh",overflowY:"auto"}}>
            {isMobile&&<div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 16px"}}/>}
            <h3 style={{margin:"0 0 16px",fontSize:"16px",fontWeight:700}}>{fmtShort(getStartDT(dayEvents[0]))} etkinlikleri</h3>
            {dayEvents.map((e,i)=>(
              <div key={i} onClick={()=>{closeDayEvents();setTimeout(()=>setSelected(e),300);}} style={{padding:"12px 14px",background:C.card,borderRadius:"14px",marginBottom:"8px",borderLeft:`3px solid ${e._source==="google"?"#4285f4":"#0078d4"}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontWeight:700,fontSize:"14px"}}>{e.subject}</div>
                  <SourceBadge source={e._source} small/>
                </div>
                <div style={{color:C.muted,fontSize:"12px",marginTop:"4px"}}>🕐 {fmtTime(getStartDT(e))} – {fmtTime(getEndDT(e))}</div>
              </div>
            ))}
            <button onClick={closeDayEvents} style={{width:"100%",padding:"13px",borderRadius:"12px",background:C.tag,border:"none",color:C.muted,fontSize:"15px",fontWeight:600,cursor:"pointer",marginTop:"8px"}}>Kapat</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{background:C.header,padding:"0 20px",height:"60px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 30px rgba(0,0,0,0.3)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <AppIcon size={34} style={{borderRadius:"10px",cursor:"default",filter:"drop-shadow(0 2px 8px rgba(200,130,40,0.4))"}} />
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
              <button key={t.id} onClick={()=>changeTab(t.id)} className="nav-tab" style={{padding:"8px 16px",borderRadius:"9px",border:"none",background:tab===t.id?"rgba(255,255,255,0.15)":"transparent",color:"white",fontWeight:600,fontSize:"14px",cursor:"pointer"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        )}
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          {notifPerm!=="granted"&&<button onClick={async()=>{const p=await Notification.requestPermission();setNotifPerm(p);if(p==="granted")showToast("🔔 Bildirimler açıldı!");}} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"10px",padding:"8px 10px",color:"white",fontSize:"14px",cursor:"pointer"}}>🔔</button>}
          <button onClick={()=>{ if(showAccounts) closeAccounts(); else setShowAccounts(true); }} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"10px",padding:"8px 12px",color:"white",fontSize:"13px",fontWeight:600,cursor:"pointer"}}>👤 Hesaplar</button>
          <ThemeToggle isDark={themeKey==="dark"} onToggle={toggleTheme} />
          {!isMobile&&<RippleButton onClick={()=>{ if(showAddPanel) closeAddPanel(); else setShowAddPanel(true); }} style={{background:C.gradient,border:"none",borderRadius:"10px",padding:"8px 18px",color:"white",fontSize:"14px",fontWeight:700,boxShadow:`0 4px 14px ${C.teal}33`,transition:"transform 0.2s,box-shadow 0.2s"}}>➕ Yeni Ekle</RippleButton>}
        </div>
      </header>

      {/* DESKTOP */}
      {!isMobile?(
        <div style={{display:"flex",minHeight:"calc(100vh - 60px)"}}>
          <div style={{flex:1,padding:"24px",overflowY:"auto"}}>
            {tab==="list"&&(
              <div className={getPageClass("list")}>
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
                {loading&&(
                  <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                    {[...Array(4)].map((_,i)=><SkeletonCard key={i} C={C}/>)}
                  </div>
                )}
                {!loading&&filteredEvents.length===0&&(
                  <div style={{textAlign:"center",padding:"70px",background:C.card,borderRadius:"20px",border:"1px solid "+C.border}}>
                    <div style={{fontSize:"52px",marginBottom:"12px"}}>{search?"🔍":"🗓️"}</div>
                    <div style={{color:C.muted,fontSize:"17px",marginBottom:"20px"}}>{search?`"${search}" için sonuç yok`:"Yaklaşan etkinlik yok"}</div>
                    {!search&&<button onClick={()=>setShowAddPanel(true)} style={{padding:"12px 28px",borderRadius:"12px",background:C.gradient,border:"none",color:"white",fontWeight:700,cursor:"pointer",fontSize:"15px"}}>+ Etkinlik Ekle</button>}
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(480px,1fr))",gap:"10px"}}>
                  {filteredEvents.map((e,i)=>(
                    <AnimatedCard key={e._id} index={i}>
                      <EventCard e={e} onClick={()=>setSelected(e)} C={C}/>
                    </AnimatedCard>
                  ))}
                </div>
              </div>
            )}
            {tab==="calendar"&&(
              <div className={getPageClass("calendar")}>
                <h2 style={{margin:"0 0 20px",fontSize:"22px",fontWeight:700}}>Takvim</h2>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px"}}>
                  <CalendarGrid events={allEvents} onDayClick={setDayEvents} C={C}/>
                  <div>
                    <div style={{fontWeight:600,fontSize:"13px",color:C.muted,marginBottom:"12px",textTransform:"uppercase",letterSpacing:0.5}}>Yaklaşan ({upcoming.length})</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                      {upcoming.slice(0,8).map(e=>(
                        <div key={e._id} onClick={()=>setSelected(e)} className="ec" style={{display:"flex",gap:"10px",padding:"12px 14px",background:C.card,borderRadius:"14px",cursor:"pointer",border:"1px solid "+C.border,borderLeft:`3px solid ${e._source==="google"?"#4285f4":"#0078d4"}`,transition:"all 0.15s"}}>
                          <div style={{minWidth:"36px",textAlign:"center"}}>
                            <div style={{fontSize:"9px",color:C.muted,textTransform:"uppercase"}}>{safeParse(getStartDT(e)).toLocaleDateString("tr-TR",{month:"short"})}</div>
                            <div style={{fontSize:"18px",fontWeight:800,color:e._source==="google"?"#4285f4":"#0078d4",lineHeight:1}}>{safeParse(getStartDT(e)).getDate()}</div>
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
          {(showAddPanel||addPanelClosing)&&(
            <div className={addPanelClosing?"add-panel-out":"add-panel"} style={{width:"400px",background:C.surface,borderLeft:"1px solid "+C.border,padding:"24px",overflowY:"auto",boxShadow:"-4px 0 30px rgba(0,0,0,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
                <h3 style={{margin:0,fontSize:"18px",fontWeight:700}}>➕ Yeni Etkinlik</h3>
                <button onClick={closeAddPanel} style={{background:C.tag,border:"none",color:C.muted,fontSize:"16px",cursor:"pointer",padding:"6px 10px",borderRadius:"8px",transition:"transform 0.2s"}} onMouseOver={e=>e.currentTarget.style.transform="rotate(90deg)"} onMouseOut={e=>e.currentTarget.style.transform="rotate(0deg)"}>✕</button>
              </div>
              <AddForm form={form} setForm={setForm} onSave={saveEvent} onCancel={closeAddPanel} saving={saving} C={C} msConnected={msConnected} googleConnected={ggConnected}/>
            </div>
          )}
        </div>
      ):(
        /* MOBILE */
        <div style={{paddingBottom:"70px"}}>
          <div style={{padding:"14px"}}>
            {tab==="list"&&(
              <div className={getPageClass("list")}>
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
                {loading&&(
                  <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                    {[...Array(3)].map((_,i)=><SkeletonCard key={i} C={C}/>)}
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {filteredEvents.map((e,i)=>(
                    <AnimatedCard key={e._id} index={i}>
                      <EventCard e={e} onClick={()=>setSelected(e)} C={C}/>
                    </AnimatedCard>
                  ))}
                </div>
                {!loading&&filteredEvents.length===0&&(
                  <div style={{textAlign:"center",padding:"50px",background:C.card,borderRadius:"16px",border:"1px solid "+C.border}}>
                    <div style={{fontSize:"44px",marginBottom:"12px"}}>{search?"🔍":"🗓️"}</div>
                    <div style={{color:C.muted,marginBottom:"14px"}}>{search?`"${search}" bulunamadı`:"Etkinlik yok"}</div>
                    {!search&&<button onClick={()=>changeTab("add")} style={{padding:"10px 24px",borderRadius:"12px",background:C.gradient,border:"none",color:"white",fontWeight:700,cursor:"pointer",fontSize:"14px"}}>+ Ekle</button>}
                  </div>
                )}
              </div>
            )}
            {tab==="calendar"&&(
              <div className={getPageClass("calendar")}>
                <div style={{fontWeight:700,fontSize:"18px",marginBottom:"16px"}}>Takvim</div>
                <CalendarGrid events={allEvents} onDayClick={setDayEvents} C={C}/>
                <div style={{marginTop:"18px"}}>
                  <div style={{fontWeight:600,fontSize:"12px",color:C.muted,marginBottom:"10px",textTransform:"uppercase",letterSpacing:0.5}}>Yaklaşan</div>
                  {upcoming.slice(0,5).map(e=>(
                    <div key={e._id} onClick={()=>setSelected(e)} style={{display:"flex",gap:"10px",padding:"12px",background:C.card,borderRadius:"14px",marginBottom:"8px",cursor:"pointer",border:"1px solid "+C.border,borderLeft:`3px solid ${e._source==="google"?"#4285f4":"#0078d4"}`}}>
                      <div style={{textAlign:"center",minWidth:"36px"}}>
                        <div style={{fontSize:"9px",color:C.muted,textTransform:"uppercase"}}>{safeParse(getStartDT(e)).toLocaleDateString("tr-TR",{month:"short"})}</div>
                        <div style={{fontSize:"18px",fontWeight:800,color:e._source==="google"?"#4285f4":"#0078d4",lineHeight:1}}>{safeParse(getStartDT(e)).getDate()}</div>
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
              <div className={getPageClass("add")}>
                <div style={{fontWeight:700,fontSize:"18px",marginBottom:"16px"}}>➕ Yeni Etkinlik</div>
                <AddForm form={form} setForm={setForm} onSave={saveEvent} saving={saving} C={C} msConnected={msConnected} googleConnected={ggConnected}/>
              </div>
            )}
          </div>
          <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.navBg,borderTop:"1px solid "+C.border,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -4px 20px rgba(0,0,0,0.2)"}}>
            {[{id:"list",icon:"📋",label:"Etkinlikler"},{id:"calendar",icon:"🗓️",label:"Takvim"},{id:"add",icon:"➕",label:"Ekle"}].map(t=>(
              <button key={t.id} onClick={()=>changeTab(t.id)} style={{flex:1,padding:"10px 8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",position:"relative"}}>
                <span className={t.id==="add"&&tab!=="add"?"fab":""} style={{fontSize:t.id==="add"?"24px":"20px",filter:tab===t.id?"none":"grayscale(0.5) opacity(0.45)",transition:"all 0.2s",display:"inline-block"}}>{t.icon}</span>
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
