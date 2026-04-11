import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const IDLE_MS = 60_000;

/** Exact paths where background auto-refresh is allowed (list/overview pages only). */
const POLL_PATHS = new Set([
  "/dashboard",
  "/planner",
  "/properties",
  "/suburbs",
]);

function shouldAutoRefreshPoll(pathname: string | null): boolean {
  if (!pathname) return false;
  return POLL_PATHS.has(pathname);
}

export function usePolling(intervalMs: number = 30_000) {
  const router = useRouter();
  const pathname = usePathname();
  const lastActivityRef = useRef(Date.now());
  const lastMouseMoveThrottleRef = useRef(0);

  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now();
    };

    const onMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseMoveThrottleRef.current < 250) return;
      lastMouseMoveThrottleRef.current = now;
      bump();
    };

    window.addEventListener("click", bump, true);
    window.addEventListener("keypress", bump, true);
    window.addEventListener("touchstart", bump, { capture: true, passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    return () => {
      window.removeEventListener("click", bump, true);
      window.removeEventListener("keypress", bump, true);
      window.removeEventListener("touchstart", bump, true);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!shouldAutoRefreshPoll(pathname)) return;
      if (Date.now() - lastActivityRef.current <= IDLE_MS) return;
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [router, intervalMs, pathname]);
}
