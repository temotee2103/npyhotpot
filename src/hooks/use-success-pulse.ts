"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_TOKEN = "__default__";

export function useSuccessPulse(duration = 700) {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const trigger = useCallback(
    (token: string = DEFAULT_TOKEN) => {
      clear();
      setActiveToken(token);
      timerRef.current = window.setTimeout(() => {
        setActiveToken(null);
        timerRef.current = null;
      }, duration);
    },
    [clear, duration],
  );

  const isActive = useCallback(
    (token: string = DEFAULT_TOKEN) => activeToken === token,
    [activeToken],
  );

  useEffect(() => {
    return clear;
  }, [clear]);

  return { trigger, isActive };
}

