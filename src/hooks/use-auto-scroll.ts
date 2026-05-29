"use client";

import * as React from "react";

/**
 * Manages auto-scroll behavior for a chat message list.
 * Scrolls to bottom when new messages arrive only if the user is already near the bottom.
 */
export function useAutoScroll(messages: unknown[]) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const isNearBottomRef = React.useRef(true);

  // Track if user is near bottom
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 150; // px from bottom
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < threshold;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on new messages only if user is near bottom
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && messages.length > 0 && isNearBottomRef.current) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages]);

  return { scrollContainerRef, messagesEndRef, isNearBottomRef };
}
