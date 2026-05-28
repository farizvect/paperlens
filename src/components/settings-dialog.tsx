"use client";

import * as React from "react";
import { useChatStore, type LlmSettings } from "@/store/chat";
import { Settings, Eye, EyeOff } from "lucide-react";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const llmSettings = useChatStore((s) => s.llmSettings);
  const setLlmSettings = useChatStore((s) => s.setLlmSettings);

  const [local, setLocal] = React.useState<LlmSettings>(llmSettings);
  const [showKey, setShowKey] = React.useState(false);

  React.useEffect(() => {
    if (open) setLocal(llmSettings);
  }, [open, llmSettings]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSave() {
    setLlmSettings(local);
    onClose();
  }

  function handleReset() {
    const empty: LlmSettings = { baseUrl: "", apiKey: "", model: "" };
    setLocal(empty);
    setLlmSettings(empty);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e0ded6] bg-[#faf9f3] shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-[#e0ded6] px-5 py-4">
          <Settings className="h-4 w-4 text-[#1B365D]" />
          <h2 className="text-sm font-medium text-[#1B365D]">LLM Settings</h2>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <p className="text-xs leading-relaxed text-[#8a8a82]">
            Configure the OpenAI-compatible API. Leave blank to use server defaults.
          </p>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-[#2a2a28] mb-1.5">
              API Base URL
            </label>
            <input
              type="text"
              value={local.baseUrl}
              onChange={(e) => setLocal({ ...local, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg border border-[#e0ded6] bg-[#f5f4ed] px-3 py-2 text-sm text-[#2a2a28] placeholder:text-[#b0aeA4] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/20"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-[#2a2a28] mb-1.5">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={local.apiKey}
                onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full rounded-lg border border-[#e0ded6] bg-[#f5f4ed] px-3 py-2 pr-10 text-sm text-[#2a2a28] placeholder:text-[#b0aeA4] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8a8a82] hover:text-[#2a2a28]"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-[#2a2a28] mb-1.5">
              Model
            </label>
            <input
              type="text"
              value={local.model}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
              placeholder="gpt-4o-mini"
              className="w-full rounded-lg border border-[#e0ded6] bg-[#f5f4ed] px-3 py-2 text-sm text-[#2a2a28] placeholder:text-[#b0aeA4] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/20"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e0ded6] px-5 py-3">
          <button
            onClick={handleReset}
            className="rounded-lg px-3 py-1.5 text-xs text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28] transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[#e0ded6] px-4 py-1.5 text-xs text-[#8a8a82] hover:bg-[#f5f4ed] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-[#1B365D] px-4 py-1.5 text-xs text-white hover:bg-[#1B365D]/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
