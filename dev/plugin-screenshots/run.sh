#!/usr/bin/env bash
# =============================================================================
# Screenshots der Plugins mit erfundenen Daten erzeugen
#
# Startet eine eigene Redmine-Instanz (Port 3091, eigene Volumes) mit Theme
# Klar und den Plugins aus den Nachbarordnern, spielt dev/seed.rb und
# setup.rb ein, macht die Screenshots (shoot.mjs) und räumt die Instanz
# danach wieder ab. Die lokale Testinstanz (Port 3080) bleibt unberührt.
#
# Aufruf: npm run screenshots:plugins
#         dev/plugin-screenshots/run.sh team-planning   (nur Team Planning,
#         Screenshots und Video nach redmine-team-planning/docs/screenshots)
# =============================================================================

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
compose=(docker compose -p redmine-plugin-screenshots -f "$here/compose.yaml")

cleanup() {
  "${compose[@]}" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${compose[@]}" up -d >/dev/null

echo "Warte auf Redmine …"
for _ in $(seq 1 90); do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3091/login)" == "200" ]] && break
  sleep 2
done

"${compose[@]}" exec -T redmine bin/rails runner dev/seed.rb >/dev/null 2>&1
"${compose[@]}" exec -T redmine bin/rails runner dev/plugin-screenshots/setup.rb 2>&1 | grep -E '^Fertig' || true

if [[ "${1:-}" != "team-planning" ]]; then
  node "$here/../check-header-logo.mjs" http://localhost:3091 nordlicht
  node "$here/shoot.mjs"
fi

# Team Planning zuletzt: setzt eigene Meine-Seite-Blöcke, das Video ändert Daten
"${compose[@]}" exec -T redmine bin/rails runner dev/plugin-screenshots/setup-team-planning.rb 2>&1 | grep -E '^Fertig' || true
node "$here/shoot-team-planning.mjs"
