"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number;     // 0-1, fraction for left pane. Default: 0.5
  minLeftPx?: number;
  minRightPx?: number;
  leftClassName?: string;
  rightClassName?: string;
  gutterClassName?: string;
  storageKey?: string;       // localStorage key for persistence
}

const GUTTER = 8; // px

function loadRatio(storageKey: string, defaultRatio: number): number {
  if (typeof window === "undefined") return defaultRatio;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const v = parseFloat(saved);
      if (v > 0 && v < 1) return v;
    }
  } catch {}
  return defaultRatio;
}

export function ResizableSplit({
  left,
  right,
  defaultRatio = 0.5,
  minLeftPx = 320,
  minRightPx = 320,
  leftClassName,
  rightClassName,
  gutterClassName,
  storageKey = "resizable-split",
}: ResizableSplitProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Use ref for ratio — persisted ratio storage, no re-render dependency
  const ratioRef = React.useRef(loadRatio(storageKey, defaultRatio));
  const [leftWidth, setLeftWidth] = React.useState<number | null>(null);

  // Measure container on mount/resize and set pixel width from current ratio
  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    function applyMeasuredWidth() {
      const rect = container.getBoundingClientRect();
      const avail = rect.width - GUTTER;
      if (avail <= 0) return;
      const initial = avail * ratioRef.current;
      setLeftWidth(Math.max(minLeftPx, Math.min(avail - minRightPx, initial)));
    }

    applyMeasuredWidth();
    const ro = new ResizeObserver(applyMeasuredWidth);
    ro.observe(container);
    return () => ro.disconnect();
  }, [minLeftPx, minRightPx]);

  // Persist ratio
  React.useEffect(() => {
    if (!containerRef.current || leftWidth === null) return;
    const ratio = leftWidth / (containerRef.current.getBoundingClientRect().width - GUTTER);
    ratioRef.current = ratio;
    try {
      localStorage.setItem(storageKey, ratio.toFixed(3));
    } catch {}
  }, [leftWidth, storageKey]);

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const dragging = React.useRef(false);

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clamped = Math.max(minLeftPx, Math.min(rect.width - GUTTER - minRightPx, x));
      setLeftWidth(clamped);
    },
    [minLeftPx, minRightPx]
  );

  const onPointerUp = React.useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-row h-full w-full min-w-0"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Left pane — pixel width */}
      <div
        className={cn("flex flex-col h-full overflow-hidden shrink-0", leftClassName)}
        style={{ width: leftWidth ?? `${defaultRatio * 100}%` }}
      >
        {left}
      </div>

      {/* Gutter / drag handle */}
      <div
        className={cn(
          "relative shrink-0 cursor-col-resize hover:w-[7px] active:w-[7px] transition-[width] duration-75 group select-none",
          "bg-[#e0ded6] hover:bg-[#1B365D]/20 active:bg-[#1B365D]/30",
          gutterClassName
        )}
        style={{ width: `${GUTTER}px`, touchAction: "none" }}
        onPointerDown={onPointerDown}
      >
        {/* Visual grip dots */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] flex flex-col items-center justify-center gap-[2px] opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
          <div className="w-[2px] h-[2px] rounded-full bg-[#1B365D]/40" />
          <div className="w-[2px] h-[2px] rounded-full bg-[#1B365D]/40" />
          <div className="w-[2px] h-[2px] rounded-full bg-[#1B365D]/40" />
        </div>
      </div>

      {/* Right pane — flex-1 fills remaining space exactly */}
      <div
        className={cn("flex flex-col h-full w-full overflow-hidden", rightClassName)}
        style={{ flex: "1 1 0", minWidth: `${minRightPx}px` }}
      >
        {right}
      </div>
    </div>
  );
}
