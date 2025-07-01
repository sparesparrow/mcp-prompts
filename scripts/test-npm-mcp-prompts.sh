#!/bin/bash
set -e

show_help() {
  echo "Použití: $0 [--version <verze>] [--inspector-port <port>] [--help]"
  echo ""
  echo "Testuje zvolenou verzi @sparesparrow/mcp-prompts přes npx a inspektor."
  echo ""
  echo "  --version <verze>        Verze MCP Prompts (např. latest, 3.0.4, ...). Výchozí: latest"
  echo "  --inspector-port <port>  Port inspektoru (výchozí: 4000)"
  echo "  --help                   Zobrazí tuto nápovědu"
  echo ""
  echo "Příklad:"
  echo "  $0 --version 3.0.4"
}

VERSION="latest"
INSPECTOR_PORT=4000
SERVER_PID=""
INSPECTOR_PID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --inspector-port)
      INSPECTOR_PORT="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Neznámý argument: $1"
      show_help
      exit 1
      ;;
  esac
done

cleanup() {
  echo "Uklízím..."
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$INSPECTOR_PID" ]; then
    kill "$INSPECTOR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Spouštím MCP Prompts verze $VERSION přes npx..."
npx -y @sparesparrow/mcp-prompts@$VERSION &
SERVER_PID=$!

# Robust health check with retries
MAX_RETRIES=10
RETRY_DELAY=2
SUCCESS=0
echo "Čekám na spuštění služby na /health..."
for i in $(seq 1 $MAX_RETRIES); do
  if curl -fs http://localhost:3000/health > /dev/null; then
    SUCCESS=1
    break
  else
    echo "Pokus $i/$MAX_RETRIES: Služba není připravena, čekám $RETRY_DELAY s..."
    sleep $RETRY_DELAY
  fi
done
if [ $SUCCESS -ne 1 ]; then
  echo "Chyba: Služba na /health není dostupná ani po $MAX_RETRIES pokusech."
  exit 1
fi

echo "Spouštím MCP Inspector na portu $INSPECTOR_PORT..."
npx -y @modelcontextprotocol/inspector http://localhost:3000 --port "$INSPECTOR_PORT" > inspector.log 2>&1 &
INSPECTOR_PID=$!
sleep 5

echo "Testuji endpoint /health přes inspektor..."
curl -f http://localhost:3000/health

echo "Kontroluji, že inspektor zachytil komunikaci..."
if grep "/health" inspector.log; then
  echo "Inspektor OK"
else
  echo "Inspektor nezachytil požadavek!"
  exit 1
fi 