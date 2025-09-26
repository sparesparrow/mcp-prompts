#!/bin/bash

set -e

echo "🚀 MCP Prompts - Universal Deployment Script"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Display banner
echo -e "${BLUE}"
cat << "EOF"
  __  __  ____  ____   ____                 _       _   _             
 |  \/  |/ ___||  _ \ |  _ \ _ __ ___  _ __ | |_ ___| |_(_) ___  _ __  
 | |\/| | |    | |_) || |_) | '__/ _ \| '_ \| __/ __| __| |/ _ \| '_ \ 
 | |  | | |___ |  __/ |  __/| | | (_) | |_) | |_\__ \ |_| | (_) | | | |
 |_|  |_|\____||_|    |_|   |_|  \___/| .__/ \__|___/\__|_|\___/|_| |_|
                                      |_|                              
EOF
echo -e "${NC}"

echo -e "${PURPLE}📋 Available Deployment Options:${NC}"
echo ""
echo -e "${GREEN}1. File Storage (Local JSON files)${NC}"
echo -e "   Best for: Development, small deployments, offline usage"
echo -e "   Command: ${YELLOW}./scripts/deploy-file-storage.sh${NC}"
echo ""
echo -e "${GREEN}2. PostgreSQL Database${NC}"
echo -e "   Best for: Production applications, complex queries, ACID compliance"
echo -e "   Command: ${YELLOW}./scripts/deploy-postgres.sh${NC}"
echo ""
echo -e "${GREEN}3. AWS Services (DynamoDB, S3, SQS)${NC}"
echo -e "   Best for: Scalable production applications, cloud-native deployments"
echo -e "   Command: ${YELLOW}./scripts/deploy-aws-enhanced.sh${NC}"
echo ""
echo -e "${GREEN}4. Docker Containers${NC}"
echo -e "   Best for: Containerized deployments, microservices, cloud platforms"
echo -e "   Command: ${YELLOW}./scripts/deploy-docker.sh${NC}"
echo ""

# Interactive menu
if [ "$1" = "--interactive" ] || [ -z "$1" ]; then
    echo -e "${BLUE}🎯 Interactive Deployment Mode${NC}"
    echo ""
    echo "Please select your deployment target:"
    echo "1) File Storage"
    echo "2) PostgreSQL Database"
    echo "3) AWS Services"
    echo "4) Docker Containers"
    echo "5) Show deployment guide"
    echo "6) Exit"
    echo ""
    read -p "Enter your choice (1-6): " choice
    
    case $choice in
        1)
            echo -e "${GREEN}🚀 Starting File Storage deployment...${NC}"
            ./scripts/deploy-file-storage.sh
            ;;
        2)
            echo -e "${GREEN}🚀 Starting PostgreSQL deployment...${NC}"
            ./scripts/deploy-postgres.sh
            ;;
        3)
            echo -e "${GREEN}🚀 Starting AWS deployment...${NC}"
            ./scripts/deploy-aws-enhanced.sh
            ;;
        4)
            echo -e "${GREEN}🚀 Starting Docker deployment...${NC}"
            ./scripts/deploy-docker.sh
            ;;
        5)
            echo -e "${BLUE}📖 Opening deployment guide...${NC}"
            if command -v less &> /dev/null; then
                less DEPLOYMENT_GUIDE.md
            else
                cat DEPLOYMENT_GUIDE.md
            fi
            ;;
        6)
            echo -e "${YELLOW}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid choice. Please run the script again.${NC}"
            exit 1
            ;;
    esac
else
    # Direct deployment based on argument
    case $1 in
        file|file-storage)
            echo -e "${GREEN}🚀 Starting File Storage deployment...${NC}"
            ./scripts/deploy-file-storage.sh
            ;;
        postgres|postgresql)
            echo -e "${GREEN}🚀 Starting PostgreSQL deployment...${NC}"
            ./scripts/deploy-postgres.sh
            ;;
        aws)
            echo -e "${GREEN}🚀 Starting AWS deployment...${NC}"
            ./scripts/deploy-aws-enhanced.sh
            ;;
        docker)
            echo -e "${GREEN}🚀 Starting Docker deployment...${NC}"
            ./scripts/deploy-docker.sh
            ;;
        help|--help|-h)
            echo -e "${BLUE}📖 MCP Prompts Deployment Help${NC}"
            echo ""
            echo "Usage: $0 [OPTION]"
            echo ""
            echo "Options:"
            echo "  file, file-storage    Deploy with file storage"
            echo "  postgres, postgresql  Deploy with PostgreSQL database"
            echo "  aws                   Deploy to AWS services"
            echo "  docker                Deploy with Docker containers"
            echo "  --interactive         Interactive deployment mode"
            echo "  help, --help, -h      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Interactive mode"
            echo "  $0 --interactive      # Interactive mode"
            echo "  $0 file               # File storage deployment"
            echo "  $0 postgres           # PostgreSQL deployment"
            echo "  $0 aws                # AWS deployment"
            echo "  $0 docker             # Docker deployment"
            echo ""
            echo "For detailed information, see DEPLOYMENT_GUIDE.md"
            ;;
        *)
            echo -e "${RED}❌ Unknown deployment target: $1${NC}"
            echo -e "${YELLOW}💡 Use '$0 help' for available options${NC}"
            exit 1
            ;;
    esac
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📚 Next Steps:${NC}"
echo -e "1. Read the ${YELLOW}DEPLOYMENT_GUIDE.md${NC} for detailed information"
echo -e "2. Check the health of your deployment"
echo -e "3. Set up monitoring and alerting"
echo -e "4. Configure backups and disaster recovery"
echo -e "5. Set up CI/CD pipelines for automated deployments"
echo ""
echo -e "${PURPLE}🔗 Useful Commands:${NC}"
echo -e "• Health check: ${YELLOW}curl http://localhost:3000/health${NC}"
echo -e "• View logs: ${YELLOW}./scripts/docker-logs.sh <storage-type>${NC}"
echo -e "• Monitor: ${YELLOW}./scripts/monitor-<storage-type>.sh${NC}"
echo -e "• Backup: ${YELLOW}./scripts/backup-<storage-type>.sh${NC}"
echo ""
echo -e "${GREEN}✨ Happy deploying!${NC}"
