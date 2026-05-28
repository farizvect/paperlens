"use client";

import { cn } from "@/lib/utils";

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[#e0ded6]" />
      <div className="flex-1 space-y-2.5">
        <div className="h-3.5 w-3/4 animate-pulse rounded-md bg-[#e0ded6]" />
        <div className="h-3.5 w-1/2 animate-pulse rounded-md bg-[#e8e6de]" />
        <div className="h-3.5 w-5/6 animate-pulse rounded-md bg-[#e0ded6]" />
      </div>
    </div>
  );
}
