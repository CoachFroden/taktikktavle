"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };
type Player = Point & { id: string; role: string; line: "gk" | "back" | "mid" | "front" };
type Phase = { label: string; ball: Point };

const phases: Phase[] = [
  { label: "Ball venstre", ball: { x: 790, y: 105 } },
  { label: "Inn i venstre halvrom", ball: { x: 785, y: 225 } },
  { label: "Ball sentralt", ball: { x: 790, y: 325 } },
  { label: "Inn i høyre halvrom", ball: { x: 785, y: 425 } },
  { label: "Ball høyre", ball: { x: 790, y: 545 } },
  { label: "Tilbake sentralt", ball: { x: 790, y: 325 } },
];

const basePlayers: Player[] = [
  { id: "gk", role: "K", line: "gk", x: 92, y: 325 },
  { id: "lb", role: "VB", line: "back", x: 235, y: 112 },
  { id: "lcb", role: "VS", line: "back", x: 225, y: 255 },
  { id: "rcb", role: "HS", line: "back", x: 225, y: 395 },
  { id: "rb", role: "HB", line: "back", x: 235, y: 538 },
  { id: "l8", role: "8", line: "mid", x: 405, y: 175 },
  { id: "6", role: "6", line: "mid", x: 385, y: 325 },
  { id: "r8", role: "8", line: "mid", x: 405, y: 475 },
  { id: "lw", role: "VK", line: "front", x: 565, y: 125 },
  { id: "9", role: "9", line: "front", x: 585, y: 325 },
  { id: "rw", role: "HK", line: "front", x: 565, y: 525 },
];

