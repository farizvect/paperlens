"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/30 animate-in fade-in"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-[#e0ded6] bg-[#faf9f3] p-5 shadow-lg animate-in fade-in zoom-in-95">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-medium text-[#2a2a28]">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-[#6a6a66] leading-relaxed">
            {description}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm text-[#6a6a66] hover:bg-[#f5f4ed] hover:text-[#2a2a28] transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                variant === "danger"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-[#1B365D] text-white hover:bg-[#1B365D]/90"
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
