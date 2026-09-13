"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };
type Line = "gk" | "back" | "mid" | "front";
type Duty = "press" | "cover" | "balance" | "shift";
type Player = Point & { id: string; role: string; line: Line };
type Opponent = Point & { id: string; role: string };
type Phase = {
  label: string;
  carrierId: string;
  pressId: string;
  coverIds: string[];
  balanceId: string;
  side: -1 | 1;
};

// Blått forsvarer målet til venstre. Hele grunnformen ligger i egen halvdel.
const basePlayers: Player[] = [
  { id: "gk", role: "K", line: "gk", x: 92, y: 325 },
  { id: "lb", role: "VB", line: "back", x: 205, y: 125 },
  { id: "lcb", role: "VS", line: "back", x: 195, y: 255 },
  { id: "rcb", role: "HS", line: "back", x: 195, y: 395 },
  { id: "rb", role: "HB", line: "back", x: 205, y: 525 },
  { id: "l8", role: "V8", line: "mid", x: 305, y: 190 },
  { id: "6", role: "6", line: "mid", x: 290, y: 325 },
  { id: "r8", role: "H8", line: "mid", x: 305, y: 460 },
  { id: "lw", role: "VK", line: "front", x: 395, y: 155 },
  { id: "9", role: "9", line: "front", x: 410, y: 325 },
  { id: "rw", role: "HK", line: "front", x: 395, y: 495 },
];

// Rødt flytter ballen foran den blå blokka, rundt midtbanen – ikke ved eget straffefelt.
const opponents: Opponent[] = [
  { id: "rrb", role: "HB", x: 555, y: 115 },
  { id: "rrcb", role: "HS", x: 575, y: 250 },
  { id: "rlcb", role: "VS", x: 575, y: 400 },
  { id: "rlb", role: "VB", x: 555, y: 535 },
];

