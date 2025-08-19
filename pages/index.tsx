
import React, { useEffect, useMemo, useRef, useState } from "react";

const GOOD = ["HUMAN", "AI", "DISCORD", "REFERRAL", "ZK"] as const;
const BAD = ["FAKE", "SYBIL"] as const;
type Good = typeof GOOD[number];
type Bad = typeof BAD[number];
type Drop = { id: number; x: number; y: number; vy: number; type: Good | Bad; good: boolean };
type Floaty = { id: number; x: number; y: number; text: string; life: number };
type Particle = { id: number; x: number; y: number; vx: number; vy: number; life: number };

const COLORS: Record<Good | Bad, string> = {
  HUMAN: "from-emerald-400 to-emerald-600",
  AI: "from-sky-400 to-sky-600",
  DISCORD: "from-indigo-400 to-indigo-600",
  REFERRAL: "from-amber-400 to-amber-600",
  ZK: "from-fuchsia-400 to-fuchsia-600",
  FAKE: "from-rose-400 to-rose-600",
  SYBIL: "from-red-500 to-red-700",
};
const LABELS: Record<Good | Bad, string> = {
  HUMAN: "Human", AI: "AI Agent", DISCORD: "Discord", REFERRAL: "Referral", ZK: "ZK Proof", FAKE: "Fake", SYBIL: "Sybil",
};
const KEY_LEFT = new Set(["ArrowLeft", "a", "A"]);
const KEY_RIGHT = new Set(["ArrowRight", "d", "D"]);
const clamp01 = (v:number) => Math.max(0, Math.min(1, v));
const sanitizeHandle = (v: string) => v.trim().replace(/^@+/, "");

