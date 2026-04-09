import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function usePolling(intervalMs: number = 30_000) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [router, intervalMs]);
}
