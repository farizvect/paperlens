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
  const [ratio, setRatio] = React.useState(() => {
    if (typeof window === "undefined") return defaultRatio;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return Math.max(0, Math.min(1, parseFloat(saved)));
    } catch {}
    return defaultRatio;
  });
  const dragging = React.useRef(false);

  // Persist ratio
  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(ratio));
    } catch {}
  }, [ratio, storageKey]);

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clamped = Math.max(minLeftPx / rect.width, Math.min(1 - minRightPx / rect.width, x / rect.width));
      setRatio(clamped);
    },
    [minLeftPx, minRightPx]
  );

  const onPointerUp = React.useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-row h-full min-w-0 select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Left pane */}
      <div
        className={cn("flex flex-col h-full overflow-hidden", leftClassName)}
        style={{ width: `${ratio * 100}%` }}
      >
        {left}
      </div>

      {/* Gutter / drag handle */}
      <div
        className={cn(
          "relative shrink-0 w-[5px] cursor-col-resize hover:w-[7px] active:w-[7px] transition-[width] duration-75 group",
          "bg-[#e0ded6] hover:bg-[#1B365D]/20 active:bg-[#1B365D]/30",
          gutterClassName
        )}
        onPointerDown={onPointerDown}
        style={{ touchAction: "none" }}
      >
        {/* Visual grip dots */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] flex flex-col items-center justify-center gap-[2px] opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
          <div className="w-[2px] h-[2px] rounded-full bg-[#1B365D]/40" />
          <div className="w-[2px] h-[2px] rounded-full bg-[#1B365D]/40" />
          <div className="w-[2px] h-[2px] rounded-full bg-[#1B365D]/40" />
        </div>
      </div>

      {/* Right pane */}
      <div
        className={cn("flex flex-col h-full overflow-hidden", rightClassName)}
        style={{ width: `${(1 - ratio) * 100}%` }}
      >
        {right}
      </div>
    </div>
  );
}
