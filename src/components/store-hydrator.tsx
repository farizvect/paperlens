"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chat";

export function StoreHydrator() {
  const hydrate = useChatStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return null;
}
