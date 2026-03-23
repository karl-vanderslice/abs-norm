#!/usr/bin/env bash
set -euo pipefail

PORT="${SMOKE_PORT:-18042}"
BASE_URL="http://127.0.0.1:${PORT}"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

PORT="$PORT" PUBLIC_BASE_URL="$BASE_URL" node src/server.js >/tmp/abs-norm-smoke.log 2>&1 &
server_pid=$!

for _ in $(seq 1 40); do
  if curl -fsS "$BASE_URL/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

curl -fsS "$BASE_URL/healthz" | jq -e '.ok == true' >/dev/null

search_json="$(curl -fsS "$BASE_URL/search?mediaType=podcast&query=norm%20macdonald%20live")"
printf '%s' "$search_json" | jq -e '.matches | length == 1' >/dev/null
printf '%s' "$search_json" | jq -e '.matches[0].title == "Norm Macdonald Live"' >/dev/null
printf '%s' "$search_json" | jq -e '.matches[0].episodes | length == 39' >/dev/null

podcast_json="$(curl -fsS "$BASE_URL/podcast/norm-macdonald-live")"
printf '%s' "$podcast_json" | jq -e '.episodes | length == 39' >/dev/null
printf '%s' "$podcast_json" | jq -e '.episodes[0].title == "Bob Einstein (Super Dave Osborne)"' >/dev/null
printf '%s' "$podcast_json" | jq -e '.episodes[38].title == "Jim Carrey"' >/dev/null
printf '%s' "$podcast_json" | jq -e '([.episodes[].guid] | unique | length) == 39' >/dev/null
printf '%s' "$podcast_json" | jq -e 'all(.episodes[]; has("thumbnail") and has("mediaUrl") and has("releaseDate"))' >/dev/null

rss_xml="$(curl -fsS "$BASE_URL/rss/norm-macdonald-live.xml")"
item_count="$(printf '%s' "$rss_xml" | grep -o '<item>' | wc -l | tr -d ' ')"
if [[ "$item_count" != "39" ]]; then
  echo "Expected 39 RSS items, found $item_count" >&2
  exit 1
fi

printf '%s' "$rss_xml" | grep -q '<itunes:type>episodic</itunes:type>'
printf '%s' "$rss_xml" | grep -q '<title>Norm Macdonald Live</title>'

echo "Smoke test passed"