const phases: Phase[] = [
  { label: "Ball hos rød høyreback", carrierId: "rrb", pressId: "lw", coverIds: ["l8", "6"], balanceId: "rw", side: -1 },
  { label: "Ball hos rød høyre stopper", carrierId: "rrcb", pressId: "9", coverIds: ["l8", "6"], balanceId: "rw", side: -1 },
  { label: "Ball hos rød venstre stopper", carrierId: "rlcb", pressId: "9", coverIds: ["r8", "6"], balanceId: "lw", side: 1 },
  { label: "Ball hos rød venstreback", carrierId: "rlb", pressId: "rw", coverIds: ["r8", "6"], balanceId: "lw", side: 1 },
  { label: "Tilbake til rød venstre stopper", carrierId: "rlcb", pressId: "9", coverIds: ["r8", "6"], balanceId: "lw", side: 1 },
  { label: "Over til rød høyre stopper", carrierId: "rrcb", pressId: "9", coverIds: ["l8", "6"], balanceId: "rw", side: -1 },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function getOpponent(id: string) {
  return opponents.find((opponent) => opponent.id === id) ?? opponents[0];
}

function getDefensiveShape(phase: Phase) {
  const carrier = getOpponent(phase.carrierId);
  const lateralShift = phase.side * 52;
  const lineFactor: Record<Line, number> = { gk: 0.05, back: 0.48, mid: 0.68, front: 0.84 };
  const pressX = Math.min(480, carrier.x - 72);

  const players = basePlayers.map((player) => {
    let x = player.x;
    let y = clamp(player.y + lateralShift * lineFactor[player.line], 80, 570);
    let duty: Duty = "shift";

    if (player.id === phase.pressId) {
      x = pressX;
      y = carrier.y + (325 - carrier.y) * 0.07;
      duty = "press";
    } else if (phase.coverIds.includes(player.id)) {
      const coverIndex = phase.coverIds.indexOf(player.id);
      if (coverIndex === 0) {
        x = pressX - 70;
        y = carrier.y + (325 - carrier.y) * 0.36;
      } else {
        x = pressX - 112;
        y = 325 + (carrier.y - 325) * 0.18;
      }
      duty = "cover";
    } else if (player.id === phase.balanceId) {
      // Motsatt kant FALLER mot eget mål (lavere x) og går samtidig inn i banen.
      x = 335;
      y = phase.side === -1 ? 425 : 225;
      duty = "balance";
    } else if (player.line === "front") {
      // De øvrige i frontleddet blir i blokka og smalner inn.
      x = player.x - 12;
      y += (325 - y) * 0.10;
    } else if (player.line === "mid") {
      x = player.x + 5;
    }

    return { ...player, x, y, duty };
  });

  return { players, carrier };
}

function roleName(id: string) {
  return basePlayers.find((player) => player.id === id)?.role ?? id;
}

export default function PatternLibrary() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState(0);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  const current = phases[phase];
  const shape = useMemo(() => getDefensiveShape(current), [current]);
  const presser = shape.players.find((player) => player.id === current.pressId);

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
                <span className="patternEyebrow">FORSVARSMØNSTER</span>
                <h2>4-3-3 · Press, sikring og balanse</h2>
                <p>Blått forsvarer eget mål til venstre i en kompakt 4-3-3. Rødt flytter ballen side–side foran blokka. Hver pasning utløser nytt press, sikring og kollektiv forskyvning.</p>
              </div>
              <button className="patternClose" type="button" onClick={() => setOpen(false)} aria-label="Lukk">×</button>
            </header>

            <div className="patternContent">
              <div className="patternPitchCard">
                <svg className="patternPitch" viewBox="0 0 1000 650" aria-label="4-3-3 i defensiv blokk på egen halvdel">
                  <defs>
                    <linearGradient id="patternGrass" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#17683d" />
                      <stop offset="55%" stopColor="#237e49" />
                      <stop offset="100%" stopColor="#125b36" />
                    </linearGradient>
                    <filter id="patternGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
                    <marker id="pressArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M0 0 L10 5 L0 10Z" fill="#ffd65a" />
                    </marker>
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
                    <rect x="48" y="48" width="145" height="34" rx="10" fill="rgba(58,139,255,.18)" stroke="rgba(170,210,255,.5)" />
                    <text x="120" y="70" textAnchor="middle" fill="#dcecff" fontSize="13" fontWeight="900">BLÅTT MÅL</text>
                    <text x="260" y="604" textAnchor="middle" fill="rgba(220,236,255,.68)" fontSize="12" fontWeight="800">BLÅ EGEN HALVDEL</text>
                    <rect x="535" y="48" width="220" height="34" rx="10" fill="rgba(255,92,108,.14)" stroke="rgba(255,160,170,.42)" />
                    <text x="645" y="70" textAnchor="middle" fill="#ffd9de" fontSize="13" fontWeight="900">RØD FLYTTER BALLEN</text>
                  </g>

                  {presser && (
                    <line
                      x1={presser.x + 18}
                      y1={presser.y}
                      x2={shape.carrier.x - 22}
                      y2={shape.carrier.y}
                      stroke="#ffd65a"
                      strokeWidth="3.5"
                      strokeDasharray="10 7"
                      markerEnd="url(#pressArrow)"
                      opacity=".9"
                    />
                  )}

                  {opponents.map((opponent) => {
                    const carrier = opponent.id === current.carrierId;
                    return (
                      <g key={opponent.id} transform={`translate(${opponent.x} ${opponent.y})`} opacity={carrier ? 1 : .62}>
                        {carrier && <circle r="29" fill="rgba(255,214,90,.14)" stroke="#ffd65a" strokeWidth="3" />}
                        <circle r="16" fill="#ff5c6c" stroke="#fff" strokeWidth="2.6" />
                        <text y="4.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff">{opponent.role}</text>
                        {carrier && <text y="-37" textAnchor="middle" className="patternDuty pressDuty">BALLFØRER</text>}
                      </g>
                    );
                  })}

                  {shape.players.map((player) => {
                    const isPress = player.duty === "press";
                    const isCover = player.duty === "cover";
                    const isBalance = player.duty === "balance";
                    return (
                      <g key={player.id} className="patternPlayer" transform={`translate(${player.x} ${player.y})`}>
                        {(isPress || isCover || isBalance) && (
                          <circle
                            r={isPress ? 29 : 25}
                            fill="none"
                            stroke={isPress ? "#ffd65a" : isBalance ? "#8bd7ff" : "#9effb7"}
                            strokeWidth={isPress ? 4 : 2.7}
                            opacity={isPress ? 1 : .88}
                          />
                        )}
                        {isPress && <circle r="35" fill="#ffd65a" opacity=".18" filter="url(#patternGlow)" />}
                        {player.line === "gk" ? (
                          <rect x="-15" y="-15" width="30" height="30" rx="7" fill="#3a8bff" stroke="#fff" strokeWidth="2.5" />
                        ) : (
                          <circle r="15" fill="#3a8bff" stroke="#fff" strokeWidth="2.5" />
                        )}
                        <text y="4.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#fff">{player.role}</text>
                        {isPress && <text y="-37" textAnchor="middle" className="patternDuty pressDuty">1F · PRESS</text>}
                        {isCover && <text y="-32" textAnchor="middle" className="patternDuty coverDuty">2F · SIKRING</text>}
                        {isBalance && <text y="-32" textAnchor="middle" className="patternDuty balanceDuty">BALANSE</text>}
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
                  <p><strong>Press:</strong> {roleName(current.pressId)} · <strong>Sikring:</strong> {current.coverIds.map(roleName).join(" + ")} · <strong>Balanse:</strong> {roleName(current.balanceId)}</p>
                </div>
                <div className="patternPrinciple"><span className="principleNumber">1</span><div><b>1. forsvarer går i press</b><p>Nærmeste spiller går ut mot ballfører, mens resten ikke følger etter ukritisk.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">2</span><div><b>2. forsvarer sikrer</b><p>Nærmeste spiller bak og på innsiden dekker rommet bak presseren. Sekseren beskytter det sentrale rommet.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">3</span><div><b>Laget forskyver på tvers</b><p>Alle flytter mot ballsiden og gjør laget smalt, men beholder dybde og avstander mellom leddene.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">4</span><div><b>Motsatt kant faller</b><p>Kanten lengst fra ballen går både inn i banen og bakover mot eget mål for å gi balanse.</p></div></div>
                <div className="patternNote"><b>Poenget med øvelsen</b><p>Rødt flytter bare ballen foran blokka. Blått trener reaksjonen: PRESS → SIKRING → FORSKYVNING → BALANSE, før ballen flyttes igjen.</p></div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
