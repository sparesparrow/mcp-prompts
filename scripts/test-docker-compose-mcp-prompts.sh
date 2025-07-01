#!/bin/bash
set -e

show_help() {
  echo "Použití: $0 [--compose-file <soubor>] [--inspector-service <jméno>] [--help]"
  echo ""
  echo "Testuje MCP Prompts a inspektor pomocí Docker Compose."
  echo ""
  echo "  --compose-file <soubor>      Cesta k docker-compose.yml (výchozí: docker-compose.yml)"
  echo "  --inspector-service <jméno>  Jméno inspektor služby (výchozí: inspector-server)"
  echo "  --help                       Zobrazí tuto nápovědu"
  echo ""
  echo "Příklad:"
  echo "  $0 --compose-file docker-compose.override.yml"
}

COMPOSE_FILE="docker-compose.yml"
INSPECTOR_SERVICE="inspector-server"

while [[ $# -gt 0 ]]; do
  case $1 in
    --compose-file)
      COMPOSE_FILE="$2"
      shift 2
      ;;
    --inspector-service)
      INSPECTOR_SERVICE="$2"
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

echo "Spouštím Docker Compose s $COMPOSE_FILE..."
docker compose -f $COMPOSE_FILE up -d
sleep 10

echo "Testuji endpoint /health přes inspektor..."
curl -f http://localhost:3000/health

echo "Kontroluji logy inspektoru..."
docker logs $INSPECTOR_SERVICE 2>&1 | grep "/health" && echo "Inspektor OK" || echo "Inspektor nezachytil požadavek!"

echo "Uklízím..."
docker compose -f $COMPOSE_FILE down 