"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";

interface SourceCardProps {
  docName: string;
  chunkIndex?: number;
  text: string;
  page?: number;
  section?: string;
  onClick?: () => void;
  className?: string;
  /** When true, render as a mobile bottom sheet instead of inline card */
  isBottomSheet?: boolean;
  /** Callback to dismiss the bottom sheet */
  onDismiss?: () => void;
}

export function SourceCard({ docName, text, page, section, onClick, className, isBottomSheet, onDismiss }: SourceCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = text.length > 200;

  const content = (
    <>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-[#1B365D]" />
          <span className="text-xs font-medium leading-tight text-[#1B365D]">
            {docName}
          </span>
          {page && (
            <span className="text-xs text-[#8a8a82]">
              · p.{page}
            </span>
          )}
          {section && (
            <span className="text-xs text-[#8a8a82] truncate max-w-[200px]">
              · {section}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          className="overflow-hidden transition-all duration-250 ease-out"
          style={{ maxHeight: expanded ? '600px' : isLong ? '80px' : 'none' }}
        >
          <p className="text-sm leading-relaxed text-[#4a4a46]">{expanded || !isLong ? text : text.slice(0, 200) + "…"}</p>
        </div>
        {isLong && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 gap-1 px-2 text-xs text-[#1B365D] hover:bg-[#1B365D]/10"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show more <ChevronDown className="h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </>
  );

  // Mobile bottom sheet mode
  if (isBottomSheet) {
    return (
      <div className="fixed inset-0 z-50 md:hidden" onClick={onDismiss}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/20 animate-backdrop-in" />
        {/* Sheet */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#faf9f3] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] animate-bottom-sheet-in max-h-[60vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-[#e0ded6]" />
          </div>
          <Card
            className={cn(
              "border-l-2 border-l-[#1B365D] bg-[#faf9f3] shadow-none border-0 rounded-none cursor-pointer",
              className
            )}
            onClick={onClick}
          >
            {content}
          </Card>
        </div>
      </div>
    );
  }

  // Desktop inline mode
  return (
    <Card
      className={cn(
        "border-l-2 border-l-[#1B365D] bg-[#faf9f3] shadow-[0_0_0_1px_rgba(0,0,0,0.05)] cursor-pointer transition-all duration-200 hover:bg-[#f0efe8]",
        className
      )}
      onClick={onClick}
    >
      {content}
    </Card>
  );
}
