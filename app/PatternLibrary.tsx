"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };
type Duty = "press" | "cover" | "balance" | "far";
type Defender = Point & { id: string; role: "VB" | "VS" | "HS" | "HB" };
type Opponent = Point & { id: string; role: string };
type Phase = {
  label: string;
  carrierId: string;
  duties: Record<string, Duty>;
};

// Bare den blå bakre fireren jobber i dette mønsteret.
const defenders: Defender[] = [
  { id: "lb", role: "VB", x: 235, y: 125 },
  { id: "lcb", role: "VS", x: 220, y: 255 },
  { id: "rcb", role: "HS", x: 220, y: 395 },
  { id: "rb", role: "HB", x: 235, y: 525 },
];

const goalkeeper: Point = { x: 92, y: 325 };

// Rødt flytter ballen side–side foran backfireren.
const opponents: Opponent[] = [
  { id: "rw", role: "R-KANT", x: 545, y: 115 },
  { id: "r10l", role: "R-INN", x: 565, y: 250 },
  { id: "r10r", role: "R-INN", x: 565, y: 400 },
  { id: "lw", role: "R-KANT", x: 545, y: 535 },
];

const phases: Phase[] = [
  {
    label: "Ball på blå venstre side",
    carrierId: "rw",
    duties: { lb: "press", lcb: "cover", rcb: "balance", rb: "far" },
  },
  {
    label: "Ball inn i venstre halvrom",
    carrierId: "r10l",
    duties: { lb: "cover", lcb: "press", rcb: "balance", rb: "far" },
  },
  {
    label: "Ball over mot høyre halvrom",
    carrierId: "r10r",
    duties: { lb: "far", lcb: "balance", rcb: "press", rb: "cover" },
  },
  {
    label: "Ball på blå høyre side",
    carrierId: "lw",
    duties: { lb: "far", lcb: "balance", rcb: "cover", rb: "press" },
  },
  {
    label: "Tilbake i høyre halvrom",
    carrierId: "r10r",
    duties: { lb: "far", lcb: "balance", rcb: "press", rb: "cover" },
  },
  {
    label: "Tilbake i venstre halvrom",
    carrierId: "r10l",
    duties: { lb: "cover", lcb: "press", rcb: "balance", rb: "far" },
  },
];

function getOpponent(id: string) {
  return opponents.find((opponent) => opponent.id === id) ?? opponents[0];
}

function getDefensiveShape(phase: Phase) {
  const carrier = getOpponent(phase.carrierId);
  const topSide = carrier.y < 325;

  const players = defenders.map((player) => {
    const duty = phase.duties[player.id] ?? "balance";
    let x = player.x;
    let y = player.y;

    if (duty === "press") {
      x = carrier.x - 86;
      y = carrier.y + (325 - carrier.y) * 0.04;
    }

    if (duty === "cover") {
      x = carrier.x - 155;
      y = carrier.y + (325 - carrier.y) * 0.30;
    }

    if (duty === "balance") {
      x = 250;
      y = topSide ? 360 : 290;
    }

    if (duty === "far") {
      // Motsatt back faller litt mot eget mål og smalner kraftig inn.
      x = 200;
      y = topSide ? 455 : 195;
    }

    return { ...player, x, y, duty };
  });

  return { players, carrier };
}

function roleForDuty(duty: Duty) {
  if (duty === "press") return "1F · PRESS";
  if (duty === "cover") return "2F · SIKRING";
  if (duty === "balance") return "BALANSE";
  return "FALLER + INN";
}

function defenderRole(id: string) {
  return defenders.find((defender) => defender.id === id)?.role ?? id;
}

