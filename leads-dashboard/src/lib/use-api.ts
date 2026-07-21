"use client";

import { useEffect, useState } from "react";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setData(null);
    setError(null);
    fetch(path)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: T) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setError("Failed to load");
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return { data, error };
}
