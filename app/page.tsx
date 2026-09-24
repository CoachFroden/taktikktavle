"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  ReactNode,
  ContextMenuEvent as ReactContextMenuEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

type Point = { x: number; y: number };
type Team = "blue" | "red";
type ObjectType =
  | "player"
  | "ball"
  | "cone"
  | "mannequin"
  | "miniGoal"
  | "ladder"
  | "hurdle"
  | "gate"
  | "zone"
  | "circleShape"
  | "semicircle";
type PitchType = "11er" | "9er" | "7er" | "5er";
type PitchView = "full" | "half" | "third" | "box";
type LineAnimationMode = "off" | "pass" | "run" | "rotation";
type Tool =
  | "select"
  | "hand"
  | "blue"
  | "red"
  | "keeperBlue"
  | "keeperRed"
  | "ball"
  | "cone"
  | "mannequin"
  | "miniGoal"
  | "ladder"
  | "hurdle"
  | "gate"
  | "zone"
  | "circleShape"
  | "semicircle"
  | "arrow"
  | "run"
  | "rotation"
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
  color?: string;
  scale?: number;
  rotation?: number;
  target?: Point;
  motionPath?: Point[];
  motionStart?: number;
  motionDuration?: number;
  hidden?: boolean;
};

type BoardLine = {
  id: string;
  type: "arrow" | "run" | "rotation";
  start: Point;
  end: Point;
  color?: string;
  sequenceId?: string;
  sequenceOrder?: number;
  animationKind?: Exclude<LineAnimationMode, "off">;
  actorId?: string;
  timingStart?: number;
  timingDuration?: number;
  endSnapId?: string;
  startAfterLineId?: string;
  hidden?: boolean;
  lineShape?: "straight" | "free";
  controlPoints?: Point[];
};

type Scene = {
  id: string;
  name: string;
  objects: BoardObject[];
  lines: BoardLine[];
};

