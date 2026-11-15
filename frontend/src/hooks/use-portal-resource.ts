import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { useAppSelector } from "@/hooks/use-app-selector";

export function usePortalResource<T extends z.ZodType>(
  path: string,
  schema: T,
) {
  const token = useAppSelector((s) => s.auth.token);
  const [data, setData] = useState<z.infer<T> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    // Defer pending state so request lifecycle remains effect-driven, not render-driven.
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setData(null);
        setError("");
      }
    });
    apiRequest(path, schema, {
      token: token ?? undefined,
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(err instanceof Error ? err.message : "Data gagal dimuat.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [path, schema, token, revision]);
  return { data, error, loading, reload };
}
