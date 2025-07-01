#!/bin/bash
set -eu

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

show_help() {
  echo "Použití: $0 [--version <verze>] [--inspector-port <port>] [--mcp-port <port>] [--no-cleanup] [--verbose] [--help]"
  echo ""
  echo "Testuje zvolenou verzi @sparesparrow/mcp-prompts přes npx a inspektor."
  echo ""
  echo "  --version <verze>        Verze MCP Prompts (např. latest, 3.0.4, ...). Výchozí: latest"
  echo "  --inspector-port <port>  Port inspektoru (výchozí: 4000)"
  echo "  --mcp-port <port>        Port MCP Prompts (výchozí: 3000)"
  echo "  --no-cleanup             Neprovádět úklid po skončení (pro debug)"
  echo "  --verbose                Zobrazit podrobné výstupy"
  echo "  --help                   Zobrazí tuto nápovědu"
  echo ""
  echo "Příklad:"
  echo "  $0 --version 3.0.4 --verbose"
}

VERSION="latest"
INSPECTOR_PORT=4000
MCP_PORT=3000
SERVER_PID=""
INSPECTOR_PID=""
NO_CLEANUP=0
VERBOSE=0

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
    --mcp-port)
      MCP_PORT="$2"
      shift 2
      ;;
    --no-cleanup)
      NO_CLEANUP=1
      shift
      ;;
    --verbose)
      VERBOSE=1
      shift
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Neznámý argument: $1${NC}"
      show_help
      exit 1
      ;;
  esac
done

if [ "$VERBOSE" -eq 1 ]; then
  set -x
fi

cleanup() {
  if [ "$NO_CLEANUP" -eq 1 ]; then
    echo -e "${YELLOW}Přeskakuji úklid (--no-cleanup)...${NC}"
    return
  fi
  echo "Uklízím..."
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$INSPECTOR_PID" ]; then
    kill "$INSPECTOR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo -e "${YELLOW}Spouštím MCP Prompts verze $VERSION na portu $MCP_PORT přes npx...${NC}"
npx -y @sparesparrow/mcp-prompts@$VERSION -- --port "$MCP_PORT" &
SERVER_PID=$!

# Robust health check with retries
MAX_RETRIES=10
RETRY_DELAY=2
SUCCESS=0
echo "Čekám na spuštění služby na /health..."
for i in $(seq 1 $MAX_RETRIES); do
  if curl -fs http://localhost:$MCP_PORT/health > /dev/null; then
    SUCCESS=1
    break
  else
    echo "Pokus $i/$MAX_RETRIES: Služba není připravena, čekám $RETRY_DELAY s..."
    sleep $RETRY_DELAY
  fi
done
if [ $SUCCESS -ne 1 ]; then
  echo -e "${RED}Chyba: Služba na /health není dostupná ani po $MAX_RETRIES pokusech.${NC}"
  if [ -f inspector.log ]; then
    echo -e "${YELLOW}--- Inspector log ---${NC}"
    cat inspector.log
  fi
  exit 1
fi

echo -e "${YELLOW}Spouštím MCP Inspector na portu $INSPECTOR_PORT...${NC}"
npx -y @modelcontextprotocol/inspector http://localhost:$MCP_PORT --port "$INSPECTOR_PORT" > inspector.log 2>&1 &
INSPECTOR_PID=$!
sleep 5

# Test /health endpoint
echo -e "${YELLOW}Testuji endpoint /health přes inspektor...${NC}"
curl -f http://localhost:$MCP_PORT/health

if grep "/health" inspector.log; then
  echo -e "${GREEN}Inspektor OK (health)${NC}"
else
  echo -e "${RED}Inspektor nezachytil požadavek na /health!${NC}"
  cat inspector.log
  exit 1
fi

# Test /rpc getCapabilities
echo -e "${YELLOW}Testuji endpoint /rpc (getCapabilities)...${NC}"
RPC_RES=$(curl -fs -X POST http://localhost:$MCP_PORT/rpc -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getCapabilities","params":{}}')
echo "$RPC_RES" | grep '"result"' && echo -e "${GREEN}/rpc getCapabilities OK${NC}" || { echo -e "${RED}/rpc getCapabilities selhal!${NC}"; cat inspector.log; exit 1; }

# Print inspector log on failure
if ! grep "/rpc" inspector.log; then
  echo -e "${RED}Inspektor nezachytil požadavek na /rpc!${NC}"
  cat inspector.log
  exit 1
fi

echo -e "${GREEN}Všechny testy prošly úspěšně!${NC}" 