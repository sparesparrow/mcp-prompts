# Knowledge Reusability Map

**Last Updated**: 2026-01-01  
**Total Validated Prompts**: 6  
**Cross-Project Transfer Opportunities**: 4

## Cross-Project Patterns

### Networking & Connectivity

#### `esp32-network-ap-mode-configuration`
- **Applies to**: ESP32 projects only
- **Reusability**: **LOW** (ESP32-specific)
- **Transfer to**: 
  - ❌ Raspberry Pi (different WiFi API)
  - ❌ Other embedded platforms (different APIs)
  - ✅ Other ESP32 projects (high reuse within ESP32 ecosystem)
- **Key Learnings**: AP mode memory overhead (+40KB), SSID/password constraints

#### `esp32-mcp-server-http-api-integration`
- **Applies to**: ESP32 projects with HTTP APIs
- **Reusability**: **MEDIUM** (concepts transfer, implementation differs)
- **Transfer to**:
  - ✅ Raspberry Pi (Flask/FastAPI instead of AsyncWebServer)
  - ✅ Other embedded platforms (different HTTP libraries)
  - ✅ Web services (same API design patterns)
- **Key Learnings**: CORS headers, JSON response format, error handling patterns

### Build & Compilation

#### `esp32-platformio-serial-upload-debugging`
- **Applies to**: Any PlatformIO + ESP32 project
- **Reusability**: **HIGH** (directly reusable)
- **Transfer to**:
  - ✅ All ESP32 PlatformIO projects
  - ✅ ESP8266 PlatformIO projects (similar process)
  - ⚠️ Other embedded platforms (different tools, same concepts)
- **Key Learnings**: Permission issues, port conflicts, upload protocol selection

#### `esp32-flatbuffers-schema-sync-workflow`
- **Applies to**: Any FlatBuffers project
- **Reusability**: **HIGH** (language/framework agnostic)
- **Transfer to**:
  - ✅ All FlatBuffers projects (C++, Python, TypeScript, etc.)
  - ✅ Protocol buffer projects (similar concepts)
  - ✅ Code generation workflows (general pattern)
- **Key Learnings**: Schema-to-code sync, regeneration triggers, validation

### Infrastructure & Data Management

#### `mcp-server-file-storage-index-sync`
- **Applies to**: Any file-based storage with index
- **Reusability**: **HIGH** (universal pattern)
- **Transfer to**:
  - ✅ All MCP servers with file storage
  - ✅ Database index synchronization
  - ✅ Search index maintenance (Elasticsearch, etc.)
  - ✅ Package manager metadata (npm, pip, etc.)
- **Key Learnings**: Index corruption detection, regeneration strategies, prevention

### Memory & Performance

#### `embedded-audio-fft-memory-constraints`
- **Applies to**: ESP32 audio processing
- **Reusability**: **LOW** (specific to ESP32 + audio)
- **Transfer to**:
  - ⚠️ Raspberry Pi audio (different memory constraints, similar concepts)
  - ⚠️ Other embedded audio (different platforms, same principles)
  - ✅ General embedded memory optimization (principles apply)
- **Key Learnings**: Pre-allocation, float32 usage, heap monitoring, fragmentation prevention

## Reuse Opportunities by Project

### ESP32 Projects
**High Reuse** (5 prompts):
- ✅ `esp32-network-ap-mode-configuration`
- ✅ `esp32-platformio-serial-upload-debugging`
- ✅ `esp32-flatbuffers-schema-sync-workflow`
- ✅ `esp32-mcp-server-http-api-integration`
- ✅ `embedded-audio-fft-memory-constraints`

### MCP Server Projects
**High Reuse** (1 prompt):
- ✅ `mcp-server-file-storage-index-sync`

### Raspberry Pi Projects (mia)
**Medium Reuse** (3 prompts):
- ⚠️ `esp32-mcp-server-http-api-integration` (adapt HTTP library)
- ⚠️ `mcp-server-file-storage-index-sync` (direct reuse)
- ⚠️ `embedded-audio-fft-memory-constraints` (adapt memory constraints)

### General Embedded Projects
**Medium Reuse** (2 prompts):
- ⚠️ `esp32-platformio-serial-upload-debugging` (adapt toolchain)
- ⚠️ `esp32-flatbuffers-schema-sync-workflow` (direct reuse)

### Web/Backend Projects
**Medium Reuse** (1 prompt):
- ⚠️ `esp32-mcp-server-http-api-integration` (adapt framework)
- ⚠️ `mcp-server-file-storage-index-sync` (direct reuse)

## Confidence Levels

| Prompt | Confidence | Success Count | Ready for Reuse |
|--------|-----------|---------------|-----------------|
| `esp32-network-ap-mode-configuration` | low | 1 | ⚠️ Needs validation |
| `esp32-platformio-serial-upload-debugging` | medium | 1 | ✅ Ready |
| `esp32-flatbuffers-schema-sync-workflow` | high | 1 | ✅ Ready |
| `esp32-mcp-server-http-api-integration` | low | 1 | ⚠️ Needs validation |
| `mcp-server-file-storage-index-sync` | medium | 1 | ✅ Ready |
| `embedded-audio-fft-memory-constraints` | medium | 1 | ✅ Ready |

## Next Actions for Cross-Project Transfer

### Week 2: Apply to `mia` Project
1. **Test `mcp-server-file-storage-index-sync`** on mia's infrastructure
   - Expected: Direct reuse (same pattern)
   - Action: Apply index regeneration script to mia's prompt storage

2. **Adapt `esp32-mcp-server-http-api-integration`** for Raspberry Pi
   - Expected: Use FastAPI instead of AsyncWebServer
   - Action: Create `raspberry-pi-fastapi-mcp-integration` prompt

3. **Extract Raspberry Pi-specific patterns**
   - Expected: GPIO control, systemd service patterns
   - Action: Create new prompts from mia project learnings

### Week 3: Generalize High-Reuse Patterns
1. **Create generic `platformio-upload-debugging`** prompt
   - Remove ESP32-specific details
   - Add platform selection logic

2. **Create generic `file-storage-index-sync`** prompt
   - Remove MCP-specific details
   - Make framework-agnostic

## Success Metrics

- **Cross-Project Reuse**: 3+ prompts successfully applied to other projects
- **Confidence Improvement**: 2+ prompts upgraded from "low" to "medium/high"
- **New Prompts Created**: 2-3 prompts from cross-project learnings
- **Time Saved**: 30% reduction in setup time for new projects

## Knowledge Gaps Identified

### Missing Patterns
1. **Raspberry Pi Networking** - Need AP mode equivalent for RPi
2. **Docker-based MCP Servers** - Containerization patterns
3. **Multi-Device Deployment** - Deploying to multiple ESP32s simultaneously
4. **CI/CD Integration** - Automated testing and deployment

### Low Confidence Areas
- ESP32 AP mode (needs more validation)
- HTTP API integration (needs production testing)

## Related Documentation

- [ESP32 Development Guide](../esp32/README.md)
- [MCP Server Development](../mcp-development/README.md)
- [Embedded Systems Patterns](../embedded/README.md)