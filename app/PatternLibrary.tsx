"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type PlayerPoint = Point & { id: number };
type PatternScene = {
  label: string;
  pressBlue: number;
  ballRed: number;
  blue: PlayerPoint[];
  red: PlayerPoint[];
};

const redBase: PlayerPoint[] = [
  { id: 1, x: 410, y: 70 },
  { id: 2, x: 405, y: 245 },
  { id: 3, x: 410, y: 415 },
  { id: 4, x: 425, y: 565 },
];

// Fire faste, manuelt definerte scener basert på referansebildene.
// Viktig: gul markering viser PRESseren, ikke spilleren som var valgt i editoren på referansebildet.
const scenes: PatternScene[] = [
  {
    label: "Rød 1 → Blå 4 presser",
    pressBlue: 4,
    ballRed: 1,
    red: redBase,
    blue: [
      { id: 1, x: 210, y: 260 },
      { id: 2, x: 210, y: 390 },
      { id: 3, x: 260, y: 485 },
      { id: 4, x: 350, y: 95 },
      { id: 5, x: 495, y: 50 },
      { id: 6, x: 430, y: 575 },
    ],
  },
  {
    label: "Rød 2 → Blå 1 presser",
    pressBlue: 1,
    ballRed: 2,
    red: redBase,
    blue: [
      { id: 1, x: 350, y: 245 },
      { id: 2, x: 270, y: 335 },
      { id: 3, x: 285, y: 445 },
      { id: 4, x: 275, y: 155 },
      { id: 5, x: 470, y: 65 },
      { id: 6, x: 440, y: 570 },
    ],
  },
  {
    label: "Rød 3 → Blå 2 presser",
    pressBlue: 2,
    ballRed: 3,
    red: redBase,
    blue: [
      { id: 1, x: 285, y: 295 },
      { id: 2, x: 350, y: 410 },
      { id: 3, x: 300, y: 480 },
      { id: 4, x: 275, y: 180 },
      { id: 5, x: 445, y: 70 },
      { id: 6, x: 470, y: 580 },
    ],
  },
  {
    label: "Rød 4 → Blå 3 presser",
    pressBlue: 3,
    ballRed: 4,
    red: redBase,
    blue: [
      { id: 1, x: 250, y: 365 },
      { id: 2, x: 280, y: 445 },
      { id: 3, x: 365, y: 545 },
      { id: 4, x: 245, y: 280 },
      { id: 5, x: 430, y: 100 },
      { id: 6, x: 500, y: 600 },
    ],
  },
];

function findPlayer(players: PlayerPoint[], id: number) {
  return players.find((player) => player.id === id) ?? players[0];
}

