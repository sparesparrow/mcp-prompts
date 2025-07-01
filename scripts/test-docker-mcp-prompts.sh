#!/bin/bash
set -e

show_help() {
  echo "Použití: $0 [--tag <docker_tag>] [--inspector-port <port>] [--help]"
  echo ""
  echo "Testuje zvolený Docker image MCP Prompts a inspektor."
  echo ""
  echo "  --tag <docker_tag>       Docker tag MCP Prompts (např. latest, 3.0.4, ...). Výchozí: latest"
  echo "  --inspector-port <port>  Port inspektoru (výchozí: 4000)"
  echo "  --help                   Zobrazí tuto nápovědu"
  echo ""
  echo "Příklad:"
  echo "  $0 --tag 3.0.4"
}

TAG="latest"
INSPECTOR_PORT=4000

while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)
      TAG="$2"
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

echo "Spouštím MCP Prompts Docker image s tagem $TAG..."
docker run --rm -d -p 3000:3000 --name mcp-prompts-test sparesparrow/mcp-prompts:$TAG
sleep 5

echo "Spouštím MCP Inspector na portu $INSPECTOR_PORT..."
npx -y @modelcontextprotocol/inspector http://localhost:3000 --port $INSPECTOR_PORT > inspector.log 2>&1 &
INSPECTOR_PID=$!
sleep 5

echo "Testuji endpoint /health přes inspektor..."
curl -f http://localhost:3000/health

echo "Kontroluji, že inspektor zachytil komunikaci..."
grep "/health" inspector.log && echo "Inspektor OK" || echo "Inspektor nezachytil požadavek!"

echo "Uklízím..."
docker stop mcp-prompts-test
kill $INSPECTOR_PID 