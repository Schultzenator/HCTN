#!/usr/bin/env bash
# Simulated "Alexa+ turn" against the self-hosted MCP server (Streamable HTTP).
# Prereq: npm run build && npm start  (or: node dist/src/server.js)
set -euo pipefail
PORT="${PORT:-3001}"
MCP="http://127.0.0.1:${PORT}/mcp"
J='content-type: application/json'
A='accept: application/json, text/event-stream'

echo "== Alexa+ connects (initialize handshake) =="
curl -sS -X POST "$MCP" -H "$J" -H "$A" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"alexa-plus-sim","version":"1.0.0"}}}' | head -c 400; echo
curl -sS -o /dev/null -w "initialized -> HTTP %{http_code}
" -X POST "$MCP" -H "$J" -H "$A" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

echo "== 'Alexa, what's the plan for today?' -> tools/list =="
curl -sS -X POST "$MCP" -H "$J" -H "$A" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | head -c 700; echo

echo "== Morning briefing: household_summary =="
curl -sS -X POST "$MCP" -H "$J" -H "$A" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"household_summary","arguments":{}}}' | head -c 700; echo

echo "== 'Add two oat milk' + 'plan a movie under 100 minutes' =="
curl -sS -X POST "$MCP" -H "$J" -H "$A" -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"add_grocery_item","arguments":{"item":"oat milk","quantity":2}}}' | head -c 300; echo
curl -sS -X POST "$MCP" -H "$J" -H "$A" -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"plan_movie_night","arguments":{"max_minutes":100}}}' | head -c 500; echo

echo "== Fair week: assign_chores (deterministic rotation) =="
curl -sS -X POST "$MCP" -H "$J" -H "$A" -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"assign_chores","arguments":{"week_start":"2026-10-19"}}}' | head -c 500; echo

echo "== GET /mcp -> 405 (spec-correct for stateless mode) =="
curl -sS -o /dev/null -w "GET -> HTTP %{http_code}
" "$MCP"