export default function PatternLibrary() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  const scene = scenes[sceneIndex];
  const ballCarrier = findPlayer(scene.red, scene.ballRed);
  const presser = findPlayer(scene.blue, scene.pressBlue);

  useEffect(() => {
    if (!playing || !open) return;
    timerRef.current = window.setInterval(() => {
      setSceneIndex((current) => (current + 1) % scenes.length);
    }, 1900 / speed);

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [playing, open, speed]);

  useEffect(() => {
    if (!open) setPlaying(false);
  }, [open]);

  function step(delta: number) {
    setPlaying(false);
    setSceneIndex((current) => (current + delta + scenes.length) % scenes.length);
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
                <span className="patternEyebrow">FERDIG MØNSTER · 4 FASTE SCENER</span>
                <h2>Forsvarsmønster – Frode 1</h2>
                <p>Ballfører flyttes fra rød 1 til 4. Den nærmeste blå forsvarsspilleren støter ut, mens resten forskyver etter de manuelt definerte posisjonene fra referansebildene.</p>
              </div>
              <button className="patternClose" type="button" onClick={() => setOpen(false)} aria-label="Lukk">×</button>
            </header>

            <div className="patternContent">
              <div className="patternPitchCard">
                <svg className="patternPitch" viewBox="0 0 1000 650" aria-label="Forsvarsmønster med fire faste scener">
                  <defs>
                    <linearGradient id="patternGrass" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#17683d" />
                      <stop offset="55%" stopColor="#237e49" />
                      <stop offset="100%" stopColor="#125b36" />
                    </linearGradient>
                    <filter id="patternGlow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="8" /></filter>
                    <marker id="pressArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="#ffe06f" /></marker>
                  </defs>

                  <rect width="1000" height="650" fill="url(#patternGrass)" />
                  {Array.from({ length: 20 }).map((_, index) => (
                    <rect key={index} x={index * 50} width="50" height="650" fill={index % 2 ? "rgba(0,0,0,.022)" : "rgba(255,255,255,.018)"} />
                  ))}
                  <g stroke="rgba(255,255,255,.88)" strokeWidth="3.5" fill="none">
                    <rect x="30" y="30" width="940" height="590" rx="2" />
                    <line x1="500" y1="30" x2="500" y2="620" />
                    <circle cx="500" cy="325" r="82" />
                    <circle cx="500" cy="325" r="3" fill="rgba(255,255,255,.9)" />
                    <rect x="30" y="175" width="155" height="300" />
                    <rect x="30" y="245" width="62" height="160" />
                    <rect x="815" y="175" width="155" height="300" />
                    <rect x="908" y="245" width="62" height="160" />
                  </g>

                  <line
                    x1={presser.x + 18}
                    y1={presser.y}
                    x2={ballCarrier.x - 24}
                    y2={ballCarrier.y}
                    stroke="#ffe06f"
                    strokeWidth="3"
                    strokeDasharray="9 7"
                    markerEnd="url(#pressArrow)"
                    opacity=".9"
                  />

                  {scene.red.map((player) => (
                    <g key={`red-${player.id}`} className="patternPlayer" transform={`translate(${player.x} ${player.y})`}>
                      <circle r="16" fill="#ff6272" stroke="#fff" strokeWidth="2.6" opacity={player.id === scene.ballRed ? 1 : .56} />
                      <text y="5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">{player.id}</text>
                    </g>
                  ))}

                  {scene.blue.map((player) => {
                    const pressing = player.id === scene.pressBlue;
                    return (
                      <g key={`blue-${player.id}`} className="patternPlayer" transform={`translate(${player.x} ${player.y})`}>
                        {pressing && <circle r="31" fill="#ffd65a" opacity=".18" filter="url(#patternGlow)" />}
                        {pressing && <circle r="26" fill="none" stroke="#ffe06f" strokeWidth="4" />}
                        <circle r="16" fill="#3b82f6" stroke="#fff" strokeWidth="2.6" opacity={pressing ? 1 : .74} />
                        <text y="5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">{player.id}</text>
                      </g>
                    );
                  })}

                  <g className="patternBall" transform={`translate(${ballCarrier.x - 24} ${ballCarrier.y + 4})`}>
                    <circle r="10" fill="#fff" stroke="#111" strokeWidth="2.5" />
                    <circle r="3.5" fill="#111" />
                  </g>
                </svg>

                <div className="patternTransport">
                  <button type="button" onClick={() => step(-1)} aria-label="Forrige scene">◀</button>
                  <button className="patternPlay" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "❚❚ Pause" : "▶ Spill mønster"}</button>
                  <button type="button" onClick={() => step(1)} aria-label="Neste scene">▶</button>
                  <span className="patternPhase">{sceneIndex + 1}/{scenes.length} · {scene.label}</span>
                  <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Mønsterfart">
                    <option value={0.65}>Rolig</option>
                    <option value={1}>Normal</option>
                    <option value={1.4}>Rask</option>
                  </select>
                </div>
              </div>

              <aside className="patternCoachPanel">
                <div className="patternNote">
                  <b>Scene {sceneIndex + 1}</b>
                  <p><strong>Ball:</strong> rød {scene.ballRed}<br /><strong>Presser:</strong> blå {scene.pressBlue}</p>
                </div>

                {scenes.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    className="patternPrinciple"
                    onClick={() => {
                      setPlaying(false);
                      setSceneIndex(index);
                    }}
                    style={{ textAlign: "left", color: "inherit", cursor: "pointer", width: "100%" }}
                  >
                    <span className="principleNumber">{index + 1}</span>
                    <div>
                      <b>{item.label}</b>
                      <p>{index === sceneIndex ? "Vises nå" : "Trykk for å gå direkte til denne scenen"}</p>
                    </div>
                  </button>
                ))}

                <div className="patternNote">
                  <b>Pressrekkefølge</b>
                  <p>Rød 1 → blå 4<br />Rød 2 → blå 1<br />Rød 3 → blå 2<br />Rød 4 → blå 3</p>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
