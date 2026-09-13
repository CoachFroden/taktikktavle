"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type Point = { x: number; y: number };
type Team = "blue" | "red";
type ObjectType = "player" | "ball" | "cone";
type Tool =
  | "select"
  | "blue"
  | "red"
  | "keeperBlue"
  | "keeperRed"
  | "ball"
  | "cone"
  | "arrow"
  | "run"
  | "movement"
  | "freeMovement";
type PitchType = "11er" | "9er" | "7er" | "5er";

type BoardObject = {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  team?: Team;
  role?: "player" | "keeper";
  number?: string;
  name?: string;
  target?: Point;
  motionPath?: Point[];
};

type BoardLine = {
  id: string;
  type: "arrow" | "run";
  start: Point;
  end: Point;
};

type DrawingLine = {
  type: "arrow" | "run";
  start: Point;
  current: Point;
};

type FreehandDrawing = {
  objectId: string;
  pointerId: number;
  points: Point[];
};

const pitchConfig: Record<PitchType, { penaltyDepth: number; penaltyHeight: number; goalDepth: number; goalHeight: number; centerRadius: number }> = {
  "11er": { penaltyDepth: 155, penaltyHeight: 300, goalDepth: 62, goalHeight: 160, centerRadius: 88 },
  "9er": { penaltyDepth: 145, penaltyHeight: 285, goalDepth: 58, goalHeight: 150, centerRadius: 80 },
  "7er": { penaltyDepth: 125, penaltyHeight: 260, goalDepth: 52, goalHeight: 140, centerRadius: 72 },
  "5er": { penaltyDepth: 105, penaltyHeight: 230, goalDepth: 46, goalHeight: 126, centerRadius: 62 },
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pointDistance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const tools: Array<{ id: Tool; title: string; hint: string }> = [
  { id: "select", title: "↖ Velg", hint: "Flytt og rediger" },
  { id: "movement", title: "◎ Rett bevegelse", hint: "Sett A → B" },
  { id: "freeMovement", title: "〰 Fri bevegelse", hint: "Tegn bevegelsen" },
  { id: "blue", title: "● Blå spiller", hint: "Legg på banen" },
  { id: "red", title: "● Rød spiller", hint: "Legg på banen" },
  { id: "keeperBlue", title: "▣ Blå keeper", hint: "Legg på banen" },
  { id: "keeperRed", title: "▣ Rød keeper", hint: "Legg på banen" },
  { id: "ball", title: "⚽ Ball", hint: "Legg på banen" },
  { id: "cone", title: "▲ Kjegle", hint: "Legg på banen" },
  { id: "arrow", title: "➜ Pil", hint: "Pasning / retning" },
  { id: "run", title: "⋯ Løp", hint: "Stiplet linje" },
];

function pointAlongPath(path: Point[], progress: number): Point {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1 || progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];

  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const length = pointDistance(path[i - 1], path[i]);
    lengths.push(length);
    total += length;
  }
  if (total === 0) return path[path.length - 1];

  const wanted = total * progress;
  let travelled = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const nextTravelled = travelled + lengths[i];
    if (wanted <= nextTravelled) {
      const local = lengths[i] === 0 ? 0 : (wanted - travelled) / lengths[i];
      const start = path[i];
      const end = path[i + 1];
      return {
        x: start.x + (end.x - start.x) * local,
        y: start.y + (end.y - start.y) * local,
      };
    }
    travelled = nextTravelled;
  }
  return path[path.length - 1];
}

function pathLength(path: Point[]) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += pointDistance(path[i - 1], path[i]);
  return total;
}