const opponents: Point[] = [
  { x: 800, y: 105 },
  { x: 800, y: 225 },
  { x: 800, y: 325 },
  { x: 800, y: 425 },
  { x: 800, y: 545 },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function getShape(ball: Point) {
  const sideOffset = ball.y - 325;
  const shiftByLine = { gk: 0.08, back: 0.28, mid: 0.40, front: 0.50 } as const;
  const shifted = basePlayers.map((player) => ({
    ...player,
    y: clamp(player.y + sideOffset * shiftByLine[player.line], 75, 575),
  }));

  const outfield = shifted.filter((p) => p.line !== "gk");
  const pressCandidates = outfield.filter((p) => p.line === "front" || p.line === "mid");
  const presser = pressCandidates.reduce((best, player) => {
    const d = Math.hypot(ball.x - player.x, ball.y - player.y);
    const bestD = Math.hypot(ball.x - best.x, ball.y - best.y);
    return d < bestD ? player : best;
  }, pressCandidates[0]);

  const pressY = clamp(ball.y + (325 - ball.y) * 0.08, 70, 580);
  const result = shifted.map((player) => {
    let x = player.x;
    let y = player.y;
    let duty: "press" | "cover" | "balance" | "shift" = "shift";

    if (player.id === presser.id) {
      x = 685;
      y = pressY;
      duty = "press";
    } else if (player.line === "front") {
      const isOppositeWing = (ball.y < 250 && player.id === "rw") || (ball.y > 400 && player.id === "lw");
      if (isOppositeWing) {
        x -= 58;
        y += (325 - y) * 0.30;
        duty = "balance";
      } else {
        x -= 10;
        y += (ball.y - y) * 0.10;
        duty = "cover";
      }
    } else if (player.line === "mid") {
      const near = Math.abs(player.y - ball.y) < 125;
      if (near) {
        x += 45;
        y += (ball.y - y) * 0.14;
        duty = "cover";
      } else if (player.id === "6") {
        x += 22;
        duty = "cover";
      }
    } else if (player.line === "back") {
      const nearSide = Math.abs(player.y - ball.y) < 135;
      if (nearSide) x += 22;
      const farSide = (ball.y < 250 && player.id === "rb") || (ball.y > 400 && player.id === "lb");
      if (farSide) {
        x -= 8;
        y += (325 - y) * 0.18;
        duty = "balance";
      }
    }

    return { ...player, x, y, duty };
  });

  const cover = result
    .filter((p) => p.id !== presser.id && (p.line === "front" || p.line === "mid"))
    .sort((a, b) => Math.hypot(a.x - presser.x, a.y - presser.y) - Math.hypot(b.x - presser.x, b.y - presser.y))[0];
  if (cover) cover.duty = "cover";

  return { players: result, presserId: presser.id };
}

export default function PatternLibrary() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState(0);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  const shape = useMemo(() => getShape(phases[phase].ball), [phase]);

  useEffect(() => {
    if (!playing || !open) return;
    timerRef.current = window.setInterval(() => {
      setPhase((current) => (current + 1) % phases.length);
    }, 1700 / speed);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [playing, open, speed]);

  useEffect(() => {
    if (!open) setPlaying(false);
  }, [open]);

  function next(delta: number) {
    setPlaying(false);
    setPhase((current) => (current + delta + phases.length) % phases.length);
  }

  return (
    <>
      <button className="patternLauncher" type="button" onClick={() => setOpen(true)} title="Ferdige bevegelsesmønstre">
        <span>◈</span><b>Mønstre</b>
      </button>

      {open && (
        <div className="patternBackdrop" role="dialog" aria-modal="true" aria-label="Mønsterbibliotek">
          <section className="patternModal">
            <header className="patternHeader">
              <div>
                <span className="patternEyebrow">MØNSTERBIBLIOTEK</span>
                <h2>4-3-3 · Press, sikring og balanse</h2>
                <p>Ballflytting side–side utløser kollektiv forskyvning. Nærmeste spiller presser, resten sikrer og balanserer.</p>
              </div>
              <button className="patternClose" type="button" onClick={() => setOpen(false)} aria-label="Lukk">×</button>
            </header>

            <div className="patternContent">
              <div className="patternPitchCard">
                <svg className="patternPitch" viewBox="0 0 1000 650" aria-label="Animert 4-3-3 defensiv forskyvning">
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

                  <g opacity=".52">
                    {opponents.map((opponent, index) => (
                      <g key={index} transform={`translate(${opponent.x} ${opponent.y})`}>
                        <circle r="15" fill="#ff5c6c" stroke="#fff" strokeWidth="2.5" />
                        <text y="4.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff">{index + 2}</text>
                      </g>
                    ))}
                  </g>

                  {shape.players.map((player) => {
                    const isPress = player.duty === "press";
                    const isCover = player.duty === "cover";
                    const isBalance = player.duty === "balance";
                    return (
                      <g key={player.id} className="patternPlayer" transform={`translate(${player.x} ${player.y})`}>
                        {(isPress || isCover || isBalance) && <circle r={isPress ? 29 : 25} fill="none" stroke={isPress ? "#ffd65a" : isBalance ? "#8bd7ff" : "#9effb7"} strokeWidth={isPress ? 4 : 2.5} opacity={isPress ? 1 : .7} />}
                        {isPress && <circle r="34" fill="#ffd65a" opacity=".18" filter="url(#patternGlow)" />}
                        {player.line === "gk" ? <rect x="-15" y="-15" width="30" height="30" rx="7" fill="#3a8bff" stroke="#fff" strokeWidth="2.5" /> : <circle r="15" fill="#3a8bff" stroke="#fff" strokeWidth="2.5" />}
                        <text y="4.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#fff">{player.role}</text>
                        {isPress && <text y="-37" textAnchor="middle" className="patternDuty pressDuty">PRESS</text>}
                        {isBalance && <text y="-32" textAnchor="middle" className="patternDuty balanceDuty">BALANSE</text>}
                        {isCover && player.line !== "back" && <text y="-32" textAnchor="middle" className="patternDuty coverDuty">SIKRING</text>}
                      </g>
                    );
                  })}

                  <g className="patternBall" transform={`translate(${phases[phase].ball.x} ${phases[phase].ball.y})`}>
                    <circle r="11" fill="#fff" stroke="#111" strokeWidth="2.5" />
                    <circle r="3.5" fill="#111" />
                    <circle r="19" fill="none" stroke="#ffd65a" strokeWidth="2" opacity=".7" />
                  </g>
                </svg>

                <div className="patternTransport">
                  <button type="button" onClick={() => next(-1)}>◀</button>
                  <button className="patternPlay" type="button" onClick={() => setPlaying((v) => !v)}>{playing ? "❚❚ Pause" : "▶ Spill mønster"}</button>
                  <button type="button" onClick={() => next(1)}>▶</button>
                  <span className="patternPhase">{phase + 1}/{phases.length} · {phases[phase].label}</span>
                  <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Mønsterfart">
                    <option value={0.6}>Rolig</option><option value={1}>Normal</option><option value={1.4}>Rask</option>
                  </select>
                </div>
              </div>

              <aside className="patternCoachPanel">
                <div className="patternPrinciple"><span className="principleNumber">1</span><div><b>Nærmeste går i press</b><p>Spilleren nærmest ballfører bryter ut av leddet og styrer presset.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">2</span><div><b>Sikring bak og på innsiden</b><p>Nærmeste medspillere forskyver bak presseren slik at laget ikke åpner rom sentralt.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">3</span><div><b>Hele laget forskyver</b><p>Midtbane og backfirer flyttes mot ballsiden og holder avstandene kompakte.</p></div></div>
                <div className="patternPrinciple"><span className="principleNumber">4</span><div><b>Motsatt kant balanserer</b><p>Fjern kant faller litt lavere og smalere i stedet for å bli stående høyt og bredt.</p></div></div>
                <div className="patternNote"><b>Trenerpoeng</b><p>Dette illustrerer prinsippene, ikke faste meter. Avstander og hvem som presser må alltid tilpasses ballposisjon, motstander og presshøyde.</p></div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
