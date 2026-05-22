"use client";

import { useEffect } from "react";

export function CursorGlow() {
  useEffect(() => {
    const root = document.documentElement;
    const handler = (event: MouseEvent) => {
      root.style.setProperty("--mouse-x", `${event.clientX}px`);
      root.style.setProperty("--mouse-y", `${event.clientY}px`);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(220px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(244,210,168,0.16),transparent_70%)]" />;
}
