#!/usr/bin/env bash
# Frees TCP 3000–3005 for Next.js. Fails with exit 1 if any port is still in use
# after kill attempts (e.g. sandbox blocks SIGKILL — use Terminal.app outside Cursor).
set -u
PORTS=(3000 3001 3002 3003 3004 3005)

for round in 1 2 3; do
  any=""
  for port in "${PORTS[@]}"; do
    pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "${pids:-}" ]; then
      any=1
      echo "[kill-ports] round $round port $port: kill -9 $pids"
      for pid in $pids; do
        if ! kill -9 "$pid" 2>/dev/null; then
          echo "[kill-ports] WARNING: kill -9 $pid failed (permission / sandbox)" >&2
        fi
      done
    fi
  done
  [ -z "$any" ] && break
  sleep 0.7
done

sleep 0.5
still=""
for port in "${PORTS[@]}"; do
  if lsof -nP -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[kill-ports] ERROR: port $port is still in use." >&2
    still=1
  fi
done

if [ -n "$still" ]; then
  echo "[kill-ports] Quit other Next/node servers (e.g. run this script from macOS Terminal if Cursor blocks kill), then retry." >&2
  exit 1
fi

echo "[kill-ports] Ports 3000–3005 are free."
