"use client";

import { useEffect, useRef, useState } from "react";

type TouchPoint = {
  x: number;
  y: number;
  onObject: boolean;
};

type TransformState = {
  scale: number;
  x: number;
  y: number;
};

type GestureState = {
  startDistance: number;
  startMidX: number;
  startMidY: number;
  startTransform: TransformState;
};

type LongPressState = {
  pointerId: number;
  startX: number;
  startY: number;
  target: SVGGElement;
  timer: number;
};

type SmoothDrawState = {
  pointerId: number;
  x: number;
  y: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: TouchPoint, b: TouchPoint) => Math.hypot(b.x - a.x, b.y - a.y);

function midpoint(a: TouchPoint, b: TouchPoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function activeToolContains(text: string) {
  const active = document.querySelector<HTMLButtonElement>(".studioTool.active");
  return Boolean(active?.textContent?.toLowerCase().includes(text.toLowerCase()));
}

export default function TouchEnhancer() {
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const [boardMode, setBoardMode] = useState(false);
  const transformRef = useRef<TransformState>({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    const media = window.matchMedia("(any-pointer: coarse)");
    const saved = window.localStorage.getItem("taktikktavle-touch-mode");
    const enabled = saved === null ? media.matches : saved === "1";
    setCoarsePointer(media.matches);
    setTouchMode(enabled);

    const onChange = () => setCoarsePointer(media.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("touchMode", touchMode);
    document.body.classList.toggle("touchBoardMode", touchMode && boardMode);
    window.localStorage.setItem("taktikktavle-touch-mode", touchMode ? "1" : "0");
    if (!touchMode) setBoardMode(false);
    return () => {
      document.body.classList.remove("touchMode", "touchBoardMode");
    };
  }, [touchMode, boardMode]);

  useEffect(() => {
    if (!touchMode) return;

    const wrap = document.querySelector<HTMLDivElement>(".pitchWrap");
    const svg = document.querySelector<SVGSVGElement>(".pitchSvg");
    if (!wrap || !svg) return;

    const pointers = new Map<number, TouchPoint>();
    const syntheticEvents = new WeakSet<Event>();
    let gesture: GestureState | null = null;
    let longPress: LongPressState | null = null;
    let smoothDraw: SmoothDrawState | null = null;

    const applyTransform = (next: TransformState) => {
      const rect = wrap.getBoundingClientRect();
      const minX = rect.width * (1 - next.scale);
      const minY = rect.height * (1 - next.scale);
      const bounded: TransformState = {
        scale: clamp(next.scale, 1, 2.8),
        x: next.scale <= 1.001 ? 0 : clamp(next.x, minX, 0),
        y: next.scale <= 1.001 ? 0 : clamp(next.y, minY, 0),
      };
      transformRef.current = bounded;
      svg.style.transformOrigin = "0 0";
      svg.style.transform = `translate3d(${bounded.x}px, ${bounded.y}px, 0) scale(${bounded.scale})`;
      wrap.dataset.touchZoom = bounded.scale.toFixed(2);
    };

    const clearLongPress = () => {
      if (longPress) window.clearTimeout(longPress.timer);
      longPress = null;
    };

    const addHitAreas = () => {
      svg.querySelectorAll<SVGGElement>('g[data-board-object="true"]').forEach((group) => {
        if (group.querySelector(":scope > .touchHitArea")) return;
        const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        hit.setAttribute("class", "touchHitArea");
        hit.setAttribute("r", "29");
        hit.setAttribute("cx", "0");
        hit.setAttribute("cy", "0");
        hit.setAttribute("fill", "transparent");
        hit.setAttribute("stroke", "none");
        hit.setAttribute("pointer-events", "all");
        hit.setAttribute("aria-hidden", "true");
        group.insertBefore(hit, group.firstChild);
      });
    };

    addHitAreas();
    const observer = new MutationObserver(addHitAreas);
    observer.observe(svg, { childList: true, subtree: true });

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      const object = (event.target as Element | null)?.closest<SVGGElement>('g[data-board-object="true"]');
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, onObject: Boolean(object) });

      if (object && activeToolContains("velg")) {
        clearLongPress();
        const timer = window.setTimeout(() => {
          const menuEvent = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY,
            button: 2,
          });
          object.dispatchEvent(menuEvent);
          if ("vibrate" in navigator) navigator.vibrate?.(12);
          longPress = null;
        }, 560);
        longPress = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          target: object,
          timer,
        };
      }

      if (object && activeToolContains("fri")) {
        smoothDraw = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      }

      if (pointers.size === 2 && activeToolContains("velg")) {
        const pair = [...pointers.values()];
        if (pair.some((point) => point.onObject)) return;
        const mid = midpoint(pair[0], pair[1]);
        const rect = wrap.getBoundingClientRect();
        gesture = {
          startDistance: Math.max(1, distance(pair[0], pair[1])),
          startMidX: mid.x - rect.left,
          startMidY: mid.y - rect.top,
          startTransform: { ...transformRef.current },
        };
        clearLongPress();
        wrap.classList.add("touchGesturing");
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (syntheticEvents.has(event)) return;
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

      const current = pointers.get(event.pointerId);
      if (current) {
        current.x = event.clientX;
        current.y = event.clientY;
      }

      if (longPress && longPress.pointerId === event.pointerId) {
        if (Math.hypot(event.clientX - longPress.startX, event.clientY - longPress.startY) > 9) clearLongPress();
      }

      if (gesture && pointers.size >= 2) {
        const pair = [...pointers.values()].slice(0, 2);
        const rect = wrap.getBoundingClientRect();
        const mid = midpoint(pair[0], pair[1]);
        const midX = mid.x - rect.left;
        const midY = mid.y - rect.top;
        const scaleRatio = distance(pair[0], pair[1]) / gesture.startDistance;
        const newScale = clamp(gesture.startTransform.scale * scaleRatio, 1, 2.8);
        const relativeScale = newScale / gesture.startTransform.scale;
        const x = midX - relativeScale * (gesture.startMidX - gesture.startTransform.x);
        const y = midY - relativeScale * (gesture.startMidY - gesture.startTransform.y);
        applyTransform({ scale: newScale, x, y });
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (smoothDraw && smoothDraw.pointerId === event.pointerId && activeToolContains("fri")) {
        const alpha = 0.36;
        smoothDraw.x += (event.clientX - smoothDraw.x) * alpha;
        smoothDraw.y += (event.clientY - smoothDraw.y) * alpha;
        const smoothed = new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          isPrimary: event.isPrimary,
          clientX: smoothDraw.x,
          clientY: smoothDraw.y,
          buttons: event.buttons,
          pressure: event.pressure,
          width: event.width,
          height: event.height,
        });
        syntheticEvents.add(smoothed);
        event.preventDefault();
        event.stopPropagation();
        svg.dispatchEvent(smoothed);
      }
    };

    const endPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (longPress?.pointerId === event.pointerId) clearLongPress();
      if (smoothDraw?.pointerId === event.pointerId) smoothDraw = null;
      if (pointers.size < 2) {
        gesture = null;
        wrap.classList.remove("touchGesturing");
      }
    };

    wrap.addEventListener("pointerdown", onPointerDown, { capture: true });
    wrap.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
    wrap.addEventListener("pointerup", endPointer, { capture: true });
    wrap.addEventListener("pointercancel", endPointer, { capture: true });

    return () => {
      observer.disconnect();
      clearLongPress();
      wrap.removeEventListener("pointerdown", onPointerDown, { capture: true });
      wrap.removeEventListener("pointermove", onPointerMove, { capture: true } as EventListenerOptions);
      wrap.removeEventListener("pointerup", endPointer, { capture: true });
      wrap.removeEventListener("pointercancel", endPointer, { capture: true });
      wrap.classList.remove("touchGesturing");
    };
  }, [touchMode]);

  const resetTouchView = () => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    const svg = document.querySelector<SVGSVGElement>(".pitchSvg");
    const wrap = document.querySelector<HTMLDivElement>(".pitchWrap");
    if (svg) {
      svg.style.transform = "translate3d(0px, 0px, 0) scale(1)";
      svg.style.transformOrigin = "0 0";
    }
    if (wrap) wrap.dataset.touchZoom = "1.00";
  };

  if (!coarsePointer && !touchMode) {
    return (
      <button className="touchModeLauncher" type="button" onClick={() => setTouchMode(true)} title="Aktiver touch-modus">
        ☝
      </button>
    );
  }

  return (
    <div className="touchControlDock" aria-label="Touch-kontroller">
      <button className={touchMode ? "active" : ""} type="button" onClick={() => setTouchMode((current) => !current)}>
        <span>☝</span><b>{touchMode ? "Touch på" : "Touch av"}</b>
      </button>
      <button className={boardMode ? "active" : ""} type="button" disabled={!touchMode} onClick={() => setBoardMode((current) => !current)}>
        <span>▣</span><b>{boardMode ? "Vis menyer" : "Tavlemodus"}</b>
      </button>
      <button type="button" disabled={!touchMode} onClick={resetTouchView}>
        <span>⌖</span><b>Nullstill zoom</b>
      </button>
    </div>
  );
}