export default function Home() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const animationStartRef = useRef(0);
  const freehandRef = useRef<FreehandDrawing | null>(null);

  const [title, setTitle] = useState("Ny taktikk");
  const [pitch, setPitch] = useState<PitchType>("11er");
  const [tool, setTool] = useState<Tool>("select");
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const [lines, setLines] = useState<BoardLine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; pointerId: number } | null>(null);
  const [drawing, setDrawing] = useState<DrawingLine | null>(null);
  const [freehandPreview, setFreehandPreview] = useState<Point[]>([]);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState("Velg et verktøy og trykk på banen.");

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );

  const config = pitchConfig[pitch];

  function boardPoint(event: ReactPointerEvent<SVGSVGElement | SVGGElement>): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 500, y: 325 };
    const rect = svg.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 1000, 24, 976),
      y: clamp(((event.clientY - rect.top) / rect.height) * 650, 24, 626),
    };
  }

  function stopAnimation(reset = false) {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    setIsPlaying(false);
    if (reset) setProgress(0);
  }

  function cancelFreehand() {
    freehandRef.current = null;
    setFreehandPreview([]);
  }

  function chooseTool(nextTool: Tool) {
    stopAnimation(true);
    cancelFreehand();
    setTool(nextTool);
    setDrawing(null);
    if (nextTool === "movement") {
      setStatus(selectedId ? "Trykk på banen der det valgte objektet skal ende." : "Velg først en spiller eller ball, og trykk deretter på sluttpunktet.");
    } else if (nextTool === "freeMovement") {
      setStatus(selectedId ? "Trykk på det valgte objektet og tegn bevegelsen med mus eller finger." : "Velg først en spiller eller ball. Trykk deretter «Fri bevegelse» og tegn fra objektet.");
    } else if (nextTool === "select") {
      setStatus("Dra objekter for å flytte dem. Trykk et objekt for å redigere det.");
    } else if (nextTool === "arrow" || nextTool === "run") {
      setStatus("Dra fra startpunkt til sluttpunkt for å tegne.");
    } else {
      setStatus("Trykk på banen for å plassere objektet.");
    }
  }

  function addObject(point: Point) {
    const blueCount = objects.filter((object) => object.type === "player" && object.team === "blue").length;
    const redCount = objects.filter((object) => object.type === "player" && object.team === "red").length;
    let next: BoardObject | null = null;

    if (tool === "blue" || tool === "red" || tool === "keeperBlue" || tool === "keeperRed") {
      const team: Team = tool === "blue" || tool === "keeperBlue" ? "blue" : "red";
      const keeper = tool === "keeperBlue" || tool === "keeperRed";
      next = {
        id: makeId(),
        type: "player",
        team,
        role: keeper ? "keeper" : "player",
        number: keeper ? "K" : String((team === "blue" ? blueCount : redCount) + 1),
        name: "",
        ...point,
      };
    } else if (tool === "ball") {
      next = { id: makeId(), type: "ball", ...point };
    } else if (tool === "cone") {
      next = { id: makeId(), type: "cone", ...point };
    }

    if (next) {
      setObjects((current) => [...current, next as BoardObject]);
      setSelectedId(next.id);
      setStatus("Objekt lagt til. Fortsett å plassere flere, eller velg et annet verktøy.");
    }
  }

  function handleBoardPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget && (event.target as Element).closest("[data-board-object='true']")) return;
    const point = boardPoint(event);

    if (["blue", "red", "keeperBlue", "keeperRed", "ball", "cone"].includes(tool)) {
      addObject(point);
      return;
    }

    if (tool === "movement") {
      if (!selectedId) {
        setStatus("Velg først objektet som skal bevege seg.");
        return;
      }
      setObjects((current) => current.map((object) => object.id === selectedId ? { ...object, target: point, motionPath: undefined } : object));
      setProgress(0);
      setStatus("Sluttpunkt satt. Du kan velge et nytt objekt og gi det en bevegelse også.");
      return;
    }

    if (tool === "freeMovement") {
      setStatus(selectedId ? "Start frihåndstegningen ved å trykke og dra på det valgte objektet." : "Velg først objektet som skal bevege seg.");
      return;
    }

    if (tool === "arrow" || tool === "run") {
      setDrawing({ type: tool, start: point, current: point });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "select") setSelectedId(null);
  }

  function handleBoardPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const point = boardPoint(event);
    if (dragging && tool === "select") {
      setProgress(0);
      setObjects((current) => current.map((object) => object.id === dragging.id ? { ...object, x: point.x, y: point.y } : object));
    }
    if (drawing) setDrawing({ ...drawing, current: point });

    const freehand = freehandRef.current;
    if (freehand && tool === "freeMovement") {
      const last = freehand.points[freehand.points.length - 1];
      if (pointDistance(last, point) >= 5) {
        freehand.points.push(point);
        setFreehandPreview([...freehand.points]);
      }
    }
  }

  function finishFreehand(event: ReactPointerEvent<SVGSVGElement>) {
    const freehand = freehandRef.current;
    if (!freehand) return;

    const point = boardPoint(event);
    const last = freehand.points[freehand.points.length - 1];
    if (pointDistance(last, point) >= 3) freehand.points.push(point);

    const finalPath = [...freehand.points];
    freehandRef.current = null;
    setFreehandPreview([]);

    if (finalPath.length >= 2 && pathLength(finalPath) > 12) {
      setObjects((current) => current.map((object) => object.id === freehand.objectId ? { ...object, target: undefined, motionPath: finalPath } : object));
      setProgress(0);
      setStatus("Fri bevegelse lagret. Trykk Play for å se objektet følge kurven.");
    } else {
      setStatus("Bevegelsen ble for kort. Tegn en litt lengre bane.");
    }
  }

  function handleBoardPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragging) setDragging(null);
    if (freehandRef.current) finishFreehand(event);

    if (drawing) {
      const end = boardPoint(event);
      const distance = pointDistance(drawing.start, end);
      if (distance > 10) {
        setLines((current) => [...current, { id: makeId(), type: drawing.type, start: drawing.start, end }]);
        setStatus("Linje lagt til.");
      }
      setDrawing(null);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleObjectPointerDown(event: ReactPointerEvent<SVGGElement>, object: BoardObject) {
    event.stopPropagation();
    stopAnimation(true);
    setSelectedId(object.id);

    if (tool === "select") {
      setDragging({ id: object.id, pointerId: event.pointerId });
      event.currentTarget.setPointerCapture(event.pointerId);
      setStatus("Flytter objekt. Slipp når det står riktig.");
    } else if (tool === "movement") {
      setStatus("Objekt valgt. Trykk på banen der det skal ende.");
    } else if (tool === "freeMovement") {
      const start = { x: object.x, y: object.y };
      const freehand: FreehandDrawing = { objectId: object.id, pointerId: event.pointerId, points: [start] };
      freehandRef.current = freehand;
      setFreehandPreview([start]);
      setObjects((current) => current.map((currentObject) => currentObject.id === object.id ? { ...currentObject, target: undefined, motionPath: undefined } : currentObject));
      event.currentTarget.setPointerCapture(event.pointerId);
      setStatus("Tegn bevegelsen mens du holder inne. Slipp når løpsbanen er ferdig.");
    }
  }

  function displayPoint(object: BoardObject): Point {
    if (object.motionPath && object.motionPath.length > 1) return pointAlongPath(object.motionPath, progress);
    if (!object.target) return { x: object.x, y: object.y };
    return {
      x: object.x + (object.target.x - object.x) * progress,
      y: object.y + (object.target.y - object.y) * progress,
    };
  }

  function togglePlayback() {
    const hasMovement = objects.some((object) => object.target || (object.motionPath && object.motionPath.length > 1));
    if (!hasMovement) {
      setStatus("Ingen bevegelser er lagt inn ennå. Bruk «Rett bevegelse» eller «Fri bevegelse».");
      return;
    }

    if (isPlaying) {
      stopAnimation(false);
      setStatus("Animasjon satt på pause.");
      return;
    }

    const duration = 1800 / speed;
    if (progress >= 1) setProgress(0);
    const startingProgress = progress >= 1 ? 0 : progress;
    animationStartRef.current = performance.now() - startingProgress * duration;
    setIsPlaying(true);
    setStatus("Spiller av bevegelsene.");

    const tick = (now: number) => {
      const nextProgress = clamp((now - animationStartRef.current) / duration, 0, 1);
      setProgress(nextProgress);
      if (nextProgress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        animationRef.current = null;
        setIsPlaying(false);
        setStatus("Avspilling ferdig. Trykk Reset for å se den på nytt.");
      }
    };

    animationRef.current = requestAnimationFrame(tick);
  }

  function resetPlayback() {
    stopAnimation(true);
    setStatus("Tilbake til startposisjonene.");
  }

  function commitEndPositions() {
    stopAnimation(true);
    setObjects((current) => current.map((object) => {
      const pathEnd = object.motionPath && object.motionPath.length > 1 ? object.motionPath[object.motionPath.length - 1] : null;
      const end = pathEnd ?? object.target;
      return end ? { ...object, x: end.x, y: end.y, target: undefined, motionPath: undefined } : object;
    }));
    setStatus("Sluttposisjonene er nå gjort til nye startposisjoner.");
  }

  function deleteSelected() {
    if (!selectedId) return;
    setObjects((current) => current.filter((object) => object.id !== selectedId));
    setSelectedId(null);
    setStatus("Objekt slettet.");
  }

  function updateSelected(patch: Partial<BoardObject>) {
    if (!selectedId) return;
    setObjects((current) => current.map((object) => object.id === selectedId ? { ...object, ...patch } : object));
  }

  function clearMovement() {
    if (!selectedId) return;
    setProgress(0);
    updateSelected({ target: undefined, motionPath: undefined });
    setStatus("Bevegelsen til valgt objekt er fjernet.");
  }

  function clearBoard() {
    if (!window.confirm("Vil du tømme hele taktikktavlen?")) return;
    stopAnimation(true);
    cancelFreehand();
    setObjects([]);
    setLines([]);
    setSelectedId(null);
    setStatus("Tavlen er tømt.");
  }

  function saveBoard() {
    try {
      localStorage.setItem("taktikktavle-v1", JSON.stringify({ title, pitch, objects, lines }));
      setStatus("Tavlen er lagret i denne nettleseren.");
    } catch {
      setStatus("Kunne ikke lagre i nettleseren.");
    }
  }

  function loadBoard() {
    try {
      const raw = localStorage.getItem("taktikktavle-v1");
      if (!raw) {
        setStatus("Fant ingen lagret tavle i denne nettleseren.");
        return;
      }
      const parsed = JSON.parse(raw) as { title?: string; pitch?: PitchType; objects?: BoardObject[]; lines?: BoardLine[] };
      if (parsed.title) setTitle(parsed.title);
      if (parsed.pitch && pitchConfig[parsed.pitch]) setPitch(parsed.pitch);
      if (Array.isArray(parsed.objects)) setObjects(parsed.objects);
      if (Array.isArray(parsed.lines)) setLines(parsed.lines);
      setSelectedId(null);
      stopAnimation(true);
      cancelFreehand();
      setStatus("Lagret tavle åpnet.");
    } catch {
      setStatus("Den lagrede tavlen kunne ikke leses.");
    }
  }

  function renderPitch() {
    const penaltyY = (650 - config.penaltyHeight) / 2;
    const goalY = (650 - config.goalHeight) / 2;
    return (
      <>
        <rect x="0" y="0" width="1000" height="650" fill="#247b43" />
        {Array.from({ length: 10 }).map((_, index) => (
          <rect key={index} x={index * 100} y="0" width="100" height="650" fill={index % 2 === 0 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.025)"} />
        ))}
        <g fill="none" stroke="rgba(255,255,255,.88)" strokeWidth="4">
          <rect x="30" y="30" width="940" height="590" />
          <line x1="500" y1="30" x2="500" y2="620" />
          <circle cx="500" cy="325" r={config.centerRadius} />
          <rect x="30" y={penaltyY} width={config.penaltyDepth} height={config.penaltyHeight} />
          <rect x={970 - config.penaltyDepth} y={penaltyY} width={config.penaltyDepth} height={config.penaltyHeight} />
          <rect x="30" y={goalY} width={config.goalDepth} height={config.goalHeight} />
          <rect x={970 - config.goalDepth} y={goalY} width={config.goalDepth} height={config.goalHeight} />
          <rect x="14" y="276" width="16" height="98" strokeWidth="3" />
          <rect x="970" y="276" width="16" height="98" strokeWidth="3" />
        </g>
        <g fill="rgba(255,255,255,.92)">
          <circle cx="500" cy="325" r="5" />
          <circle cx={30 + config.penaltyDepth * 0.68} cy="325" r="5" />
          <circle cx={970 - config.penaltyDepth * 0.68} cy="325" r="5" />
        </g>
        <text x="500" y="612" textAnchor="middle" fill="rgba(255,255,255,.45)" fontSize="18" fontWeight="700">{pitch}</text>
      </>
    );
  }

  const hasAnyMovement = objects.some((object) => object.target || (object.motionPath && object.motionPath.length > 1));

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brandBlock">
          <h1>Taktikktavle</h1>
          <p>Bygg situasjoner, tegn løp og spill av bevegelser.</p>
        </div>
        <div className="topActions">
          <button className="actionButton" type="button" onClick={loadBoard}>Åpne lagret</button>
          <button className="actionButton primary" type="button" onClick={saveBoard}>Lagre</button>
          <button className="actionButton danger" type="button" onClick={clearBoard}>Tøm tavle</button>
        </div>
      </header>

      <div className="boardLayout">
        <aside className="panel sidebar">
          <section className="sidebarSection">
            <div className="sidebarTitle">Verktøy</div>
            <div className="toolGrid">
              {tools.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`toolButton ${tool === item.id ? "active" : ""}`}
                  onClick={() => chooseTool(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="sidebarSection">
            <div className="sidebarTitle">Valgt objekt</div>
            {selectedObject ? (
              <div className="inspector">
                {selectedObject.type === "player" && (
                  <>
                    <div className="inspectorRow">
                      <label htmlFor="number">Nr.</label>
                      <input id="number" className="textInput" value={selectedObject.number ?? ""} maxLength={3} onChange={(event) => updateSelected({ number: event.target.value })} />
                    </div>
                    <div className="inspectorRow">
                      <label htmlFor="name">Navn</label>
                      <input id="name" className="textInput" value={selectedObject.name ?? ""} maxLength={18} placeholder="f.eks. Nico" onChange={(event) => updateSelected({ name: event.target.value })} />
                    </div>
                  </>
                )}
                {(selectedObject.target || (selectedObject.motionPath && selectedObject.motionPath.length > 1)) && (
                  <button type="button" className="smallButton" onClick={clearMovement}>Fjern bevegelse</button>
                )}
                <button type="button" className="actionButton danger" onClick={deleteSelected}>Slett objekt</button>
              </div>
            ) : (
              <p className="helpText">Velg en spiller, ball eller kjegle på banen for å redigere den.</p>
            )}
          </section>

          <section className="sidebarSection">
            <div className="sidebarTitle">Tegning</div>
            <button type="button" className="smallButton" disabled={lines.length === 0} onClick={() => setLines((current) => current.slice(0, -1))}>Angre siste strek</button>
            <p className="helpText" style={{ marginTop: 10 }}>
              Pil = pasning/retning. Stiplet linje = løp. Rett bevegelse går A → B. Fri bevegelse lar deg tegne selve banen spilleren eller ballen skal følge.
            </p>
          </section>
        </aside>

        <section className="panel fieldPanel">
          <div className="controlsRow">
            <div className="controlGroup" style={{ flex: "1 1 220px" }}>
              <label className="controlLabel" htmlFor="boardTitle">Navn</label>
              <input id="boardTitle" className="textInput" value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="controlGroup">
              <label className="controlLabel" htmlFor="pitch">Bane</label>
              <select id="pitch" className="select" value={pitch} onChange={(event) => setPitch(event.target.value as PitchType)}>
                <option value="11er">11er</option>
                <option value="9er">9er</option>
                <option value="7er">7er</option>
                <option value="5er">5er</option>
              </select>
            </div>
            <div className="statusLine" aria-live="polite">{status}</div>
          </div>

          <div className="pitchWrap">
            <svg
              ref={svgRef}
              className="pitchSvg"
              viewBox="0 0 1000 650"
              role="img"
              aria-label={`${pitch} fotballbane med taktikkobjekter`}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={handleBoardPointerUp}
              onPointerCancel={() => { setDragging(null); setDrawing(null); cancelFreehand(); }}
            >
              <defs>
                <marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#fff" />
                </marker>
              </defs>

              {renderPitch()}

              {lines.map((line) => (
                <line
                  key={line.id}
                  x1={line.start.x}
                  y1={line.start.y}
                  x2={line.end.x}
                  y2={line.end.y}
                  stroke="#fff"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={line.type === "run" ? "12 12" : undefined}
                  markerEnd={line.type === "arrow" ? "url(#arrowHead)" : undefined}
                  opacity=".92"
                />
              ))}

              {drawing && (
                <line
                  x1={drawing.start.x}
                  y1={drawing.start.y}
                  x2={drawing.current.x}
                  y2={drawing.current.y}
                  stroke="#fff"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={drawing.type === "run" ? "12 12" : undefined}
                  markerEnd={drawing.type === "arrow" ? "url(#arrowHead)" : undefined}
                  opacity=".72"
                />
              )}

              {objects.map((object) => object.target && (
                <g key={`target-${object.id}`} opacity=".52">
                  <line x1={object.x} y1={object.y} x2={object.target.x} y2={object.target.y} stroke="#f8f8f8" strokeWidth="3" strokeDasharray="8 9" />
                  <circle cx={object.target.x} cy={object.target.y} r="11" fill="none" stroke="#fff" strokeWidth="3" />
                </g>
              ))}

              {objects.map((object) => object.motionPath && object.motionPath.length > 1 && (
                <g key={`path-${object.id}`} opacity={object.id === selectedId ? ".86" : ".56"}>
                  <polyline
                    points={object.motionPath.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke={object.id === selectedId ? "#ffe082" : "#f8f8f8"}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="9 9"
                  />
                  <circle cx={object.motionPath[object.motionPath.length - 1].x} cy={object.motionPath[object.motionPath.length - 1].y} r="10" fill="none" stroke="#fff" strokeWidth="3" />
                </g>
              ))}

              {freehandPreview.length > 1 && (
                <polyline
                  points={freehandPreview.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke="#ffe082"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="10 8"
                  opacity=".95"
                />
              )}

              {objects.map((object) => {
                const point = displayPoint(object);
                const selected = object.id === selectedId;
                const cursor = tool === "select" ? "grab" : tool === "freeMovement" ? "crosshair" : "pointer";

                if (object.type === "ball") {
                  return (
                    <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => handleObjectPointerDown(event, object)} style={{ cursor }}>
                      {selected && <circle r="24" fill="none" stroke="#ffe082" strokeWidth="4" />}
                      <circle r="14" fill="#fff" stroke="#171717" strokeWidth="3" />
                      <path d="M0,-5 5,-1 3,5 -3,5 -5,-1Z" fill="#171717" />
                    </g>
                  );
                }

                if (object.type === "cone") {
                  return (
                    <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => handleObjectPointerDown(event, object)} style={{ cursor }}>
                      {selected && <circle r="25" fill="none" stroke="#ffe082" strokeWidth="4" />}
                      <path d="M0,-18 L17,15 L-17,15 Z" fill="#ff9f1c" stroke="#fff" strokeWidth="2" />
                      <rect x="-21" y="14" width="42" height="7" rx="3" fill="#ff9f1c" />
                    </g>
                  );
                }

                const fill = object.team === "blue" ? "#2f7af8" : "#ef5350";
                return (
                  <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => handleObjectPointerDown(event, object)} style={{ cursor }}>
                    {selected && <circle r="31" fill="none" stroke="#ffe082" strokeWidth="4" />}
                    {object.role === "keeper" ? (
                      <rect x="-22" y="-22" width="44" height="44" rx="10" fill={fill} stroke="#fff" strokeWidth="4" />
                    ) : (
                      <circle r="22" fill={fill} stroke="#fff" strokeWidth="4" />
                    )}
                    <text y="7" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="900" pointerEvents="none">{object.number || "•"}</text>
                    {object.name && <text y="42" textAnchor="middle" fill="#fff" stroke="rgba(0,0,0,.55)" strokeWidth="4" paintOrder="stroke" fontSize="17" fontWeight="800" pointerEvents="none">{object.name}</text>}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="playbackBar">
            <button type="button" className="actionButton primary" onClick={togglePlayback}>{isPlaying ? "❚❚ Pause" : "▶ Play"}</button>
            <button type="button" className="actionButton" onClick={resetPlayback}>↺ Reset</button>
            <div className="controlGroup">
              <label className="controlLabel" htmlFor="speed">Fart</label>
              <select id="speed" className="select" value={speed} onChange={(event) => { stopAnimation(false); setSpeed(Number(event.target.value)); }}>
                <option value={0.5}>0,5×</option>
                <option value={1}>1×</option>
                <option value={1.5}>1,5×</option>
                <option value={2}>2×</option>
              </select>
            </div>
            <div className="progressTrack" aria-label="Avspillingsfremdrift"><div className="progressFill" style={{ width: `${progress * 100}%` }} /></div>
            <div className="spacer" />
            <button type="button" className="smallButton" onClick={commitEndPositions} disabled={!hasAnyMovement}>Bruk sluttposisjoner som start</button>
          </div>
        </section>
      </div>
    </main>
  );
}
