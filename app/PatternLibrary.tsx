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

const basePlayers: Player[] = [
  { id: "gk", role: "K", line: "gk", x: 92, y: 325 },
  { id: "lb", role: "VB", line: "back", x: 235, y: 112 },
  { id: "lcb", role: "VS", line: "back", x: 225, y: 255 },
  { id: "rcb", role: "HS", line: "back", x: 225, y: 395 },
  { id: "rb", role: "HB", line: "back", x: 235, y: 538 },
  { id: "l8", role: "V8", line: "mid", x: 405, y: 175 },
  { id: "6", role: "6", line: "mid", x: 385, y: 325 },
  { id: "r8", role: "H8", line: "mid", x: 405, y: 475 },
  { id: "lw", role: "VK", line: "front", x: 565, y: 125 },
  { id: "9", role: "9", line: "front", x: 585, y: 325 },
  { id: "rw", role: "HK", line: "front", x: 565, y: 525 },
];

const opponents: Opponent[] = [
  { id: "rrb", role: "R-HB", x: 785, y: 105 },
  { id: "rrcb", role: "R-HS", x: 810, y: 245 },
  { id: "rlcb", role: "R-VS", x: 810, y: 405 },
  { id: "rlb", role: "R-VB", x: 785, y: 545 },
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
  const sideShift = phase.side * 62;
  const lineFactor: Record<Line, number> = { gk: 0.08, back: 0.42, mid: 0.62, front: 0.78 };

  const players = basePlayers.map((player) => {
    let x = player.x;
    let y = clamp(player.y + sideShift * lineFactor[player.line], 70, 580);
    let duty: Duty = "shift";

    if (player.id === phase.pressId) {
      x = carrier.x - 100;
      y = carrier.y + (325 - carrier.y) * 0.06;
      duty = "press";
    } else if (phase.coverIds.includes(player.id)) {
      const coverIndex = phase.coverIds.indexOf(player.id);
      x = carrier.x - (195 + coverIndex * 70);
      y = carrier.y + (325 - carrier.y) * (0.32 + coverIndex * 0.16);
      duty = "cover";
    } else if (player.id === phase.balanceId) {
      x = 500;
      y = phase.side === -1 ? 430 : 220;
      duty = "balance";
    } else if (player.line === "front") {
      x -= 18;
      y += (325 - y) * 0.08;
    } else if (player.line === "mid") {
      x += 18;
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
                <h2>4-3-3 · Hvem presser, hvem sikrer?</h2>
                <p>Rødt lag har ballen. Blått lag forsvarer målet til venstre og reagerer på hver pasning med press, sikring, kollektiv forskyvning og balanse på motsatt side.</p>
              </div>
              <button className="patternClose" type="button" onClick={() => setOpen(false)} aria-label="Lukk">×</button>
            </header>

            <div className="patternContent">
              <div className="patternPitchCard">
                <svg className="patternPitch" viewBox="0 0 1000 650" aria-label="Defensiv 4-3-3-forskyvning mot rødt lag i ballbesittelse">
                  <defs>
                    <linearGradient id="patternGrass" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#17683d" />
                      <stop offset="55%" stopColor="#237e49" />
                      <stop offset="100%" stopColor="#125b36" />
                    </linearGradient>
                    <filter id="patternGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
                  </defs>

                  <rect width="1000" height="650" fill="url(#patternGrass)" />
                  {Array.from({ length: 10 }).map((_, i) => <rect key={i} x={i * 100} width="100" height="650" fill={i % 2 ? "rgba(0,0,0,.025)" : "rgba(255,255,255,.025)"} />)}
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
                    <rect x="48" y="48" width="145" height="34" rx="10" fill="rgba(58,139,255,.16)" stroke="rgba(170,210,255,.45)" />
                    <text x="120" y="70" textAnchor="middle" fill="#dcecff" fontSize="13" fontWeight="900">BLÅ FORSVARER</text>
                    <rect x="755" y="48" width="195" height="34" rx="10" fill="rgba(255,92,108,.14)" stroke="rgba(255,160,170,.42)" />
                    <text x="852" y="70" textAnchor="middle" fill="#ffd9de" fontSize="13" fontWeight="900">RØD HAR BALLEN</text>
                  </g>

                  {opponents.map((opponent) => {
                    const carrier = opponent.id === current.carrierId;
                    return (
                      <g key={opponent.id} transform={`translate(${opponent.x} ${opponent.y})`} opacity={carrier ? 1 : .64}>
                        {carrier && <circle r="29" fill="rgba(255,214,90,.14)" stroke="#ffd65a" strokeWidth="3" />}
                        <circle r="16" fill="#ff5c6c" stroke="#fff" strokeWidth="2.6" />
                        <text y="4.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#fff">{opponent.role.replace("R-", "")}</text>
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
                        {isBalance && <text y="-32" textAnchor="middle" className="patternDuty balanceDuty">3F · BALANSE</text>}
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
                <div className="patternPrinciple"><span className="principleNumber">1</span><div><b>1. forsvarer går i press</b><p>Spilleren som har kortest og mest naturlig vei til ballfører bryter ut og setter press.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">2</span><div><b>2. forsvarer sikrer</b><p>Nærmeste spiller bak og på innsiden dekker rommet bak presseren. Sekseren beskytter samtidig sentralt.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">3</span><div><b>Resten forskyver samlet</b><p>Midtbane og backfirer flytter mot ballsiden slik at avstandene mellom spillerne og leddene ikke blir store.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">4</span><div><b>Motsatt kant gir balanse</b><p>Kanten lengst fra ballen faller litt ned og inn. Han skal ikke bli stående høyt og bredt når resten av laget forskyver.</p></div></div>
                <div className="patternNote"><b>Poenget med øvelsen</b><p>Rødt lag flytter bare ballen. Det vi trener på er reaksjonen hos laget uten ball: PRESS → SIKRING → BALANSE, om og om igjen.</p></div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
