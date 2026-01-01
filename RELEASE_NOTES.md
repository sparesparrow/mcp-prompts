# Release Notes - v3.12.6

## 🎉 New Release

**Date**: January 1, 2026  
**Version**: 3.12.6  
**Tag**: `v3.12.6`

## 📦 Published Platforms

- ✅ **npm**: `@sparesparrow/mcp-prompts@3.12.6`
- ✅ **GitHub Packages**: `@sparesparrow/mcp-prompts@3.12.6`
- ✅ **Cloudsmith**: `mcp-prompts@3.12.6`
- ✅ **Docker**: `ghcr.io/sparesparrow/mcp-prompts:3.12.6`

## 🆕 What's New

### ESP32 Embedded Development Prompts
Added 6 atomic prompts for ESP32 development workflows:
- `esp32-network-ap-mode-configuration` - WiFi AP mode setup
- `esp32-platformio-serial-upload-debugging` - Build/upload troubleshooting
- `esp32-flatbuffers-schema-sync-workflow` - Schema regeneration
- `esp32-mcp-server-http-api-integration` - HTTP API setup
- `mcp-server-file-storage-index-sync` - Index synchronization
- `embedded-audio-fft-memory-constraints` - Memory optimization

### Meta-Workflow
- `embedded-esp32-full-bringup-workflow` - Complete ESP32 setup workflow combining all atomic prompts

### Self-Improving Learning Loop
- Validation script: `scripts/validate_learned_knowledge.sh`
- Index regeneration: `scripts/regenerate_index.py`
- Knowledge reusability map: `docs/knowledge-reusability-map.md`
- Implementation summary: `docs/self-improving-loop-implementation-summary.md`

### Publishing Infrastructure
- GitHub Packages publishing workflow
- Cloudsmith upload support
- Docker image publishing
- Comprehensive release workflow

## 📋 Installation

### npm
```bash
npm install @sparesparrow/mcp-prompts@3.12.6
```

### GitHub Packages
```bash
npm install @sparesparrow/mcp-prompts@3.12.6 --registry https://npm.pkg.github.com
```

### Docker
```bash
docker pull ghcr.io/sparesparrow/mcp-prompts:3.12.6
```

### Cloudsmith
```bash
cloudsmith download raw sparesparrow-conan/sparetools \
  --name "mcp-prompts" \
  --version "3.12.6"
```

## 🔗 Links

- **GitHub Release**: https://github.com/sparesparrow/mcp-prompts/releases/tag/v3.12.6
- **npm Package**: https://www.npmjs.com/package/@sparesparrow/mcp-prompts
- **GitHub Packages**: https://github.com/sparesparrow/mcp-prompts/packages
- **Cloudsmith**: https://cloudsmith.io/~sparesparrow-conan/repos/sparetools/packages/

## 📊 Statistics

- **Total Prompts**: 46
- **New Prompts**: 7 (6 atomic + 1 meta-workflow)
- **Categories**: ESP32, Embedded, MCP Development
- **Documentation**: 4 new documentation files

## 🚀 Next Steps

1. Monitor GitHub Actions workflows for publication status
2. Verify packages are available on all platforms
3. Test installation from each platform
4. Update dependent projects to use new version