type DrawingLine = {
  type: "arrow" | "run" | "rotation";
  start: Point;
  current: Point;
  sequenceId?: string;
  sequenceOrder?: number;
  animationKind?: Exclude<LineAnimationMode, "off">;
  actorId?: string;
  snapTargetLineId?: string;
  startAfterLineId?: string;
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

type LinePointDrag = {
  lineId: string;
  pointIndex: number;
  snapshot: Scene[];
  snapTargetLineId?: string;
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

const lineColors = [
  { value: "#ffffff", label: "Hvit" },
  { value: "#111111", label: "Svart" },
  { value: "#f7dd72", label: "Gul" },
  { value: "#ff5c6c", label: "Rød" },
  { value: "#3a8bff", label: "Blå" },
  { value: "#70f0a6", label: "Grønn" },
  { value: "#ff9f43", label: "Oransje" },
  { value: "#c6b9ff", label: "Lilla" },
];

const toolGroups: Array<{
  title: string;
  icon: string;
  items: Array<{ id: Tool; icon: string; label: string; hint: string }>;
}> = [
  {
    title: "Bygg",
    icon: "＋",
    items: [
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
    title: "Figurer",
    icon: "◇",
    items: [
      { id: "mannequin", icon: "♟", label: "Dukke", hint: "Forsvarsdukke / mannequin" },
      { id: "miniGoal", icon: "⌑", label: "Minimål", hint: "Lite treningsmål" },
      { id: "ladder", icon: "╫", label: "Stige", hint: "Koordinasjonsstige" },
      { id: "hurdle", icon: "Π", label: "Hekk", hint: "Treningshekk" },
      { id: "gate", icon: "∥", label: "Port", hint: "Port mellom to markører" },
      { id: "zone", icon: "▭", label: "Sone", hint: "Markert rektangel / område" },
      { id: "circleShape", icon: "○", label: "Sirkel", hint: "Markert sirkel / område" },
      { id: "semicircle", icon: "◒", label: "Halvsirkel", hint: "Halvsirkel / bue" },
    ],
  },
  {
    title: "Tegn",
    icon: "✎",
    items: [
      { id: "arrow", icon: "➜", label: "Pasning", hint: "Heltrukket pil / pasning" },
      { id: "run", icon: "⋯", label: "Løp", hint: "Stiplet løpslinje" },
      { id: "rotation", icon: "↻", label: "Rullering", hint: "Neste stasjon / rullering" },
    ],
  },
  {
    title: "Manuell bevegelse",
    icon: "◎",
    items: [
      { id: "movement", icon: "◎", label: "Rett", hint: "Enkel bevegelse A → B" },
      { id: "freeMovement", icon: "〰", label: "Fri", hint: "Tegn en fri bevegelsesbane" },
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

function linePoints(line: BoardLine): Point[] {
  return [
    { ...line.start },
    ...(line.controlPoints ?? []).map((point) => ({ ...point })),
    { ...line.end },
  ];
}

function lineIsFree(line: BoardLine) {
  return line.lineShape === "free" || Boolean(line.controlPoints?.length);
}

function linePathPointsString(line: BoardLine) {
  return linePoints(line).map((point) => `${point.x},${point.y}`).join(" ");
}

function objectEndPoint(object: BoardObject): Point {
  if (object.motionPath && object.motionPath.length > 1) return object.motionPath[object.motionPath.length - 1];
  if (object.target) return object.target;
  return { x: object.x, y: object.y };
}

function hasMotion(object: BoardObject) {
  return Boolean(object.target || (object.motionPath && object.motionPath.length > 1));
}

const figureLabels: Partial<Record<ObjectType, string>> = {
  mannequin: "Forsvarsdukke",
  miniGoal: "Minimål",
  ladder: "Stige",
  hurdle: "Hekk",
  gate: "Port",
  zone: "Sone",
  circleShape: "Sirkel",
  semicircle: "Halvsirkel",
};

function isFigureObject(object: BoardObject) {
  return Boolean(figureLabels[object.type]);
}

function defaultObjectColor(object: BoardObject) {
  if (object.type === "player") return object.team === "red" ? "#ff5c6c" : "#3a8bff";
  if (object.type === "ball") return "#ffffff";
  if (object.type === "cone") return "#ff9f43";
  if (object.type === "mannequin") return "#f0b84b";
  if (object.type === "miniGoal") return "#f6f8f7";
  if (object.type === "ladder") return "#f7dd72";
  if (object.type === "hurdle" || object.type === "gate") return "#ff9f43";
  if (object.type === "zone") return "#f7dd72";
  if (object.type === "circleShape") return "#70f0a6";
  if (object.type === "semicircle") return "#c6b9ff";
  return "#ffffff";
}

function contrastColor(hex: string) {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return "#ffffff";
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111111" : "#ffffff";
}

function motionLabel(object: BoardObject) {
  if (object.type === "ball") return "Ball";
  if (object.type === "cone") return "Kjegle";
  if (figureLabels[object.type]) return figureLabels[object.type] as string;
  if (object.name) return object.name;
  if (object.role === "keeper") return (object.team === "blue" ? "Blå" : "Rød") + " keeper";
  return (object.team === "blue" ? "Blå" : "Rød") + " " + (object.number || "spiller");
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
  const linePointDragRef = useRef<LinePointDrag | null>(null);
  const sequenceRef = useRef(false);

  const [title, setTitle] = useState("Ny taktikk");
  const [pitch, setPitch] = useState<PitchType>("11er");
  const [pitchView, setPitchView] = useState<PitchView>("full");
  const [tool, setTool] = useState<Tool>("select");
  const [scenes, setScenes] = useState<Scene[]>([createEmptyScene()]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<DrawingLine | null>(null);
  const [freehandPreview, setFreehandPreview] = useState<Point[]>([]);
  const [historyPast, setHistoryPast] = useState<Scene[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<Scene[][]>([]);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGuideLines, setShowGuideLines] = useState(true);
  const [hideGuideLinesDuringPlayback, setHideGuideLinesDuringPlayback] = useState(true);
  const [lineTypeVisibility, setLineTypeVisibility] = useState<Record<BoardLine["type"], boolean>>({
    arrow: true,
    run: true,
    rotation: true,
  });
  const [speed, setSpeed] = useState(1);
  const [lineColor, setLineColor] = useState("#ffffff");
  const [lineAnimationMode, setLineAnimationMode] = useState<LineAnimationMode>("off");
  const [lineAnimationSequenceId, setLineAnimationSequenceId] = useState(() => makeId());
  const [lineAnimationActorId, setLineAnimationActorId] = useState<string | null>(null);
  const [lineAnimationLastPoint, setLineAnimationLastPoint] = useState<Point | null>(null);
  const [lineAnimationStep, setLineAnimationStep] = useState(0);
  const [status, setStatus] = useState("Velg et verktøy og bygg situasjonen.");
  const [zoom, setZoom] = useState(1);
  const [viewCenter, setViewCenter] = useState<Point>({ x: 500, y: 325 });
  const [formation, setFormation] = useState<FormationId>("433");
  const [formationTeam, setFormationTeam] = useState<Team>("blue");
  const [presentationMode, setPresentationMode] = useState(false);
  const [passFromId, setPassFromId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [pendingSequenceDirection, setPendingSequenceDirection] = useState<1 | -1 | null>(null);
  const [openToolPanel, setOpenToolPanel] = useState<string | null>("Bygg");

  const currentScene = scenes[sceneIndex] ?? scenes[0];
  const objects = currentScene?.objects ?? [];
  const lines = currentScene?.lines ?? [];
  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );
  const selectedLine = useMemo(
    () => lines.find((line) => line.id === selectedLineId) ?? null,
    [lines, selectedLineId],
  );
  const lastAnimatedLine = useMemo(
    () => [...lines].reverse().find((line) => line.sequenceId && line.animationKind && line.actorId) ?? null,
    [lines],
  );
  const hiddenObjects = useMemo(() => objects.filter((object) => object.hidden), [objects]);
  const hiddenLines = useMemo(() => lines.filter((line) => line.hidden), [lines]);
  const hiddenItemCount = hiddenObjects.length + hiddenLines.length;

  const visibleSnapPoints = useMemo(() => {
    const groups = new Map<string, { point: Point; count: number }>();
    for (const line of lines) {
      if (line.hidden || !lineTypeVisibility[line.type] || !line.endSnapId) continue;
      const current = groups.get(line.endSnapId);
      if (current) current.count += 1;
      else groups.set(line.endSnapId, { point: { ...line.end }, count: 1 });
    }
    return Array.from(groups.entries())
      .filter(([, value]) => value.count >= 2)
      .map(([id, value]) => ({ id, ...value }));
  }, [lines, lineTypeVisibility]);

  const sceneDuration = useMemo(() => {
    const objectEnds = objects.filter(hasMotion).map((object) => (object.motionStart ?? 0) + (object.motionDuration ?? 2));
    const lineEnds = lines
      .filter((line) => line.animationKind && line.actorId && line.timingStart !== undefined && line.timingDuration !== undefined)
      .map((line) => (line.timingStart ?? 0) + (line.timingDuration ?? 0));
    const ends = [...objectEnds, ...lineEnds];
    return ends.length > 0 ? Math.max(...ends) : 4;
  }, [objects, lines]);

  const animatedObjects = useMemo(
    () => objects.filter((object) => hasMotion(object) || lines.some((line) => line.actorId === object.id && line.animationKind)),
    [objects, lines],
  );
  const config = pitchConfig[pitch];
  const baseView = pitchViews[pitchView];
  const visibleWidth = baseView.width / zoom;
  const visibleHeight = baseView.height / zoom;
  const visibleX = clamp(viewCenter.x - visibleWidth / 2, 0, 1000 - visibleWidth);
  const visibleY = clamp(viewCenter.y - visibleHeight / 2, 0, 650 - visibleHeight);
  const currentViewBox = `${visibleX} ${visibleY} ${visibleWidth} ${visibleHeight}`;
  const guideLinesVisible = showGuideLines && !(hideGuideLinesDuringPlayback && (isPlaying || pendingSequenceDirection !== null));

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

  function updateCurrentLinesWithoutHistory(updater: (items: BoardLine[]) => BoardLine[]) {
    setScenes((current) => current.map((scene, index) =>
      index === sceneIndex ? { ...scene, lines: updater(scene.lines) } : scene
    ));
  }

  function undo() {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryFuture((current) => [clone(scenes), ...current].slice(0, 40));
    setHistoryPast((current) => current.slice(0, -1));
    setScenes(clone(previous));
    setSceneIndex((current) => Math.min(current, previous.length - 1));
    setSelectedId(null);
    setSelectedLineId(null);
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
    setSelectedLineId(null);
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

  function lineSnapThreshold() {
    const svg = svgRef.current;
    if (!svg) return 18;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return 18;
    const boardUnitsPerPixel = Math.max(visibleWidth / rect.width, visibleHeight / rect.height);
    return Math.max(10, 18 * boardUnitsPerPixel);
  }

  function findLineEndSnap(point: Point, disabled = false, excludeLineId?: string) {
    if (disabled || lines.length === 0) return null;
    const threshold = lineSnapThreshold();
    let best: BoardLine | null = null;
    let bestDistance = threshold;

    for (const line of lines) {
      if (line.id === excludeLineId || line.hidden || !lineTypeVisibility[line.type]) continue;
      const distance = pointDistance(point, line.end);
      if (
        distance < bestDistance ||
        (Math.abs(distance - bestDistance) < 0.001 && line.endSnapId && !best?.endSnapId)
      ) {
        best = line;
        bestDistance = distance;
      }
    }

    return best ? { line: best, point: { ...best.end }, distance: bestDistance } : null;
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

  function animationToolForMode(mode: LineAnimationMode): Tool | null {
    if (mode === "pass") return "arrow";
    if (mode === "run") return "run";
    if (mode === "rotation") return "rotation";
    return null;
  }

  function resetLineAnimationSequence(message = true) {
    setLineAnimationSequenceId(makeId());
    setLineAnimationActorId(null);
    setLineAnimationLastPoint(null);
    setLineAnimationStep(0);
    setPlayhead(0);
    if (message && lineAnimationMode !== "off") {
      setStatus(
        lineAnimationMode === "pass"
          ? "Ny pasningssekvens: tegn linje 1. Ballen opprettes automatisk."
          : "Ny bevegelsessekvens: start ved spilleren som skal følge linjene.",
      );
    }
  }

  function changeLineAnimationMode(mode: LineAnimationMode) {
    stopAnimation(false);
    cancelFreehand();
    setLineAnimationMode(mode);
    setLineAnimationSequenceId(makeId());
    setLineAnimationActorId(null);
    setLineAnimationLastPoint(null);
    setLineAnimationStep(0);
    setDrawing(null);
    setPlayhead(0);

    const nextTool = animationToolForMode(mode);
    if (nextTool) setTool(nextTool);

    if (mode === "off") {
      setStatus("Linjeanimasjon er av. Linjene tegnes som vanlige taktiske markeringer.");
    } else if (mode === "pass") {
      setStatus("Pasningsanimasjon: tegn linje 1. Ballen opprettes automatisk og følger linjene i rekkefølge.");
    } else if (mode === "run") {
      setStatus("Løpsanimasjon: dra første linje fra spilleren som skal løpe. Nye linjer blir steg 2, 3 osv.");
    } else {
      setStatus("Rulleringsanimasjon: dra første linje fra spilleren. Nye linjer blir neste steg i rulleringen.");
    }
  }

  function resumeLineAnimationSequence(sourceLine: BoardLine) {
    if (!sourceLine.sequenceId || !sourceLine.animationKind || !sourceLine.actorId) {
      setStatus("Denne linjen tilhører ikke en animasjonssekvens.");
      return;
    }

    const sequenceLines = lines
      .filter((line) => line.sequenceId === sourceLine.sequenceId && line.animationKind && line.actorId)
      .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));

    const lastLine = sequenceLines[sequenceLines.length - 1];
    if (!lastLine) {
      setStatus("Fant ingen steg å fortsette fra.");
      return;
    }

    const mode = sourceLine.animationKind;
    const nextTool = animationToolForMode(mode);
    if (!nextTool) return;

    stopAnimation(false);
    cancelFreehand();
    setLineAnimationMode(mode);
    setLineAnimationSequenceId(sourceLine.sequenceId);
    setLineAnimationActorId(sourceLine.actorId);
    setLineAnimationLastPoint({ ...lastLine.end });
    setLineAnimationStep(sequenceLines.length);
    setTool(nextTool);
    setDrawing(null);
    setSelectedLineId(null);
    setSelectedId(mode === "pass" ? null : sourceLine.actorId);
    setPlayhead(0);
    setContextMenu(null);
    setStatus(
      `Fortsetter sekvensen fra steg ${sequenceLines.length}. Tegn neste linje for å lage steg ${sequenceLines.length + 1}.`,
    );
  }

  function latestActorMovementLine(actorId: string) {
    const candidates = lines.filter((line) =>
      line.actorId === actorId &&
      (line.animationKind === "run" || line.animationKind === "rotation")
    );
    if (candidates.length === 0) return null;

    return candidates.reduce((latest, line) => {
      const latestEnd = latest.timingStart !== undefined && latest.timingDuration !== undefined
        ? latest.timingStart + latest.timingDuration
        : -1;
      const lineEnd = line.timingStart !== undefined && line.timingDuration !== undefined
        ? line.timingStart + line.timingDuration
        : -1;

      if (lineEnd > latestEnd + 0.001) return line;
      if (Math.abs(lineEnd - latestEnd) <= 0.001) {
        return lines.indexOf(line) > lines.indexOf(latest) ? line : latest;
      }
      return latest;
    });
  }

  function prepareLineDrawing(type: "arrow" | "run" | "rotation", pointerStart: Point, object?: BoardObject): DrawingLine | null {
    const modeTool = animationToolForMode(lineAnimationMode);
    const animated = lineAnimationMode !== "off" && modeTool === type;

    if (!animated) return { type, start: pointerStart, current: pointerStart };

    let actorId = lineAnimationActorId;
    let start = lineAnimationLastPoint ?? pointerStart;
    let startAfterLineId: string | undefined;

    if (lineAnimationMode === "pass") {
      if (!actorId) {
        const existingBall = objects.find((item) => item.type === "ball");
        actorId = existingBall?.id ?? makeId();
      }
      if (!lineAnimationLastPoint && object) start = { x: object.x, y: object.y };
    } else {
      if (!actorId) {
        const candidate = object?.type === "player"
          ? object
          : objects.find((item) => item.id === selectedId && item.type === "player");
        if (!candidate) {
          setStatus("Velg spilleren som skal følge løps-/rulleringssekvensen, eller start linjen direkte fra spilleren.");
          return null;
        }
        actorId = candidate.id;

        if (lineAnimationMode === "rotation" && !lineAnimationLastPoint) {
          const previousMovement = latestActorMovementLine(actorId);
          if (previousMovement) {
            start = { ...previousMovement.end };
            startAfterLineId = previousMovement.id;
          } else {
            start = { x: candidate.x, y: candidate.y };
          }
        } else {
          start = { x: candidate.x, y: candidate.y };
        }
      }
    }

    setLineAnimationActorId(actorId);
    const order = lineAnimationStep + 1;
    setStatus(
      startAfterLineId
        ? `Rulleringen starter fra spillerens siste posisjon. Tegner steg ${order}.`
        : `Tegner steg ${order}. Slipp for å lagre, tegn deretter neste linje.`,
    );

    return {
      type,
      start,
      current: start,
      sequenceId: lineAnimationSequenceId,
      sequenceOrder: order,
      animationKind: lineAnimationMode as Exclude<LineAnimationMode, "off">,
      actorId,
      startAfterLineId,
    };
  }

  function lineAnimationDuration(kind: Exclude<LineAnimationMode, "off">, path: Point[]) {
    const distance = pathLength(path);
    const unitsPerSecond = kind === "pass" ? 260 : kind === "run" ? 115 : 95;
    const minimum = kind === "pass" ? 0.35 : 0.55;
    return Math.max(minimum, distance / unitsPerSecond);
  }

  function recalculateHiddenLineTiming(scene: Scene) {
    const animatedLines = scene.lines.filter((line) => line.animationKind && line.actorId && line.sequenceId);
    if (animatedLines.length === 0) return;

    const sequenceIds = Array.from(new Set(animatedLines.map((line) => line.sequenceId as string)));
    const passSequenceIds = sequenceIds.filter((sequenceId) =>
      animatedLines.some((line) => line.sequenceId === sequenceId && line.animationKind === "pass"),
    );
    const movementSequenceIds = sequenceIds.filter((sequenceId) =>
      animatedLines.some((line) => line.sequenceId === sequenceId && (line.animationKind === "run" || line.animationKind === "rotation")),
    );

    const sortedSequence = (sequenceId: string) =>
      animatedLines
        .filter((line) => line.sequenceId === sequenceId)
        .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));

    const naturalDuration = (line: BoardLine) =>
      lineAnimationDuration(line.animationKind as Exclude<LineAnimationMode, "off">, linePoints(line));

    const schedulePasses = (useSyncTargets: boolean) => {
      for (const sequenceId of passSequenceIds) {
        const passLines = sortedSequence(sequenceId);
        let cursor = 0;

        for (const line of passLines) {
          const duration = naturalDuration(line);
          let start = cursor;

          if (useSyncTargets) {
            let bestArrival: number | null = null;
            let bestDistance = Number.POSITIVE_INFINITY;

            for (const movementId of movementSequenceIds) {
              const movementLines = sortedSequence(movementId);
              const last = movementLines[movementLines.length - 1];
              if (!last || last.timingStart === undefined || last.timingDuration === undefined) continue;
              if (!line.endSnapId || !last.endSnapId || line.endSnapId !== last.endSnapId) continue;
              const distance = pointDistance(last.end, line.end);
              if (distance < bestDistance) {
                bestDistance = distance;
                bestArrival = last.timingStart + last.timingDuration;
              }
            }

            if (bestArrival !== null) start = Math.max(start, bestArrival - duration);
          }

          line.timingStart = start;
          line.timingDuration = duration;
          cursor = start + duration;
        }
      }
    };

    const scheduleMovements = () => {
      const passLines = passSequenceIds.flatMap((sequenceId) => sortedSequence(sequenceId));

      for (const sequenceId of movementSequenceIds) {
        const movementLines = sortedSequence(sequenceId);
        if (movementLines.length === 0) continue;

        const first = movementLines[0];
        let earliestStart = 0;

        if (first.startAfterLineId) {
          const previousMovement = animatedLines.find((line) => line.id === first.startAfterLineId);
          if (
            previousMovement &&
            previousMovement.timingStart !== undefined &&
            previousMovement.timingDuration !== undefined
          ) {
            earliestStart = previousMovement.timingStart + previousMovement.timingDuration;
          }
        }

        const matchingPasses = passLines
          .filter((passLine) =>
            passLine.timingStart !== undefined &&
            pointDistance(passLine.start, first.start) <= 30
          )
          .sort((a, b) => (a.timingStart ?? 0) - (b.timingStart ?? 0));

        const trigger = matchingPasses.find((passLine) =>
          (passLine.timingStart ?? 0) >= earliestStart - 0.03
        ) ?? (earliestStart <= 0.03 ? matchingPasses[0] : undefined);

        let cursor = Math.max(earliestStart, trigger?.timingStart ?? earliestStart);
        for (const line of movementLines) {
          const duration = naturalDuration(line);
          line.timingStart = cursor;
          line.timingDuration = duration;
          cursor += duration;
        }
      }
    };

    schedulePasses(false);
    for (let iteration = 0; iteration < 4; iteration += 1) {
      scheduleMovements();
      schedulePasses(true);
    }
    scheduleMovements();
    schedulePasses(true);
    scheduleMovements();

    for (const passSequenceId of passSequenceIds) {
      for (const passLine of sortedSequence(passSequenceId)) {
        if (passLine.timingStart === undefined || passLine.timingDuration === undefined) continue;
        const passArrival = passLine.timingStart + passLine.timingDuration;

        let targetLine: BoardLine | null = null;
        let targetArrival = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const movementId of movementSequenceIds) {
          const movementLines = sortedSequence(movementId);
          const last = movementLines[movementLines.length - 1];
          if (!last || last.timingStart === undefined || last.timingDuration === undefined) continue;
          if (!passLine.endSnapId || !last.endSnapId || passLine.endSnapId !== last.endSnapId) continue;
          const distance = pointDistance(last.end, passLine.end);
          if (distance < bestDistance) {
            targetLine = last;
            targetArrival = last.timingStart + last.timingDuration;
            bestDistance = distance;
          }
        }

        if (targetLine && passArrival > targetArrival + 0.01) {
          targetLine.timingDuration = Math.max(
            0.15,
            (targetLine.timingDuration ?? 0) + (passArrival - targetArrival),
          );
        }
      }
    }

    for (const object of scene.objects) {
      const actorLines = animatedLines
        .filter((line) =>
          line.actorId === object.id &&
          line.timingStart !== undefined &&
          line.timingDuration !== undefined
        )
        .sort((a, b) => (a.timingStart ?? 0) - (b.timingStart ?? 0));

      if (actorLines.length === 0) continue;

      const first = actorLines[0];
      let last = actorLines[0];
      for (const line of actorLines) {
        const lineEnd = (line.timingStart ?? 0) + (line.timingDuration ?? 0);
        const lastEnd = (last.timingStart ?? 0) + (last.timingDuration ?? 0);
        if (lineEnd > lastEnd) last = line;
      }

      const start = first.timingStart ?? 0;
      const end = (last.timingStart ?? 0) + (last.timingDuration ?? 0);
      object.x = first.start.x;
      object.y = first.start.y;
      object.target = undefined;
      const actorPath: Point[] = [];
      for (const line of actorLines) {
        const points = linePoints(line);
        if (actorPath.length === 0) actorPath.push(...points);
        else actorPath.push(...points.slice(1));
      }
      object.motionPath = actorPath;
      object.motionStart = start;
      object.motionDuration = Math.max(0.15, end - start);
    }
  }

  function chooseTool(nextTool: Tool) {
    stopAnimation(false);
    cancelFreehand();
    setTool(nextTool);
    setDrawing(null);
    if (nextTool !== "select") setSelectedLineId(null);
    const activeAnimationTool = animationToolForMode(lineAnimationMode);
    if (lineAnimationMode !== "off" && nextTool !== activeAnimationTool) {
      setLineAnimationMode("off");
      setLineAnimationActorId(null);
      setLineAnimationLastPoint(null);
      setLineAnimationStep(0);
    }
    setContextMenu(null);
    if (nextTool !== "pass") setPassFromId(null);

    const messages: Partial<Record<Tool, string>> = {
      select: "Trykk på et objekt for hurtigvalg. Dra for å flytte.",
      hand: zoom > 1 ? "Dra i banen for å panorere." : "Zoom inn først, og dra deretter banen.",
      movement: selectedId ? "Trykk på banen der valgt objekt skal ende." : "Velg først en spiller eller ball.",
      freeMovement: selectedId ? "Dra fra valgt objekt og tegn hele bevegelsen." : "Velg først en spiller eller ball.",
      pass: "Trykk først på pasningsspilleren, deretter mottakeren.",
      arrow: "Dra fra start til slutt for å tegne en pasningspil.",
      run: "Dra fra start til slutt for å tegne en stiplet løpslinje.",
      rotation: "Dra fra spiller/stasjon til neste plass i rulleringen.",
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
    } else if (["mannequin", "miniGoal", "ladder", "hurdle", "gate", "zone", "circleShape", "semicircle"].includes(tool)) {
      next = {
        id: makeId(),
        type: tool as ObjectType,
        scale: 1,
        rotation: 0,
        ...point,
      };
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

    if (["blue", "red", "keeperBlue", "keeperRed", "ball", "cone", "mannequin", "miniGoal", "ladder", "hurdle", "gate", "zone", "circleShape", "semicircle"].includes(tool)) {
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

    if (tool === "arrow" || tool === "run" || tool === "rotation") {
      const prepared = prepareLineDrawing(tool, point);
      if (!prepared) return;
      setDrawing(prepared);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "select") {
      setSelectedId(null);
      setSelectedLineId(null);
    }
  }

  function handleBoardPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const point = boardPoint(event);

    if (draggingId && tool === "select") {
      setPlayhead(0);
      updateCurrentObjectsWithoutHistory((items) => items.map((object) => object.id === draggingId ? { ...object, x: point.x, y: point.y } : object));
    }

    const linePointDrag = linePointDragRef.current;
    if (linePointDrag && tool === "select") {
      setPlayhead(0);
      updateCurrentLinesWithoutHistory((items) => items.map((line) => {
        if (line.id !== linePointDrag.lineId) return line;

        const points = linePoints(line);
        const isEnd = linePointDrag.pointIndex === points.length - 1;
        const isStart = linePointDrag.pointIndex === 0;
        let nextPoint = point;

        if (isEnd) {
          const snap = findLineEndSnap(point, event.altKey, line.id);
          linePointDrag.snapTargetLineId = snap?.line.id;
          if (snap) nextPoint = snap.point;
        }

        if (isStart) return { ...line, start: nextPoint };
        if (isEnd) return { ...line, end: nextPoint, endSnapId: undefined };

        const controls = [...(line.controlPoints ?? [])];
        controls[linePointDrag.pointIndex - 1] = nextPoint;
        return { ...line, controlPoints: controls, lineShape: "free" };
      }));
    }

    if (drawing) {
      const snap = findLineEndSnap(point, event.altKey);
      setDrawing({
        ...drawing,
        current: snap ? snap.point : point,
        snapTargetLineId: snap?.line.id,
      });
    }

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
    const linePointDrag = linePointDragRef.current;
    if (linePointDrag) {
      const before = linePointDrag.snapshot;
      const snapTargetLineId = linePointDrag.snapTargetLineId;
      linePointDragRef.current = null;

      setScenes((current) => {
        const next = clone(current);
        const scene = next[sceneIndex];
        if (!scene) return current;

        const edited = scene.lines.find((line) => line.id === linePointDrag.lineId);
        if (!edited) return current;

        if (snapTargetLineId) {
          const target = scene.lines.find((line) => line.id === snapTargetLineId);
          if (target) {
            const snapId = target.endSnapId ?? makeId();
            target.endSnapId = snapId;
            edited.endSnapId = snapId;
            edited.end = { ...target.end };
          }
        } else {
          edited.endSnapId = undefined;
        }

        syncEditedLine(scene, edited.id);
        return next;
      });
      snapshotForHistory(before);
      setPlayhead(0);
      setStatus(snapTargetLineId ? "Linjen er flyttet og snappet. Timing er beregnet på nytt." : "Linjen er flyttet. Timing er beregnet på nytt.");
    }

    if (draggingId) {
      if (dragSnapshotRef.current) snapshotForHistory(dragSnapshotRef.current);
      dragSnapshotRef.current = null;
      setDraggingId(null);
    }

    if (freehandRef.current) finishFreehand(event);

    if (drawing) {
      const rawEnd = boardPoint(event);
      const snap = findLineEndSnap(rawEnd, event.altKey);
      const end = snap ? snap.point : rawEnd;
      const snapId = snap ? (snap.line.endSnapId ?? makeId()) : undefined;

      if (pointDistance(drawing.start, end) > 10) {
        const line: BoardLine = {
          id: makeId(),
          type: drawing.type,
          start: drawing.start,
          end,
          color: lineColor,
          sequenceId: drawing.sequenceId,
          sequenceOrder: drawing.sequenceOrder,
          animationKind: drawing.animationKind,
          actorId: drawing.actorId,
          endSnapId: snapId,
          startAfterLineId: drawing.startAfterLineId,
        };

        mutateCurrentScene((scene) => {
          if (snap && snapId) {
            const target = scene.lines.find((item) => item.id === snap.line.id);
            if (target && !target.endSnapId) target.endSnapId = snapId;
          }
          scene.lines.push(line);

          if (!drawing.animationKind || !drawing.actorId) return;

          let actor = scene.objects.find((object) => object.id === drawing.actorId);
          if (!actor && drawing.animationKind === "pass") {
            actor = { id: drawing.actorId, type: "ball", x: drawing.start.x, y: drawing.start.y };
            scene.objects.push(actor);
          }
          if (!actor) return;

          const sequenceLines = drawing.sequenceId
            ? scene.lines
                .filter((item) => item.sequenceId === drawing.sequenceId && item.animationKind && item.actorId)
                .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0))
            : [line];
          const path = sequenceLines.length > 0
            ? sequenceLines.reduce<Point[]>((all, item, index) => {
                const points = linePoints(item);
                all.push(...(index === 0 ? points : points.slice(1)));
                return all;
              }, [])
            : [drawing.start, end];

          actor.x = path[0].x;
          actor.y = path[0].y;
          actor.target = undefined;
          actor.motionPath = path;
          actor.motionStart = 0;
          actor.motionDuration = lineAnimationDuration(drawing.animationKind, path);
          recalculateHiddenLineTiming(scene);
        });

        if (drawing.animationKind) {
          setLineAnimationLastPoint(end);
          setLineAnimationStep(drawing.sequenceOrder ?? lineAnimationStep + 1);
          setPlayhead(0);
          setStatus(
            snap
              ? `Steg ${drawing.sequenceOrder ?? lineAnimationStep + 1} lagret og snappet til felles ankomstpunkt.`
              : `Steg ${drawing.sequenceOrder ?? lineAnimationStep + 1} lagret. Tegn neste linje for å legge til neste steg, eller trykk Play.`,
          );
        } else {
          setStatus(snap ? "Linjen er snappet til et eksisterende endepunkt." : "Linje lagt til. Ctrl/Cmd+Z angrer.");
        }
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
      scene.lines.push({ id: makeId(), type: "arrow", start: { x: from.x, y: from.y }, end: { x: to.x, y: to.y }, color: lineColor });
    });
    setPassFromId(null);
    setPlayhead(0);
    setStatus(`${motionLabel(from)} → ${motionLabel(to)}. Ballen og pasningspilen er lagt inn.`);
  }

  function handleObjectPointerDown(event: ReactPointerEvent<SVGGElement>, object: BoardObject) {
    event.stopPropagation();
    setContextMenu(null);
    setSelectedId(object.id);
    setSelectedLineId(null);

    if (tool === "arrow" || tool === "run" || tool === "rotation") {
      const start = { x: object.x, y: object.y };
      const prepared = prepareLineDrawing(tool, start, object);
      if (!prepared) return;
      setDrawing(prepared);
      event.currentTarget.setPointerCapture(event.pointerId);
      if (!prepared.animationKind) {
        setStatus(
          tool === "arrow"
            ? "Dra pasningspilen til ønsket sluttpunkt."
            : tool === "rotation"
              ? "Dra rulleringslinjen til neste stasjon/plass."
              : "Dra løpslinjen til ønsket sluttpunkt.",
        );
      }
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
      if (object.type !== "player" && object.type !== "ball") {
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
    const timedLines = lines
      .filter((line) =>
        line.actorId === object.id &&
        line.animationKind &&
        line.timingStart !== undefined &&
        line.timingDuration !== undefined
      )
      .sort((a, b) => (a.timingStart ?? 0) - (b.timingStart ?? 0));

    if (timedLines.length > 0) {
      const first = timedLines[0];
      if (time <= (first.timingStart ?? 0)) return { ...first.start };

      let lastPoint = { ...first.start };
      for (const line of timedLines) {
        const start = line.timingStart ?? 0;
        const duration = Math.max(0.01, line.timingDuration ?? 0.01);
        const end = start + duration;

        if (time < start) return lastPoint;
        if (time <= end) {
          const progress = clamp((time - start) / duration, 0, 1);
          return pointAlongPath(linePoints(line), progress);
        }

        lastPoint = { ...line.end };
      }
      return lastPoint;
    }

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

  function updateSelectedLineColor(color?: string) {
    if (!selectedLineId) return;
    mutateCurrentScene((scene) => {
      scene.lines = scene.lines.map((line) => line.id === selectedLineId ? { ...line, color } : line);
    });
    setStatus(color ? "Linjefargen er endret." : "Linjen bruker standardfarge igjen.");
  }

  function hideSelectedObject() {
    if (!selectedId) return;
    mutateCurrentScene((scene) => {
      scene.objects = scene.objects.map((object) =>
        object.id === selectedId ? { ...object, hidden: true } : object
      );
    });
    setSelectedId(null);
    setContextMenu(null);
    setStatus("Elementet er skjult. Du kan vise det igjen under Synlighet.");
  }

  function hideSelectedLine() {
    if (!selectedLineId) return;
    mutateCurrentScene((scene) => {
      scene.lines = scene.lines.map((line) =>
        line.id === selectedLineId ? { ...line, hidden: true } : line
      );
    });
    setSelectedLineId(null);
    setStatus("Linjen er skjult. Animasjon og timing er beholdt.");
  }

  function showHiddenObject(id: string) {
    mutateCurrentScene((scene) => {
      scene.objects = scene.objects.map((object) =>
        object.id === id ? { ...object, hidden: undefined } : object
      );
    });
    setStatus("Elementet vises igjen.");
  }

  function showHiddenLine(id: string) {
    mutateCurrentScene((scene) => {
      scene.lines = scene.lines.map((line) =>
        line.id === id ? { ...line, hidden: undefined } : line
      );
    });
    setStatus("Linjen vises igjen.");
  }

  function showAllHiddenItems() {
    if (hiddenItemCount === 0) return;
    mutateCurrentScene((scene) => {
      scene.objects = scene.objects.map((object) => ({ ...object, hidden: undefined }));
      scene.lines = scene.lines.map((line) => ({ ...line, hidden: undefined }));
    });
    setStatus("Alle individuelt skjulte elementer vises igjen.");
  }

  function toggleLineTypeVisibility(type: BoardLine["type"]) {
    const nextVisible = !lineTypeVisibility[type];
    setLineTypeVisibility((current) => ({ ...current, [type]: nextVisible }));
    if (!nextVisible && selectedLine?.type === type) setSelectedLineId(null);
    const label = type === "arrow" ? "Pasningslinjer" : type === "run" ? "Løpslinjer" : "Rulleringslinjer";
    setStatus(nextVisible ? `${label} vises.` : `${label} er skjult.`);
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
    setSelectedLineId(null);
    setStatus("Objekt duplisert.");
  }

  function rebuildAnimatedSequence(scene: Scene, sequenceId: string) {
    const sequenceLines = scene.lines
      .filter((line) => line.sequenceId === sequenceId && line.animationKind && line.actorId)
      .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));

    if (sequenceLines.length === 0) return;

    const actorId = sequenceLines[0].actorId;
    const kind = sequenceLines[0].animationKind;
    if (!actorId || !kind) return;

    sequenceLines.forEach((line, index) => {
      line.sequenceOrder = index + 1;
      if (index > 0) line.start = { ...sequenceLines[index - 1].end };
    });

    const actor = scene.objects.find((object) => object.id === actorId);
    if (!actor) return;

    const path = sequenceLines.reduce<Point[]>((all, line, index) => {
      const points = linePoints(line);
      all.push(...(index === 0 ? points : points.slice(1)));
      return all;
    }, []);
    actor.x = path[0].x;
    actor.y = path[0].y;
    actor.target = undefined;
    actor.motionPath = path;
    actor.motionStart = 0;
    actor.motionDuration = lineAnimationDuration(kind, path);
    recalculateHiddenLineTiming(scene);
  }

  function syncEditedLine(scene: Scene, lineId: string) {
    const edited = scene.lines.find((line) => line.id === lineId);
    if (!edited) return;

    if (edited.sequenceId && edited.animationKind && edited.actorId) {
      rebuildAnimatedSequence(scene, edited.sequenceId);
    } else {
      recalculateHiddenLineTiming(scene);
    }
  }

  function setSelectedLineShape(shape: "straight" | "free") {
    if (!selectedLineId) return;
    mutateCurrentScene((scene) => {
      const line = scene.lines.find((item) => item.id === selectedLineId);
      if (!line) return;

      line.lineShape = shape;
      if (shape === "straight") {
        line.controlPoints = undefined;
      } else if (!line.controlPoints?.length) {
        line.controlPoints = [{
          x: (line.start.x + line.end.x) / 2,
          y: (line.start.y + line.end.y) / 2,
        }];
      }
      syncEditedLine(scene, line.id);
    });
    setPlayhead(0);
    setStatus(shape === "straight" ? "Linjen er gjort rett." : "Linjen er fri. Dra styrepunktene for å forme den.");
  }

  function addSelectedLineControlPoint() {
    if (!selectedLineId) return;
    mutateCurrentScene((scene) => {
      const line = scene.lines.find((item) => item.id === selectedLineId);
      if (!line) return;

      const points = linePoints(line);
      let longestIndex = 0;
      let longestLength = -1;
      for (let i = 0; i < points.length - 1; i += 1) {
        const length = pointDistance(points[i], points[i + 1]);
        if (length > longestLength) {
          longestLength = length;
          longestIndex = i;
        }
      }

      const a = points[longestIndex];
      const b = points[longestIndex + 1];
      const nextPoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const controls = [...(line.controlPoints ?? [])];
      controls.splice(longestIndex, 0, nextPoint);
      line.controlPoints = controls;
      line.lineShape = "free";
      syncEditedLine(scene, line.id);
    });
    setPlayhead(0);
    setStatus("Nytt styrepunkt er lagt på den lengste delen av linjen. Dra punktet dit du vil.");
  }

  function removeSelectedLineControlPoint() {
    if (!selectedLineId || !selectedLine?.controlPoints?.length) return;
    mutateCurrentScene((scene) => {
      const line = scene.lines.find((item) => item.id === selectedLineId);
      if (!line?.controlPoints?.length) return;
      line.controlPoints = line.controlPoints.slice(0, -1);
      if (line.controlPoints.length === 0) {
        line.controlPoints = undefined;
        line.lineShape = "straight";
      }
      syncEditedLine(scene, line.id);
    });
    setPlayhead(0);
    setStatus("Siste styrepunkt er fjernet.");
  }

  function handleLinePointPointerDown(
    event: ReactPointerEvent<SVGCircleElement>,
    line: BoardLine,
    pointIndex: number,
  ) {
    if (tool !== "select") return;
    event.stopPropagation();
    setSelectedLineId(line.id);
    setSelectedId(null);
    setContextMenu(null);
    linePointDragRef.current = {
      lineId: line.id,
      pointIndex,
      snapshot: clone(scenes),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setStatus(pointIndex === linePoints(line).length - 1 ? "Flytter linjens endepunkt." : "Flytter linjepunkt.");
  }

  function deleteSelectedLine() {
    if (!selectedLineId) return;
    const lineToDelete = lines.find((line) => line.id === selectedLineId);
    mutateCurrentScene((scene) => {
      scene.lines = scene.lines.filter((line) => line.id !== selectedLineId);

      if (lineToDelete?.sequenceId && lineToDelete.actorId && lineToDelete.animationKind) {
        const remaining = scene.lines.filter((line) => line.sequenceId === lineToDelete.sequenceId);
        if (remaining.length > 0) {
          rebuildAnimatedSequence(scene, lineToDelete.sequenceId);
        } else {
          const actor = scene.objects.find((object) => object.id === lineToDelete.actorId);
          if (actor) {
            actor.target = undefined;
            actor.motionPath = undefined;
            actor.motionStart = undefined;
            actor.motionDuration = undefined;
          }
        }
      }
      recalculateHiddenLineTiming(scene);
    });
    setSelectedLineId(null);
    setPlayhead(0);
    setLineAnimationLastPoint(null);
    setLineAnimationStep(0);
    setStatus("Linjen er slettet.");
  }

  function handleLinePointerDown(event: ReactPointerEvent<SVGElement>, line: BoardLine) {
    if (tool !== "select") return;
    event.stopPropagation();
    setSelectedLineId(line.id);
    setSelectedId(null);
    setContextMenu(null);
    setStatus(
      line.sequenceOrder
        ? `Steg ${line.sequenceOrder} valgt. Trykk Slett eller Delete/Backspace for å fjerne bare denne linjen.`
        : "Linje valgt. Trykk Slett eller Delete/Backspace.",
    );
  }

  function deleteSelected() {
    if (!selectedId) return;
    mutateCurrentScene((scene) => {
      scene.objects = scene.objects.filter((object) => object.id !== selectedId);
    });
    setSelectedId(null);
    setSelectedLineId(null);
    setContextMenu(null);
    setStatus("Objekt slettet.");
  }

  function clearBoard() {
    if (!window.confirm("Vil du tømme hele prosjektet, inkludert alle scener?")) return;
    snapshotForHistory(scenes);
    setScenes([createEmptyScene()]);
    setSceneIndex(0);
    setSelectedId(null);
    setSelectedLineId(null);
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
    setSelectedLineId(null);
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
    setSelectedLineId(null);
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
    setLineAnimationSequenceId(makeId());
    setLineAnimationActorId(null);
    setLineAnimationLastPoint(null);
    setLineAnimationStep(0);
    animationRef.current = null;
    sequenceRef.current = false;
    setIsPlaying(false);
    setSceneIndex(index);
    setSelectedId(null);
    setSelectedLineId(null);
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
        if (Array.isArray(parsed.scenes) && parsed.scenes.length) {
          const restoredScenes = clone(parsed.scenes);
          restoredScenes.forEach((scene) => recalculateHiddenLineTiming(scene));
          setScenes(restoredScenes);
        }
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
      const restoredScene: Scene = { id: makeId(), name: "Scene 1", objects: parsed.objects ?? [], lines: parsed.lines ?? [] };
      recalculateHiddenLineTiming(restoredScene);
      setScenes([restoredScene]);
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
        <rect className="pitchBackground" x="0" y="0" width="1000" height="650" fill="url(#pitchGlow)" />
        {Array.from({ length: 10 }).map((_, index) => (
          <rect className="pitchStripe" key={index} x={index * 100} y="0" width="100" height="650" fill={index % 2 === 0 ? "rgba(255,255,255,.026)" : "rgba(0,0,0,.026)"} />
        ))}
        <g className="pitchGrid" opacity=".16" stroke="#d8ffe6" strokeWidth="1">
          {Array.from({ length: 20 }).map((_, index) => <line key={`v-${index}`} x1={index * 50} y1="0" x2={index * 50} y2="650" />)}
          {Array.from({ length: 13 }).map((_, index) => <line key={`h-${index}`} x1="0" y1={index * 50} x2="1000" y2={index * 50} />)}
        </g>
        <g className="pitchMarkings" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="3.5">
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
        <g className="pitchDots" fill="rgba(255,255,255,.95)">
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
        if (selectedLineId) {
          event.preventDefault();
          deleteSelectedLine();
        } else if (selectedId) {
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
  }, [selectedId, selectedLineId, historyPast, historyFuture, playhead, isPlaying, sceneDuration, scenes, sceneIndex]);

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
            <button className="ghostButton" type="button" onClick={() => window.print()}>⌁ Skriv ut</button>
            <button className="ghostButton" type="button" onClick={() => setPresentationMode(true)}>◱ Presenter</button>
            <button className="primaryButton" type="button" onClick={saveBoard}>Lagre</button>
          </div>
        </header>
      )}

      <div className="studioGrid">
        {!presentationMode && (
          <aside className="glassPanel toolDock">
            <div className="compactToolDockHeader">
              <div>
                <span className="eyebrow">VERKTØY</span>
                <strong>{tool === "select" ? "Velg" : toolGroups.flatMap((group) => group.items).find((item) => item.id === tool)?.label ?? "Velg verktøy"}</strong>
              </div>
              <span className={`animationModePill ${lineAnimationMode !== "off" ? "active" : ""}`}>
                {lineAnimationMode === "off" ? "Vanlig" : lineAnimationMode === "pass" ? "Pasning" : lineAnimationMode === "run" ? "Løp" : "Rullering"}
              </span>
            </div>

            <button
              type="button"
              className={`persistentSelectTool ${tool === "select" ? "active" : ""}`}
              onClick={() => chooseTool("select")}
              title="Velg, flytt og rediger objekter og linjer"
            >
              <span className="persistentSelectIcon">↖</span>
              <span>
                <strong>Velg</strong>
                <small>Flytt og rediger</small>
              </span>
            </button>

            <div className="toolAccordion">
              {toolGroups.map((group) => {
                const activeItem = group.items.find((item) => item.id === tool);
                const open = openToolPanel === group.title;
                return (
                  <section className={`toolDropdown ${open ? "open" : ""}`} key={group.title}>
                    <button
                      type="button"
                      className="toolDropdownTrigger"
                      onClick={() => setOpenToolPanel(open ? null : group.title)}
                      aria-expanded={open}
                    >
                      <span className="dropdownIcon">{group.icon}</span>
                      <span className="dropdownTitle">
                        <strong>{group.title}</strong>
                        <small>{activeItem ? activeItem.label : group.title === "Manuell bevegelse" ? "Rett eller fri bane" : "Trykk for å åpne"}</small>
                      </span>
                      <span className="dropdownChevron">{open ? "⌃" : "⌄"}</span>
                    </button>
                    {open && (
                      <div className="toolDropdownBody">
                        <div className="toolButtons compactToolButtons">
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
                      </div>
                    )}
                  </section>
                );
              })}

              <section className={`toolDropdown ${openToolPanel === "Animasjon" ? "open" : ""}`}>
                <button
                  type="button"
                  className="toolDropdownTrigger"
                  onClick={() => setOpenToolPanel(openToolPanel === "Animasjon" ? null : "Animasjon")}
                  aria-expanded={openToolPanel === "Animasjon"}
                >
                  <span className="dropdownIcon">▶</span>
                  <span className="dropdownTitle">
                    <strong>Animasjon</strong>
                    <small>{lineAnimationMode === "off" ? "Av · vanlig tegning" : lineAnimationMode === "pass" ? "Pasning · ball" : lineAnimationMode === "run" ? "Løp · spiller" : "Rullering · spiller"}</small>
                  </span>
                  <span className="dropdownChevron">{openToolPanel === "Animasjon" ? "⌃" : "⌄"}</span>
                </button>
                {openToolPanel === "Animasjon" && (
                  <div className="toolDropdownBody animationLineSection">
                    <select className="darkSelect" value={lineAnimationMode} onChange={(event) => changeLineAnimationMode(event.target.value as LineAnimationMode)}>
                      <option value="off">Av · vanlig tegning</option>
                      <option value="pass">Pasning · ball følger linjene</option>
                      <option value="run">Løp · valgt spiller følger</option>
                      <option value="rotation">Rullering · valgt spiller følger</option>
                    </select>
                    {lineAnimationMode === "off" && lastAnimatedLine && (
                      <button className="secondaryButton full" type="button" onClick={() => resumeLineAnimationSequence(lastAnimatedLine)}>
                        ↪ Fortsett siste animasjon
                      </button>
                    )}
                    {lineAnimationMode !== "off" && (
                      <div className="lineAnimationBuilder">
                        <div>
                          <strong>Steg {lineAnimationStep + 1}</strong>
                          <span>
                            {lineAnimationMode === "pass"
                              ? "Ball"
                              : lineAnimationActorId
                                ? motionLabel(objects.find((object) => object.id === lineAnimationActorId) ?? { id: "", type: "player", x: 0, y: 0, team: "blue" })
                                : "Velg spiller"}
                          </span>
                        </div>
                        <button className="miniButton text" type="button" onClick={() => resetLineAnimationSequence()}>＋ Ny sekvens</button>
                      </div>
                    )}
                    <small className="lineColorHint">
                      Bruk Pasning, Løp eller Rullering under «Tegn». Snap til samme endepunkt synkroniserer ankomsten.
                    </small>
                  </div>
                )}
              </section>

              <section className={`toolDropdown ${openToolPanel === "Synlighet" ? "open" : ""}`}>
                <button
                  type="button"
                  className="toolDropdownTrigger"
                  onClick={() => setOpenToolPanel(openToolPanel === "Synlighet" ? null : "Synlighet")}
                  aria-expanded={openToolPanel === "Synlighet"}
                >
                  <span className="dropdownIcon">◉</span>
                  <span className="dropdownTitle">
                    <strong>Synlighet</strong>
                    <small>{hiddenItemCount > 0 ? `${hiddenItemCount} skjult individuelt` : "Elementer og linjetyper"}</small>
                  </span>
                  <span className="dropdownChevron">{openToolPanel === "Synlighet" ? "⌃" : "⌄"}</span>
                </button>
                {openToolPanel === "Synlighet" && (
                  <div className="toolDropdownBody visibilityPanel">
                    <div className="visibilityGroup">
                      <span className="visibilityHeading">Linjetyper</span>
                      <button type="button" className={`visibilityToggle ${lineTypeVisibility.arrow ? "on" : "off"}`} onClick={() => toggleLineTypeVisibility("arrow")}>
                        <span>➜ Pasning</span><b>{lineTypeVisibility.arrow ? "Vises" : "Skjult"}</b>
                      </button>
                      <button type="button" className={`visibilityToggle ${lineTypeVisibility.run ? "on" : "off"}`} onClick={() => toggleLineTypeVisibility("run")}>
                        <span>⋯ Løp</span><b>{lineTypeVisibility.run ? "Vises" : "Skjult"}</b>
                      </button>
                      <button type="button" className={`visibilityToggle ${lineTypeVisibility.rotation ? "on" : "off"}`} onClick={() => toggleLineTypeVisibility("rotation")}>
                        <span>↻ Rullering</span><b>{lineTypeVisibility.rotation ? "Vises" : "Skjult"}</b>
                      </button>
                    </div>

                    <div className="visibilityGroup">
                      <div className="visibilityHeadingRow">
                        <span className="visibilityHeading">Skjult individuelt</span>
                        {hiddenItemCount > 0 && (
                          <button className="miniButton text" type="button" onClick={showAllHiddenItems}>Vis alle</button>
                        )}
                      </div>
                      {hiddenItemCount === 0 ? (
                        <small className="lineColorHint">Velg et objekt eller en linje og trykk «Skjul» for å legge det her.</small>
                      ) : (
                        <div className="hiddenItemList">
                          {hiddenObjects.map((object) => (
                            <button key={object.id} type="button" className="hiddenItemRow" onClick={() => showHiddenObject(object.id)}>
                              <span>{motionLabel(object)}</span><b>Vis</b>
                            </button>
                          ))}
                          {hiddenLines.map((line) => (
                            <button key={line.id} type="button" className="hiddenItemRow" onClick={() => showHiddenLine(line.id)}>
                              <span>
                                {line.type === "arrow" ? "Pasningslinje" : line.type === "run" ? "Løpslinje" : "Rulleringslinje"}
                                {line.sequenceOrder ? ` · steg ${line.sequenceOrder}` : ""}
                              </span>
                              <b>Vis</b>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section className={`toolDropdown ${openToolPanel === "Farge" ? "open" : ""}`}>
                <button
                  type="button"
                  className="toolDropdownTrigger"
                  onClick={() => setOpenToolPanel(openToolPanel === "Farge" ? null : "Farge")}
                  aria-expanded={openToolPanel === "Farge"}
                >
                  <span className="dropdownIcon colorDot" style={{ "--current-line-color": lineColor } as CSSProperties}>●</span>
                  <span className="dropdownTitle">
                    <strong>Linjefarge</strong>
                    <small>Farge på nye linjer</small>
                  </span>
                  <span className="dropdownChevron">{openToolPanel === "Farge" ? "⌃" : "⌄"}</span>
                </button>
                {openToolPanel === "Farge" && (
                  <div className="toolDropdownBody lineColorSection">
                    <div className="lineColorPalette" aria-label="Velg linjefarge">
                      {lineColors.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`lineColorSwatch ${lineColor.toLowerCase() === item.value ? "active" : ""}`}
                          style={{ "--swatch": item.value } as CSSProperties}
                          onClick={() => setLineColor(item.value)}
                          title={item.label}
                          aria-label={item.label}
                        />
                      ))}
                      <label className="customColor" title="Velg egen farge">
                        <span>+</span>
                        <input type="color" value={lineColor} onChange={(event) => setLineColor(event.target.value)} aria-label="Egen linjefarge" />
                      </label>
                    </div>
                  </div>
                )}
              </section>

              <section className={`toolDropdown ${openToolPanel === "Startformasjon" ? "open" : ""}`}>
                <button
                  type="button"
                  className="toolDropdownTrigger"
                  onClick={() => setOpenToolPanel(openToolPanel === "Startformasjon" ? null : "Startformasjon")}
                  aria-expanded={openToolPanel === "Startformasjon"}
                >
                  <span className="dropdownIcon">▦</span>
                  <span className="dropdownTitle">
                    <strong>Startformasjon</strong>
                    <small>{formations.find((item) => item.id === formation)?.label ?? formation}</small>
                  </span>
                  <span className="dropdownChevron">{openToolPanel === "Startformasjon" ? "⌃" : "⌄"}</span>
                </button>
                {openToolPanel === "Startformasjon" && (
                  <div className="toolDropdownBody formationSection">
                    <select className="darkSelect" value={formation} onChange={(event) => setFormation(event.target.value as FormationId)}>
                      {formations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                    <div className="segmented small">
                      <button type="button" className={formationTeam === "blue" ? "active" : ""} onClick={() => setFormationTeam("blue")}>Blå</button>
                      <button type="button" className={formationTeam === "red" ? "active" : ""} onClick={() => setFormationTeam("red")}>Rød</button>
                    </div>
                    <button className="secondaryButton full" type="button" onClick={applyFormationPreset}>Legg inn formasjon</button>
                  </div>
                )}
              </section>
            </div>
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
                onPointerCancel={() => { setDraggingId(null); setDrawing(null); cancelFreehand(); linePointDragRef.current = null; panDragRef.current = null; }}
              >
                <defs>
                  <marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="3.8" markerHeight="3.8" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10Z" fill="context-stroke" />
                  </marker>
                </defs>

                {renderPitch()}

                {guideLinesVisible && lines.filter((line) => !line.hidden && lineTypeVisibility[line.type]).map((line) => {
                  const color = line.color ?? "#ffffff";
                  const isWhite = color.toLowerCase() === "#ffffff" || color.toLowerCase() === "#fff";
                  const points = linePoints(line);
                  const pointsString = linePathPointsString(line);
                  const midpoint = pointAlongPath(points, 0.5);
                  const selected = selectedLineId === line.id;
                  return (
                    <g key={line.id}>
                      <polyline
                        className="lineHitArea"
                        points={pointsString}
                        fill="none"
                        stroke="transparent" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"
                        pointerEvents={tool === "select" ? "stroke" : "none"}
                        onPointerDown={(event) => handleLinePointerDown(event, line)}
                      />
                      {selected && (
                        <polyline
                          points={pointsString}
                          fill="none"
                          stroke="#f7dd72" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity=".28"
                          pointerEvents="none"
                        />
                      )}
                      <polyline
                        className={`tacticLine ${isWhite ? "whiteLine" : ""}`}
                        points={pointsString}
                        fill="none"
                        stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray={line.type === "run" ? "8 7" : line.type === "rotation" ? "3 6 13 6" : undefined}
                        markerEnd={line.type === "arrow" || line.type === "rotation" ? "url(#arrowHead)" : undefined}
                        opacity=".92"
                        pointerEvents="none"
                      />
                      {line.sequenceOrder ? (
                        <g className="animationStepBadge" transform={`translate(${midpoint.x} ${midpoint.y})`}>
                          <circle r="9" fill="#081511" stroke={color} strokeWidth="1.8" />
                          <text y="3.4" textAnchor="middle" fill={color} fontSize="8.5" fontWeight="950">{line.sequenceOrder}</text>
                        </g>
                      ) : line.type === "rotation" ? (
                        <g className="rotationBadge" transform={`translate(${midpoint.x} ${midpoint.y})`}>
                          <circle r="8.5" fill="#081511" stroke={color} strokeWidth="1.8" />
                          <text y="3.2" textAnchor="middle" fill={color} fontSize="8" fontWeight="950">R</text>
                        </g>
                      ) : null}

                      {selected && tool === "select" && points.map((point, pointIndex) => {
                        const isEnd = pointIndex === points.length - 1;
                        const isStart = pointIndex === 0;
                        const lockedSequenceStart = isStart && Boolean(line.sequenceOrder && line.sequenceOrder > 1);
                        if (lockedSequenceStart) return null;
                        return (
                          <circle
                            key={`${line.id}-point-${pointIndex}`}
                            className={`lineEditHandle ${isEnd ? "end" : isStart ? "start" : "control"}`}
                            cx={point.x}
                            cy={point.y}
                            r={isEnd || isStart ? 7 : 6}
                            fill={isEnd ? "#70f0a6" : isStart ? "#f7dd72" : "#081511"}
                            stroke={isEnd || isStart ? "#081511" : "#70f0a6"}
                            strokeWidth="2"
                            onPointerDown={(event) => handleLinePointPointerDown(event, line, pointIndex)}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {guideLinesVisible && visibleSnapPoints.map((snap) => (
                  <g key={`snap-${snap.id}`} className="sharedSnapPoint" transform={`translate(${snap.point.x} ${snap.point.y})`} pointerEvents="none">
                    <circle r="7" fill="#081511" stroke="#70f0a6" strokeWidth="1.8" opacity=".9" />
                    <circle r="2.2" fill="#70f0a6" />
                  </g>
                ))}

                {drawing && (
                  <g>
                    <line
                      x1={drawing.start.x} y1={drawing.start.y} x2={drawing.current.x} y2={drawing.current.y}
                      stroke={lineColor} strokeWidth="2.3" strokeLinecap="round"
                      strokeDasharray={drawing.type === "run" ? "8 7" : drawing.type === "rotation" ? "3 6 13 6" : undefined}
                      markerEnd={drawing.type === "arrow" || drawing.type === "rotation" ? "url(#arrowHead)" : undefined}
                      opacity=".96"
                    />
                    {drawing.snapTargetLineId && (
                      <g className="snapPreview" transform={`translate(${drawing.current.x} ${drawing.current.y})`} pointerEvents="none">
                        <circle r="17" fill="rgba(112,240,166,.10)" stroke="#70f0a6" strokeWidth="2.4" />
                        <circle r="5" fill="#70f0a6" />
                        <text y="-23" textAnchor="middle" fill="#dfffea" fontSize="10" fontWeight="900">SYNK</text>
                      </g>
                    )}
                    {drawing.sequenceOrder ? (
                      <g transform={`translate(${(drawing.start.x + drawing.current.x) / 2} ${(drawing.start.y + drawing.current.y) / 2})`}>
                        <circle r="9" fill="#081511" stroke={lineColor} strokeWidth="1.8" />
                        <text y="3.4" textAnchor="middle" fill={lineColor} fontSize="8.5" fontWeight="950">{drawing.sequenceOrder}</text>
                      </g>
                    ) : drawing.type === "rotation" ? (
                      <g transform={`translate(${(drawing.start.x + drawing.current.x) / 2} ${(drawing.start.y + drawing.current.y) / 2})`}>
                        <circle r="8.5" fill="#081511" stroke={lineColor} strokeWidth="1.8" />
                        <text y="3.2" textAnchor="middle" fill={lineColor} fontSize="8" fontWeight="950">R</text>
                      </g>
                    ) : null}
                  </g>
                )}

                {guideLinesVisible && objects.filter((object) => !object.hidden).map((object) => object.target && (
                  <g key={`target-${object.id}`} opacity={object.id === selectedId ? ".9" : ".42"}>
                    <line x1={object.x} y1={object.y} x2={object.target.x} y2={object.target.y} stroke={object.id === selectedId ? "#f7dd72" : "#fff"} strokeWidth="2.6" strokeDasharray="8 9" />
                    <circle cx={object.target.x} cy={object.target.y} r="8" fill="none" stroke="#fff" strokeWidth="2.5" />
                  </g>
                ))}

                {guideLinesVisible && objects.filter((object) => !object.hidden).map((object) => object.motionPath && object.motionPath.length > 1 && (
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

                {objects.filter((object) => !object.hidden).map((object) => {
                  const point = displayPoint(object);
                  const selected = object.id === selectedId;
                  const dimmed = selectedId && !selected && tool === "select";
                  const cursor = tool === "select" ? "grab" : tool === "freeMovement" ? "crosshair" : tool === "hand" ? "grab" : "pointer";
                  const objectColor = object.color ?? defaultObjectColor(object);
                  const objectContrast = contrastColor(objectColor);

                  if (object.type === "ball") {
                    return (
                      <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} opacity={dimmed ? .58 : 1} onPointerDown={(event) => handleObjectPointerDown(event, object)} onContextMenu={(event) => handleObjectContextMenu(event, object)} style={{ cursor }}>
                        <circle className="touchTarget" r="20" fill="transparent" />
                        {selected && <circle r="14" fill="rgba(247,221,114,.11)" stroke="#f7dd72" strokeWidth="2.4" filter="url(#softGlow)" />}
                        <circle r="7" fill={objectColor} stroke={objectContrast} strokeWidth="1.8" />
                        <path d="M0,-3 3,-1 2,3 -2,3 -3,-1Z" fill={objectContrast} />
                      </g>
                    );
                  }

                  if (object.type === "cone") {
                    return (
                      <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} opacity={dimmed ? .58 : 1} onPointerDown={(event) => handleObjectPointerDown(event, object)} onContextMenu={(event) => handleObjectContextMenu(event, object)} style={{ cursor }}>
                        <circle className="touchTarget" r="21" fill="transparent" />
                        {selected && <circle r="15" fill="none" stroke="#f7dd72" strokeWidth="2.4" />}
                        <path d="M0,-10 L9,8 L-9,8Z" fill={objectColor} stroke={objectContrast} strokeWidth="1.4" />
                        <rect x="-11" y="7" width="22" height="4" rx="2" fill={objectColor} />
                      </g>
                    );
                  }

                  if (isFigureObject(object)) {
                    const figureScale = object.scale ?? 1;
                    const figureRotation = object.rotation ?? 0;
                    const figureTransform = `translate(${point.x} ${point.y}) rotate(${figureRotation}) scale(${figureScale})`;
                    let figure: ReactNode = null;

                    if (object.type === "mannequin") {
                      figure = (
                        <g className="trainingFigure mannequinFigure">
                          <circle cx="0" cy="-23" r="6" fill={objectColor} stroke={objectContrast} strokeWidth="1.7" />
                          <path d="M-11,-14 Q0,-20 11,-14 L8,6 L4,20 L-4,20 L-8,6Z" fill={objectColor} stroke={objectContrast} strokeWidth="1.8" />
                          <line x1="0" y1="20" x2="0" y2="31" stroke={objectColor} strokeWidth="3" />
                          <line x1="-13" y1="31" x2="13" y2="31" stroke={objectColor} strokeWidth="4" strokeLinecap="round" />
                        </g>
                      );
                    } else if (object.type === "miniGoal") {
                      figure = (
                        <g className="trainingFigure miniGoalFigure" fill="none" stroke={objectColor} strokeWidth="2.5" strokeLinejoin="round">
                          <path d="M-30,17 L-30,-15 L24,-15 L24,17Z" />
                          <path d="M24,-15 L32,-8 L32,20 L24,17 M-30,-15 L-22,-8 L32,-8" opacity=".75" />
                          <path d="M-22,-8 V20 H32 M-10,-8 V20 M2,-8 V20 M14,-8 V20 M26,-8 V20 M-22,1 H32 M-22,10 H32" opacity=".42" strokeWidth="1.1" />
                        </g>
                      );
                    } else if (object.type === "ladder") {
                      figure = (
                        <g className="trainingFigure ladderFigure" fill="none" stroke={objectColor} strokeWidth="2.7" strokeLinecap="round">
                          <line x1="-12" y1="-30" x2="-12" y2="30" />
                          <line x1="12" y1="-30" x2="12" y2="30" />
                          {[-24, -12, 0, 12, 24].map((y) => <line key={y} x1="-12" y1={y} x2="12" y2={y} />)}
                        </g>
                      );
                    } else if (object.type === "hurdle") {
                      figure = (
                        <g className="trainingFigure hurdleFigure" fill="none" stroke={objectColor} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M-20,20 V-8 H20 V20" />
                          <line x1="-25" y1="20" x2="-14" y2="20" />
                          <line x1="14" y1="20" x2="25" y2="20" />
                        </g>
                      );
                    } else if (object.type === "gate") {
                      figure = (
                        <g className="trainingFigure gateFigure">
                          <path d="M-22,-12 L-14,11 L-30,11Z M22,-12 L30,11 L14,11Z" fill={objectColor} stroke={objectContrast} strokeWidth="1.4" />
                          <line x1="-13" y1="0" x2="13" y2="0" stroke={objectColor} strokeWidth="2.2" strokeDasharray="5 5" opacity=".9" />
                        </g>
                      );
                    } else if (object.type === "zone") {
                      figure = <rect className="trainingFigure trainingZone" x="-45" y="-27" width="90" height="54" rx="5" fill={objectColor} fillOpacity=".16" stroke={objectColor} strokeWidth="2.4" strokeDasharray="8 6" />;
                    } else if (object.type === "circleShape") {
                      figure = <circle className="trainingFigure trainingZone" r="30" fill={objectColor} fillOpacity=".14" stroke={objectColor} strokeWidth="2.4" strokeDasharray="8 6" />;
                    } else if (object.type === "semicircle") {
                      figure = <path className="trainingFigure trainingZone" d="M-35,16 A35,35 0 0 1 35,16" fill="none" stroke={objectColor} strokeWidth="2.7" strokeDasharray="8 6" />;
                    }

                    return (
                      <g key={object.id} data-board-object="true" transform={figureTransform} opacity={dimmed ? .5 : 1} onPointerDown={(event) => handleObjectPointerDown(event, object)} onContextMenu={(event) => handleObjectContextMenu(event, object)} style={{ cursor }}>
                        <rect className="touchTarget" x="-39" y="-39" width="78" height="78" rx="10" fill="transparent" />
                        {selected && <circle r="39" fill="rgba(247,221,114,.05)" stroke="#f7dd72" strokeWidth="2.2" strokeDasharray="5 5" />}
                        {figure}
                      </g>
                    );
                  }

                  const fill = objectColor;
                  const playerOutline = objectContrast;
                  return (
                    <g key={object.id} data-board-object="true" transform={`translate(${point.x} ${point.y})`} opacity={dimmed ? .48 : 1} onPointerDown={(event) => handleObjectPointerDown(event, object)} onContextMenu={(event) => handleObjectContextMenu(event, object)} style={{ cursor }}>
                      <circle className="touchTarget" r="23" fill="transparent" />
                      {selected && <circle r="19" fill="rgba(247,221,114,.1)" stroke="#f7dd72" strokeWidth="2.5" filter="url(#softGlow)" />}
                      {object.role === "keeper" ? (
                        <rect x="-12" y="-12" width="24" height="24" rx="6" fill={fill} stroke={playerOutline} strokeWidth="2.3" />
                      ) : (
                        <circle r="12" fill={fill} stroke={playerOutline} strokeWidth="2.3" />
                      )}
                      <text y="4" textAnchor="middle" fill={objectContrast} fontSize="10.5" fontWeight="900" pointerEvents="none">{object.number || "•"}</text>
                      {object.name && <text y="25" textAnchor="middle" fill="#fff" stroke="rgba(0,0,0,.62)" strokeWidth="3" paintOrder="stroke" fontSize="10" fontWeight="800" pointerEvents="none">{object.name}</text>}
                    </g>
                  );
                })}
              </svg>

              {contextMenu && (
                <div className="objectContextMenu" style={{ left: contextMenu.x, top: contextMenu.y }}>
                  <button type="button" onClick={() => { chooseTool("movement"); setContextMenu(null); }}>◎ Rett bevegelse</button>
                  <button type="button" onClick={() => { chooseTool("freeMovement"); setContextMenu(null); }}>〰 Fri bevegelse</button>
                  <button type="button" onClick={() => { duplicateSelected(); setContextMenu(null); }}>⧉ Dupliser</button>
                  <button type="button" onClick={hideSelectedObject}>◌ Skjul</button>
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
              <div className="lineVisibilityControls" aria-label="Visning av hjelpelinjer">
                <button
                  className={`miniButton text ${showGuideLines ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setShowGuideLines((current) => {
                      const next = !current;
                      setStatus(next ? "Hjelpelinjene vises." : "Hjelpelinjene er skjult.");
                      return next;
                    });
                  }}
                  title="Vis eller skjul alle hjelpe- og animasjonslinjer"
                >
                  {showGuideLines ? "◉ Linjer" : "○ Linjer"}
                </button>
                <button
                  className={`miniButton text ${hideGuideLinesDuringPlayback ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setHideGuideLinesDuringPlayback((current) => {
                      const next = !current;
                      setStatus(next ? "Linjene skjules automatisk under avspilling." : "Linjene forblir synlige under avspilling.");
                      return next;
                    });
                  }}
                  disabled={!showGuideLines}
                  title="Skjul linjene automatisk mens animasjonen spiller"
                >
                  {hideGuideLinesDuringPlayback ? "✓ Auto-skjul" : "Auto-skjul"}
                </button>
              </div>
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
              <div>
                <span className="sectionLabel">Inspektør</span>
                <strong>
                  {selectedObject
                    ? motionLabel(selectedObject)
                    : selectedLine
                      ? selectedLine.sequenceOrder
                        ? `Linje · steg ${selectedLine.sequenceOrder}`
                        : "Linje"
                      : "Ingen valgt"}
                </strong>
              </div>
              {selectedObject && <span className={`teamChip ${selectedObject.team ?? "neutral"}`}>{selectedObject.type === "player" ? (selectedObject.team === "blue" ? "BLÅ" : "RØD") : selectedObject.type.toUpperCase()}</span>}
              {selectedLine && <span className="teamChip neutral">{selectedLine.type === "arrow" ? "PASNING" : selectedLine.type === "run" ? "LØP" : "RULLERING"}</span>}
            </div>

            {selectedObject ? (
              <div className="inspectorContent">
                <div className="inspectorGroup colorInspector">
                  <div className="inspectorGroupTitle">Farge</div>
                  <div className="lineColorPalette" aria-label="Endre farge på valgt objekt">
                    {lineColors.map((item) => {
                      const currentColor = selectedObject.color ?? defaultObjectColor(selectedObject);
                      return (
                        <button
                          key={item.value}
                          type="button"
                          className={`lineColorSwatch ${currentColor.toLowerCase() === item.value ? "active" : ""}`}
                          style={{ "--swatch": item.value } as CSSProperties}
                          onClick={() => updateSelected({ color: item.value })}
                          title={item.label}
                          aria-label={item.label}
                        />
                      );
                    })}
                    <label className="customColor" title="Velg egen farge">
                      <span>+</span>
                      <input
                        type="color"
                        value={selectedObject.color ?? defaultObjectColor(selectedObject)}
                        onChange={(event) => updateSelected({ color: event.target.value })}
                        aria-label="Egen objektfarge"
                      />
                    </label>
                  </div>
                  {selectedObject.color && (
                    <button className="miniButton text" type="button" onClick={() => updateSelected({ color: undefined })}>↺ Standardfarge</button>
                  )}
                </div>

                {selectedObject.type === "player" && (
                  <div className="inspectorGroup">
                    <div className="inspectorGroupTitle">Spiller</div>
                    <label className="fieldLabel">Navn<input className="darkInput" value={selectedObject.name ?? ""} maxLength={18} placeholder="f.eks. Nico" onChange={(event) => updateSelected({ name: event.target.value })} /></label>
                    <label className="fieldLabel">Nummer<input className="darkInput" value={selectedObject.number ?? ""} maxLength={3} onChange={(event) => updateSelected({ number: event.target.value })} /></label>
                  </div>
                )}

                {isFigureObject(selectedObject) && (
                  <div className="inspectorGroup figureInspector">
                    <div className="inspectorGroupTitle">Figur</div>
                    <label className="rangeField">
                      <span><b>Størrelse</b><em>{Math.round((selectedObject.scale ?? 1) * 100)}%</em></span>
                      <input type="range" min="0.5" max="2.5" step="0.05" value={selectedObject.scale ?? 1} onChange={(event) => updateSelected({ scale: Number(event.target.value) })} />
                    </label>
                    <label className="rangeField">
                      <span><b>Rotasjon</b><em>{Math.round(selectedObject.rotation ?? 0)}°</em></span>
                      <input type="range" min="0" max="359" step="1" value={selectedObject.rotation ?? 0} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} />
                    </label>
                    <button className="secondaryButton full" type="button" onClick={() => updateSelected({ scale: 1, rotation: 0 })}>Nullstill figur</button>
                  </div>
                )}

                <div className="quickActions">
                  <button type="button" onClick={() => chooseTool("movement")}>◎ Rett</button>
                  <button type="button" onClick={() => chooseTool("freeMovement")}>〰 Fri</button>
                  <button type="button" onClick={duplicateSelected}>⧉ Kopi</button>
                  <button type="button" onClick={hideSelectedObject}>◌ Skjul</button>
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
            ) : selectedLine ? (
              <div className="inspectorContent">
                <div className="inspectorGroup colorInspector">
                  <div className="inspectorGroupTitle">Farge</div>
                  <div className="lineColorPalette" aria-label="Endre farge på valgt linje">
                    {lineColors.map((item) => {
                      const currentColor = selectedLine.color ?? "#ffffff";
                      return (
                        <button
                          key={item.value}
                          type="button"
                          className={`lineColorSwatch ${currentColor.toLowerCase() === item.value ? "active" : ""}`}
                          style={{ "--swatch": item.value } as CSSProperties}
                          onClick={() => updateSelectedLineColor(item.value)}
                          title={item.label}
                          aria-label={item.label}
                        />
                      );
                    })}
                    <label className="customColor" title="Velg egen farge">
                      <span>+</span>
                      <input
                        type="color"
                        value={selectedLine.color ?? "#ffffff"}
                        onChange={(event) => updateSelectedLineColor(event.target.value)}
                        aria-label="Egen linjefarge"
                      />
                    </label>
                  </div>
                  {selectedLine.color && (
                    <button className="miniButton text" type="button" onClick={() => updateSelectedLineColor(undefined)}>↺ Standardfarge</button>
                  )}
                </div>

                <div className="inspectorGroup lineGeometryInspector">
                  <div className="inspectorGroupTitle">Form på linjen</div>
                  <div className="segmented small">
                    <button
                      type="button"
                      className={!lineIsFree(selectedLine) ? "active" : ""}
                      onClick={() => setSelectedLineShape("straight")}
                    >
                      ━ Rett
                    </button>
                    <button
                      type="button"
                      className={lineIsFree(selectedLine) ? "active" : ""}
                      onClick={() => setSelectedLineShape("free")}
                    >
                      〰 Fri
                    </button>
                  </div>
                  <div className="linePointActions">
                    <button className="secondaryButton full" type="button" onClick={addSelectedLineControlPoint}>＋ Punkt</button>
                    <button
                      className="secondaryButton full"
                      type="button"
                      onClick={removeSelectedLineControlPoint}
                      disabled={!selectedLine.controlPoints?.length}
                    >
                      − Siste punkt
                    </button>
                  </div>
                  <p className="inspectorHelp">
                    Velg «Fri» eller legg til punkter. Dra de små håndtakene på banen for å flytte start, slutt og styrepunkter.
                  </p>
                </div>

                <div className="inspectorGroup">
                  <div className="inspectorGroupTitle">Valgt linje</div>
                  <p className="inspectorHelp">
                    {selectedLine.sequenceOrder
                      ? `Dette er steg ${selectedLine.sequenceOrder} i animasjonssekvensen. Du kan fortsette hele sekvensen fra siste steg, eller slette denne linjen.`
                      : "Denne linjen kan slettes uten å påvirke de andre linjene."}
                  </p>
                  {selectedLine.sequenceId && selectedLine.animationKind && selectedLine.actorId && (
                    <button className="secondaryButton full" type="button" onClick={() => resumeLineAnimationSequence(selectedLine)}>
                      ↪ Fortsett denne sekvensen
                    </button>
                  )}
                  <button className="secondaryButton full" type="button" onClick={hideSelectedLine}>◌ Skjul denne linjen</button>
                  <button className="secondaryButton full dangerText" type="button" onClick={deleteSelectedLine}>⌫ Slett denne linjen</button>
                </div>
              </div>
            ) : (
              <div className="inspectorEmpty">
                <div className="inspectorGlyph">↖</div>
                <strong>Velg et objekt eller en linje</strong>
                <p>Trykk på spiller, ball, kjegle, figur eller linje. Linjene har stort usynlig treffområde selv om de er tynne.</p>
                <div className="shortcutCard"><span>Mellomrom</span><b>Play / pause</b><span>R</span><b>Revers</b><span>Delete</span><b>Slett valgt</b><span>Ctrl/Cmd+Z</span><b>Angre</b></div>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
