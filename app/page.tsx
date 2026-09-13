"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ContextMenuEvent as ReactContextMenuEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

type Point = { x: number; y: number };
type Team = "blue" | "red";
type ObjectType = "player" | "ball" | "cone";
type PitchType = "11er" | "9er" | "7er" | "5er";
type PitchView = "full" | "half" | "third" | "box";
type Tool =
  | "select"
  | "hand"
  | "blue"
  | "red"
  | "keeperBlue"
  | "keeperRed"
  | "ball"
  | "cone"
  | "arrow"
  | "run"
  | "movement"
  | "freeMovement"
  | "pass";

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
  motionStart?: number;
  motionDuration?: number;
};

type BoardLine = {
  id: string;
  type: "arrow" | "run";
  start: Point;
  end: Point;
};

type Scene = {
  id: string;
  name: string;
  objects: BoardObject[];
  lines: BoardLine[];
};

type DrawingLine = {
  type: "arrow" | "run";
  start: Point;
  current: Point;
};

type FreehandDrawing = {
  objectId: string;
  points: Point[];
  snapshot: Scene[];
};

type PanDrag = {
  clientX: number;
  clientY: number;
  center: Point;
};

type FormationId = "433" | "442" | "343" | "332" | "231" | "121";

type Formation = {
  id: FormationId;
  label: string;
  pitch: PitchType;
  rows: number[];
};

const pitchConfig: Record<
  PitchType,
  { penaltyDepth: number; penaltyHeight: number; goalDepth: number; goalHeight: number; centerRadius: number }
> = {
  "11er": { penaltyDepth: 155, penaltyHeight: 300, goalDepth: 62, goalHeight: 160, centerRadius: 88 },
  "9er": { penaltyDepth: 145, penaltyHeight: 285, goalDepth: 58, goalHeight: 150, centerRadius: 80 },
  "7er": { penaltyDepth: 125, penaltyHeight: 260, goalDepth: 52, goalHeight: 140, centerRadius: 72 },
  "5er": { penaltyDepth: 105, penaltyHeight: 230, goalDepth: 46, goalHeight: 126, centerRadius: 62 },
};

const pitchViews: Record<PitchView, { label: string; x: number; y: number; width: number; height: number }> = {
  full: { label: "Hel bane", x: 0, y: 0, width: 1000, height: 650 },
  half: { label: "Angrepshalvdel", x: 500, y: 0, width: 500, height: 650 },
  third: { label: "Siste tredjedel", x: 665, y: 0, width: 335, height: 650 },
  box: { label: "Rundt 16-meter", x: 770, y: 120, width: 230, height: 410 },
};

const formations: Formation[] = [
  { id: "433", label: "4-3-3", pitch: "11er", rows: [4, 3, 3] },
  { id: "442", label: "4-4-2", pitch: "11er", rows: [4, 4, 2] },
  { id: "343", label: "3-4-3", pitch: "11er", rows: [3, 4, 3] },
  { id: "332", label: "9er · 3-3-2", pitch: "9er", rows: [3, 3, 2] },
  { id: "231", label: "7er · 2-3-1", pitch: "7er", rows: [2, 3, 1] },
  { id: "121", label: "5er · 1-2-1", pitch: "5er", rows: [1, 2, 1] },
];

const toolGroups: Array<{
  title: string;
  items: Array<{ id: Tool; icon: string; label: string; hint: string }>;
}> = [
  {
    title: "Bygg",
    items: [
      { id: "select", icon: "↖", label: "Velg", hint: "Flytt og rediger" },
      { id: "hand", icon: "✋", label: "Panorer", hint: "Flytt utsnitt" },
      { id: "blue", icon: "●", label: "Blå", hint: "Legg til spiller" },
      { id: "red", icon: "●", label: "Rød", hint: "Legg til spiller" },
      { id: "keeperBlue", icon: "▣", label: "Blå K", hint: "Legg til keeper" },
      { id: "keeperRed", icon: "▣", label: "Rød K", hint: "Legg til keeper" },
      { id: "ball", icon: "⚽", label: "Ball", hint: "Legg til ball" },
      { id: "cone", icon: "▲", label: "Kjegle", hint: "Legg til kjegle" },
    ],
  },
  {
    title: "Animer",
    items: [
      { id: "movement", icon: "◎", label: "Rett", hint: "A → B" },
      { id: "freeMovement", icon: "〰", label: "Fri", hint: "Tegn løpsbanen" },
      { id: "pass", icon: "⇢", label: "Pasning", hint: "Spiller → spiller" },
    ],
  },
  {
    title: "Tegn",
    items: [
      { id: "arrow", icon: "➜", label: "Pil", hint: "Retning / pasning" },
      { id: "run", icon: "⋯", label: "Løp", hint: "Stiplet linje" },
    ],
  },
];

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pointDistance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function createEmptyScene(index = 1): Scene {
  return { id: makeId(), name: `Scene ${index}`, objects: [], lines: [] };
}

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

function objectEndPoint(object: BoardObject): Point {
  if (object.motionPath && object.motionPath.length > 1) return object.motionPath[object.motionPath.length - 1];
  if (object.target) return object.target;
  return { x: object.x, y: object.y };
}

function hasMotion(object: BoardObject) {
  return Boolean(object.target || (object.motionPath && object.motionPath.length > 1));
}

function motionLabel(object: BoardObject) {
  if (object.type === "ball") return "Ball";
  if (object.type === "cone") return "Kjegle";
  return object.name || (object.role === "keeper" ? `${object.team === "blue" ? "Blå" : "Rød"} keeper` : `${object.team === "blue" ? "Blå" : "Rød"} ${object.number || "spiller"}`);
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9æøåÆØÅ_\- ]/g, "").replace(/\s+/g, "-") || "taktikktavle";
}