export default function PatternLibrary() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState(0);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  const current = phases[phase];
  const shape = useMemo(() => getDefensiveShape(current), [current]);
  const presser = shape.players.find((player) => player.duty === "press");
  const cover = shape.players.find((player) => player.duty === "cover");
  const balance = shape.players.find((player) => player.duty === "balance");
  const far = shape.players.find((player) => player.duty === "far");

  useEffect(() => {
    if (!playing || !open) return;
    timerRef.current = window.setInterval(() => {
      setPhase((value) => (value + 1) % phases.length);
    }, 1850 / speed);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [playing, open, speed]);

  useEffect(() => {
    if (!open) setPlaying(false);
  }, [open]);

  function next(delta: number) {
    setPlaying(false);
    setPhase((value) => (value + delta + phases.length) % phases.length);
  }

  return (
    <>
      <button className="patternLauncher" type="button" onClick={() => setOpen(true)} title="Ferdige forsvarsmønstre">
        <span>◈</span><b>Mønstre</b>
      </button>

      {open && (
        <div className="patternBackdrop" role="dialog" aria-modal="true" aria-label="Mønsterbibliotek">
          <section className="patternModal">
            <header className="patternHeader">
              <div>
                <span className="patternEyebrow">FORSVARSMØNSTER · BAKRE FIRER</span>
                <h2>Backfirer · Press, sikring og balanse</h2>
                <p>Kun de fire blå forsvarsspillerne jobber. Rødt flytter ballen side–side foran dem. Nærmeste forsvarer går i press, neste sikrer, den tredje balanserer og motsatt back faller litt og smalner inn.</p>
              </div>
              <button className="patternClose" type="button" onClick={() => setOpen(false)} aria-label="Lukk">×</button>
            </header>

            <div className="patternContent">
              <div className="patternPitchCard">
                <svg className="patternPitch" viewBox="0 0 1000 650" aria-label="Bakre firer som trener press, sikring og balanse">
                  <defs>
                    <linearGradient id="patternGrass" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#17683d" />
                      <stop offset="55%" stopColor="#237e49" />
                      <stop offset="100%" stopColor="#125b36" />
                    </linearGradient>
                    <filter id="patternGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
                    <marker id="pressArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="#ffd65a" /></marker>
                  </defs>

                  <rect width="1000" height="650" fill="url(#patternGrass)" />
                  {Array.from({ length: 10 }).map((_, i) => <rect key={i} x={i * 100} width="100" height="650" fill={i % 2 ? "rgba(0,0,0,.025)" : "rgba(255,255,255,.025)"} />)}
                  <rect x="30" y="30" width="470" height="590" fill="rgba(58,139,255,.025)" />
                  <g fill="none" stroke="rgba(255,255,255,.88)" strokeWidth="3.5">
                    <rect x="30" y="30" width="940" height="590" />
                    <line x1="500" y1="30" x2="500" y2="620" />
                    <circle cx="500" cy="325" r="82" />
                    <rect x="30" y="175" width="155" height="300" />
                    <rect x="815" y="175" width="155" height="300" />
                    <rect x="30" y="245" width="62" height="160" />
                    <rect x="908" y="245" width="62" height="160" />
                  </g>

                  <g>
                    <rect x="48" y="48" width="170" height="34" rx="10" fill="rgba(58,139,255,.18)" stroke="rgba(170,210,255,.5)" />
                    <text x="133" y="70" textAnchor="middle" fill="#dcecff" fontSize="13" fontWeight="900">BLÅ BAKRE FIRER</text>
                    <rect x="535" y="48" width="220" height="34" rx="10" fill="rgba(255,92,108,.14)" stroke="rgba(255,160,170,.42)" />
                    <text x="645" y="70" textAnchor="middle" fill="#ffd9de" fontSize="13" fontWeight="900">RØD FLYTTER BALLEN</text>
                  </g>

                  <g transform={`translate(${goalkeeper.x} ${goalkeeper.y})`} opacity=".42">
                    <rect x="-15" y="-15" width="30" height="30" rx="7" fill="#3a8bff" stroke="#fff" strokeWidth="2.5" />
                    <text y="4.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#fff">K</text>
                  </g>

                  {presser && (
                    <line x1={presser.x + 18} y1={presser.y} x2={shape.carrier.x - 22} y2={shape.carrier.y} stroke="#ffd65a" strokeWidth="3.5" strokeDasharray="10 7" markerEnd="url(#pressArrow)" opacity=".92" />
                  )}

                  {opponents.map((opponent) => {
                    const carrier = opponent.id === current.carrierId;
                    return (
                      <g key={opponent.id} transform={`translate(${opponent.x} ${opponent.y})`} opacity={carrier ? 1 : .5}>
                        {carrier && <circle r="29" fill="rgba(255,214,90,.14)" stroke="#ffd65a" strokeWidth="3" />}
                        <circle r="16" fill="#ff5c6c" stroke="#fff" strokeWidth="2.6" />
                        <text y="4.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#fff">{opponent.role.replace("R-", "")}</text>
                        {carrier && <text y="-37" textAnchor="middle" className="patternDuty pressDuty">BALLFØRER</text>}
                      </g>
                    );
                  })}

                  {shape.players.map((player) => {
                    const stroke = player.duty === "press" ? "#ffd65a" : player.duty === "cover" ? "#9effb7" : player.duty === "balance" ? "#8bd7ff" : "#c6b9ff";
                    return (
                      <g key={player.id} className="patternPlayer" transform={`translate(${player.x} ${player.y})`}>
                        <circle r={player.duty === "press" ? 29 : 25} fill="none" stroke={stroke} strokeWidth={player.duty === "press" ? 4 : 2.7} opacity=".92" />
                        {player.duty === "press" && <circle r="35" fill="#ffd65a" opacity=".18" filter="url(#patternGlow)" />}
                        <circle r="15" fill="#3a8bff" stroke="#fff" strokeWidth="2.5" />
                        <text y="4.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#fff">{player.role}</text>
                        <text y="-32" textAnchor="middle" className={`patternDuty ${player.duty === "press" ? "pressDuty" : player.duty === "cover" ? "coverDuty" : "balanceDuty"}`}>{roleForDuty(player.duty)}</text>
                      </g>
                    );
                  })}

                  <g className="patternBall" transform={`translate(${shape.carrier.x} ${shape.carrier.y})`}>
                    <circle r="10" fill="#fff" stroke="#111" strokeWidth="2.4" />
                    <circle r="3.2" fill="#111" />
                  </g>
                </svg>

                <div className="patternTransport">
                  <button type="button" onClick={() => next(-1)}>◀</button>
                  <button className="patternPlay" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "❚❚ Pause" : "▶ Spill forsvarsmønster"}</button>
                  <button type="button" onClick={() => next(1)}>▶</button>
                  <span className="patternPhase">{phase + 1}/{phases.length} · {current.label}</span>
                  <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Mønsterfart">
                    <option value={0.6}>Rolig</option><option value={1}>Normal</option><option value={1.4}>Rask</option>
                  </select>
                </div>
              </div>

              <aside className="patternCoachPanel">
                <div className="patternNote">
                  <b>Akkurat nå</b>
                  <p><strong>Press:</strong> {presser ? defenderRole(presser.id) : "–"} · <strong>Sikring:</strong> {cover ? defenderRole(cover.id) : "–"} · <strong>Balanse:</strong> {balance ? defenderRole(balance.id) : "–"} · <strong>Motsatt back:</strong> {far ? defenderRole(far.id) : "–"}</p>
                </div>
                <div className="patternPrinciple"><span className="principleNumber">1</span><div><b>Nærmeste back/stopper går i press</b><p>Den av de fire som er nærmest ballfører bryter ut av fireren og setter press.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">2</span><div><b>Neste forsvarer sikrer</b><p>Spilleren ved siden av presseren faller skrått bak og inn og dekker rommet bak presset.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">3</span><div><b>Tredje forsvarer balanserer</b><p>Den neste holder avstand, dekker sentralt og sørger for at fireren fortsatt henger sammen.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">4</span><div><b>Motsatt back faller og smalner</b><p>Backen lengst fra ballen faller litt mot eget mål og inn mot stopperne når fireren forskyver.</p></div></div>
                <div className="patternNote"><b>Poenget med øvelsen</b><p>Ingen blå midtbanespillere eller angripere er med. Fokus er bare samhandlingen i backfireren når ballen flyttes fra side til side.</p></div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