export default function Home() {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [power, setPower] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState<number>(() => (typeof window === "undefined" ? 0 : parseInt(localStorage.getItem("billions_best") || "0")));
  const [x, setX] = useState(0.5);
  const [combo, setCombo] = useState(0);

  // runtime refs to avoid stale closures in RAF
  const timeRef = useRef(60);
  const powerRef = useRef(0);
  const livesRef = useRef(3);
  const xRef = useRef(0.5);
  const comboRef = useRef(0);

  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { xRef.current = x; }, [x]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  // Avatar + glasses
  const [handle, setHandle] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [glassesUrl, setGlassesUrl] = useState<string>("/billions-glasses.png");
  const [composedUrl, setComposedUrl] = useState<string>("");
  const [uiOpen, setUiOpen] = useState(true);
  const [scale, setScale] = useState(1.0);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [rotate, setRotate] = useState(0);
  const [debug, setDebug] = useState<string>("");

  const dropsRef = useRef<Drop[]>([]);
  const floatiesRef = useRef<Floaty[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keys = useRef({ L: false, R: false });
  const last = useRef<number | null>(null);

  const reset = () => {
    setTimeLeft(60); setPower(0); setLives(3); setCombo(0);
    timeRef.current = 60; powerRef.current = 0; livesRef.current = 3; comboRef.current = 0; xRef.current = 0.5; setX(0.5);
    dropsRef.current = []; floatiesRef.current = []; particlesRef.current = [];
  };

  const fetchAvatar = async () => {
    try {
      const h = sanitizeHandle(handle);
      if (!h) throw new Error("no-handle");
      const url = `/api/avatar?handle=${encodeURIComponent(h)}`; // same-origin proxy
      setAvatarUrl(url);
      await composeAvatar(url, glassesUrl);
      setDebug(`ok: ${url}`);
    } catch (e: any) {
      console.error("avatar-fetch-failed", e);
      setAvatarUrl(""); setComposedUrl("");
      setDebug(`error: ${String(e?.message || e)}`);
      alert("Avatar alınamadı. Kullanıcı adını (@ olmadan) doğru girdiğinden ve hesabın var/erişilebilir olduğundan emin ol.");
    }
  };

  const composeAvatar = async (src?: string, gsrc?: string) => {
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = src || avatarUrl;
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; });

    const size = 256; const c = document.createElement("canvas"); c.width = size; c.height = size; const ctx = c.getContext("2d")!;
    ctx.clearRect(0,0,size,size);
    ctx.save(); ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI*2); ctx.closePath(); ctx.clip();
    ctx.drawImage(img, 0, 0, size, size); ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 3, 0, Math.PI*2); ctx.stroke();

    const g = new Image(); g.crossOrigin = "anonymous"; g.src = gsrc || glassesUrl;
    try {
      await new Promise((ok, err) => { g.onload = ok; g.onerror = err; });
      ctx.save(); ctx.translate(size/2 + offX, size*0.48 + offY); ctx.rotate((rotate*Math.PI)/180);
      const targetW = 170 * scale; const targetH = 100 * scale; ctx.drawImage(g, -targetW/2, -targetH/2, targetW, targetH); ctx.restore();
    } catch {
      ctx.save(); ctx.translate(size/2 + offX, size*0.48 + offY); ctx.rotate((rotate*Math.PI)/180);
      const w = 180 * scale; const h = 95 * scale; const r = 40 * scale;
      ctx.fillStyle = "#0ea5e9"; roundRect(ctx, -w/2, -h/2, w, h, r); ctx.fill();
      ctx.fillStyle = "#fff"; const ew = 44*scale, eh = 70*scale, gap = 36*scale;
      roundRect(ctx, -ew-gap/2, -eh/2, ew, eh, 16*scale); ctx.fill(); roundRect(ctx, gap/2, -eh/2, ew, eh, 16*scale); ctx.fill();
      ctx.restore();
    }

    setComposedUrl(c.toDataURL("image/png"));
  };

  // Re-compose when tuning
  useEffect(() => { if (avatarUrl) composeAvatar(undefined, glassesUrl); /* eslint-disable-next-line */ }, [scale, offX, offY, rotate, glassesUrl]);

  // Stable game loop: depend only on `running`
  useEffect(() => {
    if (!running) return;
    const kd = (e: KeyboardEvent) => { if (KEY_LEFT.has(e.key)) keys.current.L = true; if (KEY_RIGHT.has(e.key)) keys.current.R = true; };
    const ku = (e: KeyboardEvent) => { if (KEY_LEFT.has(e.key)) keys.current.L = false; if (KEY_RIGHT.has(e.key)) keys.current.R = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let spawnAcc = 0;

    const step = (t: number) => {
      if (!running) return;
      if (last.current == null) last.current = t;
      const dt = Math.min(0.05, (t - last.current) / 1000);
      last.current = t;

      // time
      timeRef.current = timeRef.current > 0 ? Math.max(0, timeRef.current - dt) : 0;
      setTimeLeft(timeRef.current);

      // movement (use refs; not triggering effect re-subscribe)
      const speed = 1.3;
      let nx = xRef.current;
      const dir = (keys.current.R ? 1 : 0) - (keys.current.L ? 1 : 0);
      nx = clamp01(nx + dir * speed * dt);
      xRef.current = nx;
      setX(nx);

      // spawn (difficulty scales with elapsed)
      spawnAcc += dt;
      const spawnEvery = Math.max(0.4, 1.1 - (60 - Math.max(0, timeRef.current)) * 0.018);
      if (spawnAcc >= spawnEvery) {
        spawnAcc = 0;
        const good = Math.random() > 0.28;
        const type = (good ? GOOD[Math.floor(Math.random() * GOOD.length)] : BAD[Math.floor(Math.random() * BAD.length)]) as Good | Bad;
        dropsRef.current.push({ id: Date.now() + Math.random(), x: Math.random(), y: -0.1, vy: 0.3 + Math.random() * 0.3, type, good });
      }

      // update drops
      dropsRef.current.forEach(d => (d.y += d.vy * dt));

      // particles
      particlesRef.current.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.5 * dt; p.life -= dt; });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      // floaties
      floatiesRef.current.forEach(f => { f.y -= 0.25 * dt; f.life -= dt; });
      floatiesRef.current = floatiesRef.current.filter(f => f.life > 0);

      // collisions
      const PY = 0.88; const caught: number[] = [];
      for (const d of dropsRef.current) {
        if (Math.abs(d.y - PY) < 0.04 && Math.abs(d.x - nx) < 0.08) {
          caught.push(d.id);
          if (d.good) {
            const mult = 1 + Math.floor(comboRef.current / 5);
            const gain = 5 * mult;
            powerRef.current += gain; setPower(powerRef.current);
            comboRef.current += 1; setCombo(comboRef.current);
            addFloaty(`+${gain} POWER ×${mult}`, d.x, PY);
            burst(d.x, PY, d.type);
            blip(880 + comboRef.current * 10, 0.05);
          } else {
            livesRef.current = Math.max(0, livesRef.current - 1); setLives(livesRef.current);
            comboRef.current = 0; setCombo(0);
            addFloaty("-life", d.x, PY);
            burst(d.x, PY, d.type);
            blip(180, 0.08);
          }
        }
      }
      if (caught.length) dropsRef.current = dropsRef.current.filter(d => !caught.includes(d.id));
      dropsRef.current = dropsRef.current.filter(d => d.y < 1.12);

      // end
      if (timeRef.current <= 0 || livesRef.current <= 0) {
        setRunning(false);
        last.current = null;
        setBest(b => { const n = Math.max(b, powerRef.current); localStorage?.setItem("billions_best", String(n)); return n; });
        return;
      }

      requestAnimationFrame(step);
    };

    const raf = requestAnimationFrame(step);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [running]);

  const start = () => {
    reset();
    setRunning(true);
    // Ensure keyboard events aren't captured by inputs
    if (typeof document !== "undefined") (document.activeElement as HTMLElement | null)?.blur();
  };

  const addFloaty = (text: string, x: number, y: number) => { floatiesRef.current.push({ id: Date.now() + Math.random(), text, x, y, life: 1.1 }); };
  const burst = (x: number, y: number, t: Good | Bad) => { for (let i=0;i<12;i++){ const a=Math.random()*Math.PI*2; const s=0.8+Math.random()*1.4; particlesRef.current.push({ id: Date.now()+Math.random(), x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 0.6+Math.random()*0.5 }); } };
  const blip = (freq: number, dur = 0.06) => { try { const ctx = new (window as any).AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = "triangle"; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination); const now = ctx.currentTime; g.gain.setValueAtTime(0.001, now); g.gain.exponentialRampToValueAtTime(0.12, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + dur); o.start(now); o.stop(now + dur); } catch {} };

  const Logo = useMemo(() => () => (
    <div className="shrink-0 relative">
      <svg className="w-9 h-9 md:w-11 md:h-11" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="#fff" stroke="#111" strokeWidth="6" />
        <path d="M50 8 A42 42 0 1 1 8 50" fill="none" stroke="#e11" strokeWidth="14" strokeLinecap="round" />
        <path d="M70 18 a12 12 0 1 1 0 .1" fill="#999" />
      </svg>
    </div>
  ), []);

  const share = () => {
    const text = encodeURIComponent(`I scored ${power} POWER in Billions Neon! @billions_ntwk`);
    const url = typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const onTouch = (side: "L" | "R") => {
    if (!running) return;
    if (side === "L") { keys.current.L = true; setTimeout(()=>keys.current.L=false, 60); }
    else { keys.current.R = true; setTimeout(()=>keys.current.R=false, 60); }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-5xl relative">
        <div className="absolute -z-10 inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,#0ea5e9_0,transparent_35%),radial-gradient(circle_at_80%_20%,#7c3aed_0,transparent_40%),radial-gradient(circle_at_50%_80%,#22c55e_0,transparent_35%)] opacity-30"/>
          <div className="absolute inset-0 animate-slowfloat bg-[radial-gradient(1200px_600px_at_20%_-10%,#0ea5e955_0,transparent_60%)]"/>
          <div className="absolute inset-0 animate-slowfloat2 bg-[radial-gradient(1000px_500px_at_120%_120%,#7c3aed55_0,transparent_60%)]"/>
        </div>

        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Billions Neon — Avatar Game</h1>
              <p className="text-xs md:text-sm text-white/70 -mt-1">Custom avatar with Billions glasses • Catch verifiable items • Build combos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setUiOpen(v=>!v)} className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-semibold">{uiOpen?"Close Avatar":"Customize Avatar"}</button>
            <button onClick={start} className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-semibold">{running ? "Restart" : "Start"}</button>
            <button onClick={share} className="px-3 py-2 rounded-2xl bg-white text-black text-sm font-semibold">Share on X</button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <HUD label="POWER" value={String(power)} />
          <HUD label="Time" value={`${Math.ceil(timeRef.current)}s`} />
          <HUD label="Lives" value={"❤".repeat(lives) || "—"} />
          <HUD label="Best" value={String(best)} />
          <HUD label="Combo" value={`${combo} (${1 + Math.floor(combo/5)}x)`} />
        </div>

        {uiOpen && (
          <div className="mb-3 rounded-2xl border border-white/20 bg-white/5 p-3 grid gap-3">
            <div className="grid md:grid-cols-5 gap-2 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-white/70">X Handle (without @)</label>
                <input value={handle} onChange={e=>setHandle(e.target.value)} placeholder="username" className="w-full mt-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-white/70">Glasses PNG path (public/)</label>
                <input value={glassesUrl} onChange={e=>setGlassesUrl(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20" />
              </div>
              <button onClick={fetchAvatar} className="px-3 py-2 rounded-2xl bg-white text-black font-semibold">Load Avatar</button>
              <input type="file" accept="image/*" onChange={(e:any)=>{ const f=e.target.files?.[0]; if(!f) return; const url=URL.createObjectURL(f); setAvatarUrl(url); composeAvatar(url, glassesUrl); setDebug(`local-file: ${f.name}`); }} className="text-xs" />
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              <Range label="Scale" value={scale} min={0.7} max={1.8} step={0.01} onChange={setScale} />
              <Range label="Offset X" value={offX} min={-60} max={60} step={1} onChange={setOffX} />
              <Range label="Offset Y" value={offY} min={-60} max={60} step={1} onChange={setOffY} />
              <Range label="Rotate" value={rotate} min={-30} max={30} step={0.5} onChange={setRotate} />
            </div>

            <div className="flex items-center gap-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border border-white/30 shadow" style={{backgroundImage:`url(${composedUrl||avatarUrl||"/default-avatar.png"})`, backgroundSize:"cover", backgroundPosition:"center"}} />
              <a href={composedUrl || avatarUrl || "#"} download="billions-avatar.png" className="px-3 py-2 rounded-2xl bg-white/10 border border-white/20 text-sm">Download</a>
              <div className="text-[10px] text-white/60">{debug}</div>
            </div>
          </div>
        )}

        <div className="relative w-full aspect-[16/9] rounded-[28px] overflow-hidden border border-white/20 bg-white/5 shadow-[0_0_60px_#0ea5e933]">
          <div className="absolute inset-0 pointer-events-none opacity-[.08]" style={{backgroundImage:"linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg,#fff 1px, transparent 1px)", backgroundSize:"28px 28px"}} />

          <div className="absolute -translate-x-1/2" style={{ left: `${x * 100}%`, bottom: `6%` }}>
            {composedUrl ? (
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border border-white/40 shadow-[0_10px_40px_rgba(255,255,255,.25)]" style={{backgroundImage:`url(${composedUrl})`, backgroundSize:"cover", backgroundPosition:"center"}} />
            ) : (
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border border-white/40 bg-white/10 flex items-center justify-center text-4xl">🕶️</div>
            )}
            <div className="text-center text-[10px] text-white/60 mt-1">you</div>
          </div>

          {dropsRef.current.map(d => (<Token key={d.id} d={d} />))}
          {floatiesRef.current.map(f => (<div key={f.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, opacity: Math.max(0, Math.min(1, f.life)) }}>{f.text}</div>))}
          {particlesRef.current.map(p => (<div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/80" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, opacity: Math.max(0, Math.min(1, p.life)) }} />))}

          {!running && (
            <Overlay>
              <div className="text-center max-w-md mx-auto">
                <h2 className="text-xl md:text-2xl font-extrabold mb-2">Ready to verify?</h2>
                <p className="text-sm text-white/80 mb-3">Use ←/→ or A/D to move. Catch VALID items. Avoid FAKE/SYBIL.</p>
                <Legend />
                <div className="mt-4 flex items-center justify-center gap-2"><button onClick={start} className="px-5 py-2 rounded-2xl bg-white text-black font-semibold shadow">Start</button></div>
              </div>
            </Overlay>
          )}
          {running && timeRef.current <= 0 && (<Overlay><EndCard title="Time!" power={power} onRestart={start} /></Overlay>)}
          {running && livesRef.current <= 0 && (<Overlay><EndCard title="Out of lives!" power={power} onRestart={start} /></Overlay>)}

          <div className="absolute inset-x-0 bottom-1 flex items-center justify-between px-2 md:hidden">
            <button onTouchStart={()=>onTouch("L")} className="px-6 py-3 rounded-2xl bg-white/10 border border-white/20">◀</button>
            <button onTouchStart={()=>onTouch("R")} className="px-6 py-3 rounded-2xl bg-white/10 border border-white/20">▶</button>
          </div>
        </div>

        <footer className="mt-4 text-xs text-white/60">Fan-made visual demo • Tag <span className="font-semibold text-white">@billions_ntwk</span>.</footer>
      </div>
    </div>
  );
}

function Token({ d }: { d: Drop }) {
  const grad = COLORS[d.type]; const label = LABELS[d.type];
  return (
    <div className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-2 text-xs md:text-sm font-semibold rounded-full text-white shadow-lg bg-gradient-to-br ${grad}`}
      style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, boxShadow: "0 8px 30px rgba(255,255,255,.15)" }} title={label}>
      <span className="drop-shadow">{label}</span>
      <span className="ml-2 text-white/70">●</span>
    </div>
  );
}
function HUD({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/20 shadow px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-lg font-bold leading-none">{value}</div>
    </div>
  );
}
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full">{children}</div>
    </div>
  );
}
function EndCard({ title, power, onRestart }: { title: string; power: number; onRestart: () => void }) {
  return (
    <div className="text-center max-w-md mx-auto">
      <h2 className="text-2xl font-extrabold mb-2">{title}</h2>
      <p className="text-sm text-white/80">Total POWER</p>
      <div className="text-4xl font-black my-2">{power}</div>
      <button onClick={onRestart} className="mt-3 px-4 py-2 rounded-2xl bg-white text-black font-semibold shadow">Play again</button>
    </div>
  );
}
function Legend() {
  const items: (Good | Bad)[] = ["HUMAN","AI","DISCORD","REFERRAL","ZK","FAKE","SYBIL"];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {items.map(k => (
        <div key={k} className={`rounded-xl border border-white/20 bg-white/5 p-2 flex items-center gap-2`}>
          <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${COLORS[k]}`} />
          <div className="text-xs"><span className="font-semibold">{LABELS[k]}</span></div>
        </div>
      ))}
    </div>
  );
}
function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number)=>void }) {
  return (
    <label className="grid gap-1 text-xs text-white/70">
      <span>{label}: <b className="text-white">{typeof value === 'number' ? value.toFixed(2) : value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(parseFloat((e.target as HTMLInputElement).value))} className="appearance-none w-full h-2 rounded bg-white/10 accent-white" />
    </label>
  );
}
function roundRect(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number){
  const rr = Math.min(r, w/2, h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath();
}