export default function Home() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pitchWrapRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const animationStartRef = useRef(0);
  const animationStartHeadRef = useRef(0);
  const playDirectionRef = useRef<1 | -1>(1);
  const freehandRef = useRef<FreehandDrawing | null>(null);
  const dragSnapshotRef = useRef<Scene[] | null>(null);
  const panDragRef = useRef<PanDrag | null>(null);
  const sequenceRef = useRef(false);

  const [title, setTitle] = useState("Ny taktikk");
  const [pitch, setPitch] = useState<PitchType>("11er");
  const [pitchView, setPitchView] = useState<PitchView>("full");
  const [tool, setTool] = useState<Tool>("select");
  const [scenes, setScenes] = useState<Scene[]>([createEmptyScene()]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<DrawingLine | null>(null);
  const [freehandPreview, setFreehandPreview] = useState<Point[]>([]);
  const [historyPast, setHistoryPast] = useState<Scene[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<Scene[][]>([]);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState("Velg et verktøy og bygg situasjonen.");
  const [zoom, setZoom] = useState(1);
  const [viewCenter, setViewCenter] = useState<Point>({ x: 500, y: 325 });
  const [formation, setFormation] = useState<FormationId>("433");
  const [formationTeam, setFormationTeam] = useState<Team>("blue");
  const [presentationMode, setPresentationMode] = useState(false);
  const [passFromId, setPassFromId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [pendingSequenceDirection, setPendingSequenceDirection] = useState<1 | -1 | null>(null);

  const currentScene = scenes[sceneIndex] ?? scenes[0];
  const objects = currentScene?.objects ?? [];
  const lines = currentScene?.lines ?? [];
  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );

  const sceneDuration = useMemo(() => {
    const ends = objects.filter(hasMotion).map((object) => (object.motionStart ?? 0) + (object.motionDuration ?? 2));
    return Math.max(4, ...ends, 0);
  }, [objects]);

  const animatedObjects = useMemo(() => objects.filter(hasMotion), [objects]);
  const config = pitchConfig[pitch];
  const baseView = pitchViews[pitchView];
  const visibleWidth = baseView.width / zoom;
  const visibleHeight = baseView.height / zoom;
  const visibleX = clamp(viewCenter.x - visibleWidth / 2, 0, 1000 - visibleWidth);
  const visibleY = clamp(viewCenter.y - visibleHeight / 2, 0, 650 - visibleHeight);
  const currentViewBox = `${visibleX} ${visibleY} ${visibleWidth} ${visibleHeight}`;

  function snapshotForHistory(snapshot: Scene[]) {
    setHistoryPast((current) => [...current.slice(-39), clone(snapshot)]);
    setHistoryFuture([]);
  }

  function mutateScenes(mutator: (draft: Scene[]) => void, snapshot?: Scene[]) {
    const before = snapshot ? clone(snapshot) : clone(scenes);
    const next = clone(scenes);
    mutator(next);
    snapshotForHistory(before);
    setScenes(next);
  }

  function mutateCurrentScene(mutator: (scene: Scene) => void, snapshot?: Scene[]) {
    mutateScenes((draft) => {
      const scene = draft[sceneIndex];
      if (scene) mutator(scene);
    }, snapshot);
  }

  function updateCurrentObjectsWithoutHistory(updater: (items: BoardObject[]) => BoardObject[]) {
    setScenes((current) => current.map((scene, index) => index === sceneIndex ? { ...scene, objects: updater(scene.objects) } : scene));
  }

  function undo() {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryFuture((current) => [clone(scenes), ...current].slice(0, 40));
    setHistoryPast((current) => current.slice(0, -1));
    setScenes(clone(previous));
    setSceneIndex((current) => Math.min(current, previous.length - 1));
    setSelectedId(null);
    setContextMenu(null);
    setPlayhead(0);
    setStatus("Angret siste endring.");
  }

  function redo() {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryPast((current) => [...current.slice(-39), clone(scenes)]);
    setHistoryFuture((current) => current.slice(1));
    setScenes(clone(next));
    setSceneIndex((current) => Math.min(current, next.length - 1));
    setSelectedId(null);
    setContextMenu(null);
    setPlayhead(0);
    setStatus("Gjorde om endringen igjen.");
  }

  function boardPoint(event: ReactPointerEvent<SVGSVGElement | SVGGElement>): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 500, y: 325 };
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 500, y: 325 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: clamp(point.x, 0, 1000), y: clamp(point.y, 0, 650) };
  }

  function resetView(nextView = pitchView) {
    const view = pitchViews[nextView];
    setZoom(1);
    setViewCenter({ x: view.x + view.width / 2, y: view.y + view.height / 2 });
  }

  function changePitchView(nextView: PitchView) {
    setPitchView(nextView);
    resetView(nextView);
  }

  function stopAnimation(reset = false) {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    setIsPlaying(false);
    sequenceRef.current = false;
    if (reset) setPlayhead(0);
  }

  function cancelFreehand() {
    freehandRef.current = null;
    setFreehandPreview([]);
  }

  function chooseTool(nextTool: Tool) {
    stopAnimation(false);
    cancelFreehand();
    setTool(nextTool);
    setDrawing(null);
    setContextMenu(null);
    if (nextTool !== "pass") setPassFromId(null);

    const messages: Partial<Record<Tool, string>> = {
      select: "Trykk på et objekt for hurtigvalg. Dra for å flytte.",
      hand: zoom > 1 ? "Dra i banen for å panorere." : "Zoom inn først, og dra deretter banen.",
      movement: selectedId ? "Trykk på banen der valgt objekt skal ende." : "Velg først en spiller eller ball.",
      freeMovement: selectedId ? "Dra fra valgt objekt og tegn hele bevegelsen." : "Velg først en spiller eller ball.",
      pass: "Trykk først på pasningsspilleren, deretter mottakeren.",
      arrow: "Dra fra start til slutt for å tegne en pil.",
      run: "Dra fra start til slutt for å tegne en stiplet løpslinje.",
    };
    setStatus(messages[nextTool] ?? "Trykk på banen for å plassere objektet.");
  }

  function addObject(point: Point) {
    const blueCount = objects.filter((object) => object.type === "player" && object.team === "blue").length;
    const redCount = objects.filter((object) => object.type === "player" && object.team === "red").length;
    let next: BoardObject | null = null;

    if (["blue", "red", "keeperBlue", "keeperRed"].includes(tool)) {
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

    if (!next) return;
    mutateCurrentScene((scene) => scene.objects.push(next as BoardObject));
    setSelectedId(next.id);
    setStatus("Objekt lagt til. Fortsett å plassere, eller velg et annet verktøy.");
  }

  function handleBoardPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    setContextMenu(null);
    const point = boardPoint(event);

    if (tool === "hand") {
      if (zoom <= 1) {
        setStatus("Zoom inn først for å panorere.");
        return;
      }
      panDragRef.current = { clientX: event.clientX, clientY: event.clientY, center: { ...viewCenter } };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (["blue", "red", "keeperBlue", "keeperRed", "ball", "cone"].includes(tool)) {
      addObject(point);
      return;
    }

    if (tool === "movement") {
      if (!selectedId) {
        setStatus("Velg først objektet som skal bevege seg.");
        return;
      }
      mutateCurrentScene((scene) => {
        scene.objects = scene.objects.map((object) => object.id === selectedId ? {
          ...object,
          target: point,
          motionPath: undefined,
          motionStart: object.motionStart ?? 0,
          motionDuration: object.motionDuration ?? 2,
        } : object);
      });
      setPlayhead(0);
      setStatus("Rett bevegelse satt. Juster timing i høyrepanelet.");
      return;
    }

    if (tool === "freeMovement") {
      setStatus(selectedId ? "Start ved å dra fra det valgte objektet." : "Velg først objektet som skal bevege seg.");
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

    if (draggingId && tool === "select") {
      setPlayhead(0);
      updateCurrentObjectsWithoutHistory((items) => items.map((object) => object.id === draggingId ? { ...object, x: point.x, y: point.y } : object));
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

    const pan = panDragRef.current;
    if (pan && tool === "hand" && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const dx = (event.clientX - pan.clientX) / Math.max(rect.width, 1) * visibleWidth;
      const dy = (event.clientY - pan.clientY) / Math.max(rect.height, 1) * visibleHeight;
      setViewCenter({
        x: clamp(pan.center.x - dx, visibleWidth / 2, 1000 - visibleWidth / 2),
        y: clamp(pan.center.y - dy, visibleHeight / 2, 650 - visibleHeight / 2),
      });
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
      mutateCurrentScene((scene) => {
        scene.objects = scene.objects.map((object) => object.id === freehand.objectId ? {
          ...object,
          target: undefined,
          motionPath: finalPath,
          motionStart: object.motionStart ?? 0,
          motionDuration: object.motionDuration ?? 2,
        } : object);
      }, freehand.snapshot);
      setPlayhead(0);
      setStatus("Fri bevegelse lagret. Play følger kurven nøyaktig.");
    } else {
      setStatus("Bevegelsen ble for kort. Tegn en litt lengre bane.");
    }
  }

  function handleBoardPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (draggingId) {
      if (dragSnapshotRef.current) snapshotForHistory(dragSnapshotRef.current);
      dragSnapshotRef.current = null;
      setDraggingId(null);
    }

    if (freehandRef.current) finishFreehand(event);

    if (drawing) {
      const end = boardPoint(event);
      if (pointDistance(drawing.start, end) > 10) {
        const line: BoardLine = { id: makeId(), type: drawing.type, start: drawing.start, end };
        mutateCurrentScene((scene) => scene.lines.push(line));
        setStatus("Linje lagt til. Ctrl/Cmd+Z angrer.");
      }
      setDrawing(null);
    }

    panDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function createPass(from: BoardObject, to: BoardObject) {
    mutateCurrentScene((scene) => {
      const existingBall = scene.objects.find((object) => object.type === "ball");
      const passPatch: Partial<BoardObject> = {
        x: from.x,
        y: from.y,
        target: { x: to.x, y: to.y },
        motionPath: undefined,
        motionStart: 0,
        motionDuration: 1.1,
      };
      if (existingBall) Object.assign(existingBall, passPatch);
      else scene.objects.push({ id: makeId(), type: "ball", x: from.x, y: from.y, ...passPatch });
      scene.lines.push({ id: makeId(), type: "arrow", start: { x: from.x, y: from.y }, end: { x: to.x, y: to.y } });
    });
    setPassFromId(null);
    setPlayhead(0);
    setStatus(`${motionLabel(from)} → ${motionLabel(to)}. Ballen og pasningspilen er lagt inn.`);
  }

  function handleObjectPointerDown(event: ReactPointerEvent<SVGGElement>, object: BoardObject) {
    event.stopPropagation();
    setContextMenu(null);
    setSelectedId(object.id);

    if (tool === "arrow" || tool === "run") {
      const start = { x: object.x, y: object.y };
      setDrawing({ type: tool, start, current: start });
      event.currentTarget.setPointerCapture(event.pointerId);
      setStatus(tool === "arrow" ? "Dra pilen til ønsket sluttpunkt." : "Dra løpslinjen til ønsket sluttpunkt.");
      return;
    }

    if (tool === "select") {
      dragSnapshotRef.current = clone(scenes);
      setDraggingId(object.id);
      event.currentTarget.setPointerCapture(event.pointerId);
      setStatus("Flytter objekt. Slipp når plasseringen er riktig.");
      return;
    }

    if (tool === "movement") {
      setStatus("Objekt valgt. Trykk på banen der det skal ende.");
      return;
    }

    if (tool === "freeMovement") {
      if (object.type === "cone") {
        setStatus("Fri bevegelse er laget for spillere og ball.");
        return;
      }
      const start = { x: object.x, y: object.y };
      freehandRef.current = { objectId: object.id, points: [start], snapshot: clone(scenes) };
      setFreehandPreview([start]);
      event.currentTarget.setPointerCapture(event.pointerId);
      setStatus("Tegn bevegelsen mens du holder inne. Slipp når banen er ferdig.");
      return;
    }

    if (tool === "pass") {
      if (object.type !== "player") {
        setStatus("Pasningsverktøyet bruker spillere som start og mottaker.");
        return;
      }
      if (!passFromId) {
        setPassFromId(object.id);
        setStatus(`Start: ${motionLabel(object)}. Velg nå mottaker.`);
        return;
      }
      if (passFromId === object.id) {
        setPassFromId(null);
        setStatus("Pasning avbrutt. Velg pasningsspiller på nytt.");
        return;
      }
      const from = objects.find((item) => item.id === passFromId);
      if (from) createPass(from, object);
    }
  }

  function handleObjectContextMenu(event: ReactContextMenuEvent<SVGGElement>, object: BoardObject) {
    event.preventDefault();
    event.stopPropagation();
    const rect = pitchWrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedId(object.id);
    setContextMenu({ x: event.clientX - rect.left, y: event.clientY - rect.top, id: object.id });
  }

  function localMotionProgress(object: BoardObject, time = playhead) {
    if (!hasMotion(object)) return 0;
    const start = object.motionStart ?? 0;
    const duration = Math.max(0.15, object.motionDuration ?? 2);
    return clamp((time - start) / duration, 0, 1);
  }

  function displayPoint(object: BoardObject, time = playhead): Point {
    const progress = localMotionProgress(object, time);
    if (object.motionPath && object.motionPath.length > 1) return pointAlongPath(object.motionPath, progress);
    if (!object.target) return { x: object.x, y: object.y };
    return {
      x: object.x + (object.target.x - object.x) * progress,
      y: object.y + (object.target.y - object.y) * progress,
    };
  }

  function startPlayback(direction: 1 | -1, keepSequence = false, forcedHead?: number) {
    if (animatedObjects.length === 0) {
      if (keepSequence && sequenceRef.current) {
        const nextIndex = sceneIndex + direction;
        if (nextIndex >= 0 && nextIndex < scenes.length) {
          setSceneIndex(nextIndex);
          setSelectedId(null);
          setPendingSequenceDirection(direction);
          return;
        }
        sequenceRef.current = false;
        setStatus(direction === 1 ? "Hele sekvensen er ferdig." : "Hele sekvensen er spilt baklengs.");
        return;
      }
      setStatus("Ingen bevegelser i denne scenen ennå.");
      return;
    }
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    if (!keepSequence) sequenceRef.current = false;

    let startHead = forcedHead ?? playhead;
    if (direction === 1 && startHead >= sceneDuration - 0.001) startHead = 0;
    if (direction === -1 && startHead <= 0.001) startHead = sceneDuration;

    playDirectionRef.current = direction;
    animationStartHeadRef.current = startHead;
    animationStartRef.current = performance.now();
    setPlayhead(startHead);
    setIsPlaying(true);
    setStatus(direction === 1 ? "Spiller fremover." : "Spiller bevegelsene baklengs.");

    const tick = (now: number) => {
      const elapsed = ((now - animationStartRef.current) / 1000) * speed;
      const next = animationStartHeadRef.current + elapsed * direction;
      const clamped = clamp(next, 0, sceneDuration);
      setPlayhead(clamped);
      const finished = direction === 1 ? clamped >= sceneDuration : clamped <= 0;
      if (!finished) {
        animationRef.current = requestAnimationFrame(tick);
        return;
      }

      animationRef.current = null;
      setIsPlaying(false);

      if (sequenceRef.current) {
        const nextIndex = sceneIndex + direction;
        if (nextIndex >= 0 && nextIndex < scenes.length) {
          setSceneIndex(nextIndex);
          setSelectedId(null);
          setPendingSequenceDirection(direction);
          return;
        }
        sequenceRef.current = false;
        setStatus(direction === 1 ? "Hele sekvensen er ferdig." : "Hele sekvensen er spilt baklengs.");
      } else {
        setStatus(direction === 1 ? "Avspilling ferdig." : "Tilbake ved starten.");
      }
    };

    animationRef.current = requestAnimationFrame(tick);
  }

  function toggleForward() {
    if (isPlaying && playDirectionRef.current === 1) {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      setIsPlaying(false);
      sequenceRef.current = false;
      setStatus("Pause.");
      return;
    }
    startPlayback(1);
  }

  function playReverse() {
    if (isPlaying && playDirectionRef.current === -1) {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      setIsPlaying(false);
      sequenceRef.current = false;
      setStatus("Pause.");
      return;
    }
    startPlayback(-1);
  }

  function playSequence(direction: 1 | -1) {
    if (scenes.length === 0) return;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    sequenceRef.current = true;
    const startIndex = direction === 1 ? 0 : scenes.length - 1;
    setSceneIndex(startIndex);
    setSelectedId(null);
    setPendingSequenceDirection(direction);
    setStatus(direction === 1 ? "Spiller hele sekvensen." : "Spiller hele sekvensen baklengs.");
  }

  function resetPlayback() {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    sequenceRef.current = false;
    setIsPlaying(false);
    setPlayhead(0);
    setStatus("Tilbake til startposisjonene.");
  }

  function commitEndPositions() {
    mutateCurrentScene((scene) => {
      scene.objects = scene.objects.map((object) => {
        const end = objectEndPoint(object);
        return { ...object, x: end.x, y: end.y, target: undefined, motionPath: undefined, motionStart: undefined, motionDuration: undefined };
      });
    });
    setPlayhead(0);
    setStatus("Sluttposisjonene er gjort til nye startposisjoner.");
  }

  function updateSelected(patch: Partial<BoardObject>, trackHistory = true) {
    if (!selectedId) return;
    if (trackHistory) {
      mutateCurrentScene((scene) => {
        scene.objects = scene.objects.map((object) => object.id === selectedId ? { ...object, ...patch } : object);
      });
    } else {
      updateCurrentObjectsWithoutHistory((items) => items.map((object) => object.id === selectedId ? { ...object, ...patch } : object));
    }
  }

  function clearMovement() {
    if (!selectedId) return;
    updateSelected({ target: undefined, motionPath: undefined, motionStart: undefined, motionDuration: undefined });
    setPlayhead(0);
    setStatus("Bevegelsen er fjernet.");
  }

  function duplicateSelected() {
    if (!selectedObject) return;
    const duplicate: BoardObject = {
      ...clone(selectedObject),
      id: makeId(),
      x: clamp(selectedObject.x + 34, 20, 980),
      y: clamp(selectedObject.y + 34, 20, 630),
      target: selectedObject.target ? { x: clamp(selectedObject.target.x + 34, 20, 980), y: clamp(selectedObject.target.y + 34, 20, 630) } : undefined,
      motionPath: selectedObject.motionPath?.map((point) => ({ x: clamp(point.x + 34, 20, 980), y: clamp(point.y + 34, 20, 630) })),
    };
    mutateCurrentScene((scene) => scene.objects.push(duplicate));
    setSelectedId(duplicate.id);
    setStatus("Objekt duplisert.");
  }

  function deleteSelected() {
    if (!selectedId) return;
    mutateCurrentScene((scene) => {
      scene.objects = scene.objects.filter((object) => object.id !== selectedId);
    });
    setSelectedId(null);
    setContextMenu(null);
    setStatus("Objekt slettet.");
  }

  function clearBoard() {
    if (!window.confirm("Vil du tømme hele prosjektet, inkludert alle scener?")) return;
    snapshotForHistory(scenes);
    setScenes([createEmptyScene()]);
    setSceneIndex(0);
    setSelectedId(null);
    setPlayhead(0);
    setStatus("Prosjektet er tømt.");
  }

  function addSceneFromEnd() {
    const endObjects = currentScene.objects.map((object) => {
      const end = objectEndPoint(object);
      return {
        ...clone(object),
        x: end.x,
        y: end.y,
        target: undefined,
        motionPath: undefined,
        motionStart: undefined,
        motionDuration: undefined,
      };
    });
    const newScene: Scene = {
      id: makeId(),
      name: `Scene ${scenes.length + 1}`,
      objects: endObjects,
      lines: [],
    };
    mutateScenes((draft) => draft.splice(sceneIndex + 1, 0, newScene));
    setSceneIndex(sceneIndex + 1);
    setSelectedId(null);
    setPlayhead(0);
    setStatus("Ny scene opprettet fra sluttposisjonene.");
  }

  function duplicateScene() {
    const copy = clone(currentScene);
    copy.id = makeId();
    copy.name = `${currentScene.name} kopi`;
    mutateScenes((draft) => draft.splice(sceneIndex + 1, 0, copy));
    setSceneIndex(sceneIndex + 1);
    setSelectedId(null);
    setPlayhead(0);
    setStatus("Scenen er duplisert.");
  }

  function deleteScene() {
    if (scenes.length === 1) {
      setStatus("Prosjektet må ha minst én scene.");
      return;
    }
    mutateScenes((draft) => draft.splice(sceneIndex, 1));
    setSceneIndex(Math.max(0, sceneIndex - 1));
    setSelectedId(null);
    setPlayhead(0);
    setStatus("Scenen er slettet.");
  }

  function selectScene(index: number) {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    sequenceRef.current = false;
    setIsPlaying(false);
    setSceneIndex(index);
    setSelectedId(null);
    setPlayhead(0);
    setContextMenu(null);
  }

  function applyFormationPreset() {
    const preset = formations.find((item) => item.id === formation);
    if (!preset) return;
    const rowXs = preset.rows.length === 3 ? [245, 455, 700] : preset.rows.map((_, index) => 250 + index * 210);
    const generated: BoardObject[] = [];
    const mirror = formationTeam === "red";
    const ownX = mirror ? 920 : 80;
    generated.push({ id: makeId(), type: "player", team: formationTeam, role: "keeper", number: "1", x: ownX, y: 325 });
    let number = 2;
    preset.rows.forEach((count, rowIndex) => {
      const xBase = rowXs[rowIndex] ?? 300 + rowIndex * 200;
      const x = mirror ? 1000 - xBase : xBase;
      for (let i = 0; i < count; i += 1) {
        const y = count === 1 ? 325 : 105 + (440 / (count - 1)) * i;
        generated.push({ id: makeId(), type: "player", team: formationTeam, role: "player", number: String(number), x, y });
        number += 1;
      }
    });

    mutateCurrentScene((scene) => {
      scene.objects = [...scene.objects.filter((object) => !(object.type === "player" && object.team === formationTeam)), ...generated];
    });
    setPitch(preset.pitch);
    setSelectedId(null);
    setPlayhead(0);
    setStatus(`${preset.label} lagt inn for ${formationTeam === "blue" ? "blått" : "rødt"} lag.`);
  }

  function saveBoard() {
    try {
      localStorage.setItem("taktikktavle-v2", JSON.stringify({ version: 2, title, pitch, pitchView, scenes }));
      setStatus("Prosjektet er lagret i denne nettleseren.");
    } catch {
      setStatus("Kunne ikke lagre i nettleseren.");
    }
  }

  function loadBoard() {
    try {
      const v2 = localStorage.getItem("taktikktavle-v2");
      if (v2) {
        const parsed = JSON.parse(v2) as { title?: string; pitch?: PitchType; pitchView?: PitchView; scenes?: Scene[] };
        if (parsed.title) setTitle(parsed.title);
        if (parsed.pitch && pitchConfig[parsed.pitch]) setPitch(parsed.pitch);
        if (parsed.pitchView && pitchViews[parsed.pitchView]) changePitchView(parsed.pitchView);
        if (Array.isArray(parsed.scenes) && parsed.scenes.length) setScenes(parsed.scenes);
        setSceneIndex(0);
        setSelectedId(null);
        setHistoryPast([]);
        setHistoryFuture([]);
        setPlayhead(0);
        setStatus("Lagret V2-prosjekt åpnet.");
        return;
      }

      const legacy = localStorage.getItem("taktikktavle-v1");
      if (!legacy) {
        setStatus("Fant ingen lagret tavle i denne nettleseren.");
        return;
      }
      const parsed = JSON.parse(legacy) as { title?: string; pitch?: PitchType; objects?: BoardObject[]; lines?: BoardLine[] };
      if (parsed.title) setTitle(parsed.title);
      if (parsed.pitch && pitchConfig[parsed.pitch]) setPitch(parsed.pitch);
      setScenes([{ id: makeId(), name: "Scene 1", objects: parsed.objects ?? [], lines: parsed.lines ?? [] }]);
      setSceneIndex(0);
      setSelectedId(null);
      setHistoryPast([]);
      setHistoryFuture([]);
      setPlayhead(0);
      setStatus("Gammel tavle åpnet og oppgradert til V2-format.");
    } catch {
      setStatus("Den lagrede tavlen kunne ikke leses.");
    }
  }

  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const cloneSvg = svg.cloneNode(true) as SVGSVGElement;
      cloneSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      cloneSvg.setAttribute("width", "1600");
      cloneSvg.setAttribute("height", String(Math.round(1600 * visibleHeight / visibleWidth)));
      const source = new XMLSerializer().serializeToString(cloneSvg);
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = Math.round(1600 * visibleHeight / visibleWidth);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const link = document.createElement("a");
        link.download = `${sanitizeFileName(title)}-${sceneIndex + 1}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setStatus("Bilde eksportert som PNG.");
      };
      image.src = url;
    } catch {
      setStatus("Kunne ikke eksportere bilde i denne nettleseren.");
    }
  }

  function renderPitch() {
    const penaltyY = (650 - config.penaltyHeight) / 2;
    const goalY = (650 - config.goalHeight) / 2;
    return (
      <>
        <defs>
          <linearGradient id="pitchGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#17683d" />
            <stop offset="55%" stopColor="#1d7a46" />
            <stop offset="100%" stopColor="#125b36" />
          </linearGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width="1000" height="650" fill="url(#pitchGlow)" />
        {Array.from({ length: 10 }).map((_, index) => (
          <rect key={index} x={index * 100} y="0" width="100" height="650" fill={index % 2 === 0 ? "rgba(255,255,255,.026)" : "rgba(0,0,0,.026)"} />
        ))}
        <g opacity=".16" stroke="#d8ffe6" strokeWidth="1">
          {Array.from({ length: 20 }).map((_, index) => <line key={`v-${index}`} x1={index * 50} y1="0" x2={index * 50} y2="650" />)}
          {Array.from({ length: 13 }).map((_, index) => <line key={`h-${index}`} x1="0" y1={index * 50} x2="1000" y2={index * 50} />)}
        </g>
        <g fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="3.5">
          <rect x="30" y="30" width="940" height="590" rx="3" />
          <line x1="500" y1="30" x2="500" y2="620" />
          <circle cx="500" cy="325" r={config.centerRadius} />
          <rect x="30" y={penaltyY} width={config.penaltyDepth} height={config.penaltyHeight} />
          <rect x={970 - config.penaltyDepth} y={penaltyY} width={config.penaltyDepth} height={config.penaltyHeight} />
          <rect x="30" y={goalY} width={config.goalDepth} height={config.goalHeight} />
          <rect x={970 - config.goalDepth} y={goalY} width={config.goalDepth} height={config.goalHeight} />
          <rect x="14" y="276" width="16" height="98" strokeWidth="3" />
          <rect x="970" y="276" width="16" height="98" strokeWidth="3" />
        </g>
        <g fill="rgba(255,255,255,.95)">
          <circle cx="500" cy="325" r="4" />
          <circle cx={30 + config.penaltyDepth * 0.68} cy="325" r="4" />
          <circle cx={970 - config.penaltyDepth * 0.68} cy="325" r="4" />
        </g>
      </>
    );
  }

  useEffect(() => {
    if (pendingSequenceDirection === null) return;
    const direction = pendingSequenceDirection;
    const forcedHead = direction === 1 ? 0 : sceneDuration;
    setPendingSequenceDirection(null);
    setPlayhead(forcedHead);
    animationStartHeadRef.current = forcedHead;
    startPlayback(direction, true, forcedHead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex, pendingSequenceDirection]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editable = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (editable) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedId) {
          event.preventDefault();
          deleteSelected();
        }
      }
      if (event.code === "Space") {
        event.preventDefault();
        toggleForward();
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        playReverse();
      }
      if (event.key === "Escape") {
        setPresentationMode(false);
        setContextMenu(null);
        setPassFromId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, historyPast, historyFuture, playhead, isPlaying, sceneDuration, scenes, sceneIndex]);

  useEffect(() => () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <main className={`studioShell ${presentationMode ? "presentationMode" : ""}`}>
      {!presentationMode && (
        <header className="topHeader">
          <div className="brandCluster">
            <div className="brandMark">T</div>
            <div>
              <div className="eyebrow">COACH STUDIO</div>
              <input className="projectTitle" value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} aria-label="Prosjektnavn" />
            </div>
          </div>
          <div className="headerActions">
            <button className="iconButton" type="button" onClick={undo} disabled={historyPast.length === 0} title="Angre (Ctrl/Cmd+Z)">↶</button>
            <button className="iconButton" type="button" onClick={redo} disabled={historyFuture.length === 0} title="Gjør om">↷</button>
            <span className="headerDivider" />
            <button className="ghostButton" type="button" onClick={loadBoard}>Åpne</button>
            <button className="ghostButton" type="button" onClick={exportPng}>Eksporter PNG</button>
            <button className="ghostButton" type="button" onClick={() => setPresentationMode(true)}>◱ Presenter</button>
            <button className="primaryButton" type="button" onClick={saveBoard}>Lagre</button>
          </div>
        </header>
      )}

      <div className="studioGrid">
        {!presentationMode && (
          <aside className="glassPanel toolDock">
            {toolGroups.map((group) => (
              <section className="toolSection" key={group.title}>
                <div className="sectionLabel">{group.title}</div>
                <div className="toolButtons">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`studioTool ${tool === item.id ? "active" : ""} ${item.id === "blue" || item.id === "keeperBlue" ? "blueTool" : ""} ${item.id === "red" || item.id === "keeperRed" ? "redTool" : ""}`}
                      onClick={() => chooseTool(item.id)}
                      title={item.hint}
                    >
                      <span className="toolIcon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <section className="toolSection formationSection">
              <div className="sectionLabel">Startformasjon</div>
              <select className="darkSelect" value={formation} onChange={(event) => setFormation(event.target.value as FormationId)}>
                {formations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <div className="segmented small">
                <button type="button" className={formationTeam === "blue" ? "active" : ""} onClick={() => setFormationTeam("blue")}>Blå</button>
                <button type="button" className={formationTeam === "red" ? "active" : ""} onClick={() => setFormationTeam("red")}>Rød</button>
              </div>
              <button className="secondaryButton full" type="button" onClick={applyFormationPreset}>Legg inn formasjon</button>
            </section>
          </aside>
        )}

        <section className="workspaceColumn">
          {!presentationMode && (
            <div className="workspaceToolbar glassPanel">
              <div className="toolbarGroup">
                <span className="toolbarLabel">Bane</span>
                <select className="darkSelect compact" value={pitch} onChange={(event) => setPitch(event.target.value as PitchType)}>
                  <option value="11er">11er</option><option value="9er">9er</option><option value="7er">7er</option><option value="5er">5er</option>
                </select>
                <select className="darkSelect compact wide" value={pitchView} onChange={(event) => changePitchView(event.target.value as PitchView)}>
                  {Object.entries(pitchViews).map(([id, view]) => <option key={id} value={id}>{view.label}</option>)}
                </select>
              </div>
              <div className="toolbarGroup zoomControls">
                <button className="miniButton" type="button" onClick={() => setZoom((current) => clamp(current - 0.25, 1, 3))}>−</button>
                <span className="zoomValue">{Math.round(zoom * 100)}%</span>
                <button className="miniButton" type="button" onClick={() => setZoom((current) => clamp(current + 0.25, 1, 3))}>+</button>
                <button className="miniButton text" type="button" onClick={() => resetView()}>Tilpass</button>
              </div>
              <div className="statusPill" aria-live="polite"><span className="statusDot" />{status}</div>
            </div>
          )}

          <div className="pitchCard glassPanel">
            {presentationMode && (
              <div className="presentationTopbar">
                <div><strong>{title}</strong><span>{currentScene.name}</span></div>
                <button className="ghostButton" type="button" onClick={() => setPresentationMode(false)}>✕ Avslutt presentasjon</button>
              </div>
            )}

            <div className="pitchWrap" ref={pitchWrapRef}>
              <svg
                ref={svgRef}
                className={`pitchSvg ${tool === "hand" ? "handMode" : ""}`}
                viewBox={currentViewBox}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={`${pitch} fotballbane med taktikkobjekter`}
                onPointerDown={handleBoardPointerDown}
                onPointerMove={handleBoardPointerMove}
                onPointerUp={handleBoardPointerUp}
                onPointerCancel={() => { setDraggingId(null); setDrawing(null); cancelFreehand(); panDragRef.current = null; }}
              >
                <defs>
                  <marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10Z" fill="#fff" />
                  </marker>
                </defs>

                {renderPitch()}

                {lines.map((line) => (
                  <line
                    key={line.id}
                    x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y}
                    stroke="#fff" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={line.type === "run" ? "11 10" : undefined}
                    markerEnd={line.type === "arrow" ? "url(#arrowHead)" : undefined}
                    opacity=".88"
                  />
                ))}

                {drawing && (
                  <line
                    x1={drawing.start.x} y1={drawing.start.y} x2={drawing.current.x} y2={drawing.current.y}
                    stroke="#f7dd72" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={drawing.type === "run" ? "11 10" : undefined}
                    markerEnd={drawing.type === "arrow" ? "url(#arrowHead)" : undefined}
                    opacity=".95"
                  />
                )}

                {objects.map((object) => object.target && (
                  <g key={`target-${object.id}`} opacity={object.id === selectedId ? ".9" : ".42"}>
                    <line x1={object.x} y1={object.y} x2={object.target.x} y2={object.target.y} stroke={object.id === selectedId ? "#f7dd72" : "#fff"} strokeWidth="2.6" strokeDasharray="8 9" />
                    <circle cx={object.target.x} cy={object.target.y} r="8" fill="none" stroke="#fff" strokeWidth="2.5" />
                  </g>
                ))}

                {objects.map((object) => object.motionPath && object.motionPath.length > 1 && (
                  <g key={`path-${object.id}`} opacity={object.id === selectedId ? ".95" : ".38"}>
                    <polyline
                      points={object.motionPath.map((point) => `${point.x},${point.y}`).join(" ")}
                      fill="none" stroke={object.id === selectedId ? "#f7dd72" : "#f5f7f6"}
                      strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 8"
                    />
                    <circle cx={object.motionPath[object.motionPath.length - 1].x} cy={object.motionPath[object.motionPath.length - 1].y} r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
                  </g>
                ))}

                {freehandPreview.length > 1 && (
                  <polyline
                    points={freehandPreview.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none" stroke="#f7dd72" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="9 7" opacity=".95"
                  />
                )}

                {objects.map((object) => {
                  const point = displayPoint(object);
                  const selected = object.id === selectedId;
                  const dimmed = selectedId && !selected && tool === "select";
                  const cursor = tool === "select" ? "grab" : tool === "freeMovement" ? "crosshair" : tool === "hand" ? "grab" : "pointer";

                  if (object.type === "ball") {
                    return (
                      <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} opacity={dimmed ? .58 : 1} onPointerDown={(event) => handleObjectPointerDown(event, object)} onContextMenu={(event) => handleObjectContextMenu(event, object)} style={{ cursor }}>
                        {selected && <circle r="18" fill="rgba(247,221,114,.11)" stroke="#f7dd72" strokeWidth="2.8" filter="url(#softGlow)" />}
                        <circle r="10" fill="#fff" stroke="#111" strokeWidth="2.2" />
                        <path d="M0,-4 4,-1 2.5,4 -2.5,4 -4,-1Z" fill="#151515" />
                      </g>
                    );
                  }

                  if (object.type === "cone") {
                    return (
                      <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} opacity={dimmed ? .58 : 1} onPointerDown={(event) => handleObjectPointerDown(event, object)} onContextMenu={(event) => handleObjectContextMenu(event, object)} style={{ cursor }}>
                        {selected && <circle r="19" fill="none" stroke="#f7dd72" strokeWidth="2.8" />}
                        <path d="M0,-13 L12,11 L-12,11Z" fill="#ff9f43" stroke="#fff" strokeWidth="1.7" />
                        <rect x="-15" y="10" width="30" height="5" rx="2.5" fill="#ff9f43" />
                      </g>
                    );
                  }

                  const fill = object.team === "blue" ? "#3a8bff" : "#ff5c6c";
                  return (
                    <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} opacity={dimmed ? .48 : 1} onPointerDown={(event) => handleObjectPointerDown(event, object)} onContextMenu={(event) => handleObjectContextMenu(event, object)} style={{ cursor }}>
                      {selected && <circle r="25" fill="rgba(247,221,114,.1)" stroke="#f7dd72" strokeWidth="2.8" filter="url(#softGlow)" />}
                      {object.role === "keeper" ? (
                        <rect x="-16" y="-16" width="32" height="32" rx="8" fill={fill} stroke="#fff" strokeWidth="2.8" />
                      ) : (
                        <circle r="16" fill={fill} stroke="#fff" strokeWidth="2.8" />
                      )}
                      <text y="5" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900" pointerEvents="none">{object.number || "•"}</text>
                      {object.name && <text y="31" textAnchor="middle" fill="#fff" stroke="rgba(0,0,0,.62)" strokeWidth="3.5" paintOrder="stroke" fontSize="12" fontWeight="800" pointerEvents="none">{object.name}</text>}
                    </g>
                  );
                })}
              </svg>

              {contextMenu && (
                <div className="objectContextMenu" style={{ left: contextMenu.x, top: contextMenu.y }}>
                  <button type="button" onClick={() => { chooseTool("movement"); setContextMenu(null); }}>◎ Rett bevegelse</button>
                  <button type="button" onClick={() => { chooseTool("freeMovement"); setContextMenu(null); }}>〰 Fri bevegelse</button>
                  <button type="button" onClick={() => { duplicateSelected(); setContextMenu(null); }}>⧉ Dupliser</button>
                  <button type="button" className="dangerText" onClick={deleteSelected}>⌫ Slett</button>
                </div>
              )}
            </div>

            <div className="playbackDock">
              <button className={`playButton reverse ${isPlaying && playDirectionRef.current === -1 ? "playing" : ""}`} type="button" onClick={playReverse} title="Spill baklengs (R)">◀</button>
              <button className="resetButton" type="button" onClick={resetPlayback} title="Til start">↺</button>
              <button className={`playButton ${isPlaying && playDirectionRef.current === 1 ? "playing" : ""}`} type="button" onClick={toggleForward} title="Play / pause (mellomrom)">{isPlaying && playDirectionRef.current === 1 ? "❚❚" : "▶"}</button>
              <div className="timeReadout"><strong>{playhead.toFixed(1)}</strong><span>/ {sceneDuration.toFixed(1)} s</span></div>
              <input className="scrubber" type="range" min="0" max={sceneDuration} step="0.02" value={playhead} onChange={(event) => { if (animationRef.current !== null) cancelAnimationFrame(animationRef.current); setIsPlaying(false); setPlayhead(Number(event.target.value)); }} aria-label="Tidslinje" />
              <select className="darkSelect speedSelect" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Avspillingsfart">
                <option value={0.5}>0,5×</option><option value={1}>1×</option><option value={1.5}>1,5×</option><option value={2}>2×</option>
              </select>
              {!presentationMode && <button className="secondaryButton compactAction" type="button" onClick={commitEndPositions} disabled={animatedObjects.length === 0}>Slutt → start</button>}
            </div>
          </div>

          {!presentationMode && (
            <>
              <div className="scenePanel glassPanel">
                <div className="sceneHeader">
                  <div><span className="sectionLabel">Sekvenser</span><strong>{scenes.length} {scenes.length === 1 ? "scene" : "scener"}</strong></div>
                  <div className="sceneActions">
                    <button className="miniButton text" type="button" onClick={() => playSequence(-1)}>◀ Spill alle baklengs</button>
                    <button className="miniButton text" type="button" onClick={() => playSequence(1)}>Spill alle ▶</button>
                    <button className="secondaryButton compactAction" type="button" onClick={addSceneFromEnd}>＋ Ny fra slutt</button>
                  </div>
                </div>
                <div className="sceneStrip">
                  {scenes.map((scene, index) => (
                    <button key={scene.id} type="button" className={`sceneCard ${index === sceneIndex ? "active" : ""}`} onClick={() => selectScene(index)}>
                      <span className="sceneNumber">{index + 1}</span>
                      <span className="sceneName">{scene.name}</span>
                      <span className="sceneMeta">{scene.objects.filter((object) => object.type === "player").length} spillere · {scene.objects.filter(hasMotion).length} bevegelser</span>
                    </button>
                  ))}
                </div>
                <div className="sceneFooter">
                  <button className="miniButton text" type="button" onClick={duplicateScene}>⧉ Dupliser scene</button>
                  <button className="miniButton text dangerText" type="button" onClick={deleteScene} disabled={scenes.length === 1}>Slett scene</button>
                  <button className="miniButton text dangerText" type="button" onClick={clearBoard}>Tøm prosjekt</button>
                </div>
              </div>

              <div className="timelinePanel glassPanel">
                <div className="timelineHeader">
                  <div><span className="sectionLabel">Timing</span><strong>{currentScene.name}</strong></div>
                  <div className="timelineScale"><span>0 s</span><span>{(sceneDuration / 2).toFixed(1)} s</span><span>{sceneDuration.toFixed(1)} s</span></div>
                </div>
                {animatedObjects.length === 0 ? (
                  <div className="emptyTimeline">Legg inn en rett eller fri bevegelse for å få en tidslinje.</div>
                ) : (
                  <div className="timelineRows">
                    {animatedObjects.map((object) => {
                      const start = object.motionStart ?? 0;
                      const duration = object.motionDuration ?? 2;
                      return (
                        <button key={object.id} type="button" className={`timelineRow ${selectedId === object.id ? "selected" : ""}`} onClick={() => setSelectedId(object.id)}>
                          <span className="timelineName">{motionLabel(object)}</span>
                          <span className="timelineTrack">
                            <span className="timelineBar" style={{ left: `${(start / sceneDuration) * 100}%`, width: `${Math.min(100 - (start / sceneDuration) * 100, (duration / sceneDuration) * 100)}%` }} />
                            <span className="timelinePlayhead" style={{ left: `${(playhead / sceneDuration) * 100}%` }} />
                          </span>
                          <span className="timelineValue">{start.toFixed(1)} → {(start + duration).toFixed(1)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {!presentationMode && (
          <aside className="glassPanel inspectorPanel">
            <div className="inspectorHeader">
              <div><span className="sectionLabel">Inspektør</span><strong>{selectedObject ? motionLabel(selectedObject) : "Ingen valgt"}</strong></div>
              {selectedObject && <span className={`teamChip ${selectedObject.team ?? "neutral"}`}>{selectedObject.type === "player" ? (selectedObject.team === "blue" ? "BLÅ" : "RØD") : selectedObject.type.toUpperCase()}</span>}
            </div>

            {!selectedObject ? (
              <div className="inspectorEmpty">
                <div className="inspectorGlyph">↖</div>
                <strong>Velg et objekt</strong>
                <p>Trykk på spiller, ball eller kjegle. Høyreklikk på PC for hurtigmeny.</p>
                <div className="shortcutCard"><span>Mellomrom</span><b>Play / pause</b><span>R</span><b>Revers</b><span>Ctrl/Cmd+Z</span><b>Angre</b></div>
              </div>
            ) : (
              <div className="inspectorContent">
                {selectedObject.type === "player" && (
                  <div className="inspectorGroup">
                    <div className="inspectorGroupTitle">Spiller</div>
                    <label className="fieldLabel">Navn<input className="darkInput" value={selectedObject.name ?? ""} maxLength={18} placeholder="f.eks. Nico" onChange={(event) => updateSelected({ name: event.target.value })} /></label>
                    <label className="fieldLabel">Nummer<input className="darkInput" value={selectedObject.number ?? ""} maxLength={3} onChange={(event) => updateSelected({ number: event.target.value })} /></label>
                  </div>
                )}

                <div className="quickActions">
                  <button type="button" onClick={() => chooseTool("movement")}>◎ Rett</button>
                  <button type="button" onClick={() => chooseTool("freeMovement")}>〰 Fri</button>
                  <button type="button" onClick={duplicateSelected}>⧉ Kopi</button>
                  <button type="button" className="dangerText" onClick={deleteSelected}>⌫ Slett</button>
                </div>

                {hasMotion(selectedObject) && (
                  <div className="inspectorGroup motionInspector">
                    <div className="inspectorGroupTitle">Timing</div>
                    <label className="rangeField">
                      <span><b>Start</b><em>{(selectedObject.motionStart ?? 0).toFixed(1)} s</em></span>
                      <input type="range" min="0" max="10" step="0.1" value={selectedObject.motionStart ?? 0} onChange={(event) => updateSelected({ motionStart: Number(event.target.value) })} />
                    </label>
                    <label className="rangeField">
                      <span><b>Varighet</b><em>{(selectedObject.motionDuration ?? 2).toFixed(1)} s</em></span>
                      <input type="range" min="0.3" max="10" step="0.1" value={selectedObject.motionDuration ?? 2} onChange={(event) => updateSelected({ motionDuration: Number(event.target.value) })} />
                    </label>
                    <button className="secondaryButton full" type="button" onClick={clearMovement}>Fjern bevegelse</button>
                  </div>
                )}

                <div className="inspectorGroup">
                  <div className="inspectorGroupTitle">Scene</div>
                  <label className="fieldLabel">Navn på scene<input className="darkInput" value={currentScene.name} maxLength={30} onChange={(event) => {
                    const name = event.target.value;
                    mutateCurrentScene((scene) => { scene.name = name; });
                  }} /></label>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
