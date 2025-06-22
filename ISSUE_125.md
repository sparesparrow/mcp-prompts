# 🚨 Critical Issues: Docker Build Failure and NPX Runtime Error

## 📋 Issue Summary

Two critical issues have been identified that prevent users from running the MCP Prompts server:

1. **Docker Build Issue**: TypeScript files not compiled in Docker images
2. **NPX Runtime Error**: Server crashes with `server.resource is not a function`

## 🔍 Issue #1: Docker Build Problem

### Problem Description
The Docker images for MCP Prompts are not working properly due to a build issue where TypeScript files are not being compiled to JavaScript before being included in the image.

### Error Details
```
TypeError: Unknown file extension ".ts" for /app/src/index.ts
    at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:189:9)
    at defaultGetFormat (node:internal/modules/esm/get_format:232:36)
    at defaultLoad (node:internal/modules/esm/load:145:22)
    at async ModuleJob._link (node:internal/modules/esm/module_job:110:19) {
  code: 'ERR_UNKNOWN_FILE_EXTENSION'
}
```

### Root Cause
- Build process is not properly compiling TypeScript files to JavaScript
- Docker images contain source `.ts` files instead of compiled `.js` files
- Node.js runtime cannot execute TypeScript files directly

## 🔍 Issue #2: NPX Runtime Error

### Problem Description
Even the recommended NPX method is failing with a runtime error, making the server unusable for all users.

### Error Details
```
Starting MCP Prompts Server v1.2.38
Config: {"name":"mcp-prompts","version":"1.2.38",...}
Memory storage connected
Adding default prompts...
Added 2 default prompts
Error starting server: TypeError: server.resource is not a function
    at main (file:///C:/Users/tomas/Desktop/mcp-prompts/node_modules/@sparesparrow/mcp-prompts/dist/index.js:153:16)
```

### Root Cause
- MCP SDK version compatibility issue
- `server.resource` method doesn't exist in the current SDK version
- This affects the core MCP server functionality

## 🛠️ Immediate Solutions Implemented

### Documentation Updates (PR: #fix/docker-documentation)
- ✅ Updated README.md with cross-platform Docker commands
- ✅ Added Windows PowerShell and Command Prompt examples
- ✅ Added comprehensive troubleshooting section
- ✅ Added warning about current Docker limitations
- ✅ Provided "build from source" alternative

## 🚨 Required Fixes (High Priority)

### 1. Fix NPX Runtime Error (CRITICAL)
- **Priority**: URGENT - This affects ALL users
- **Action**: Update MCP SDK version or fix method calls
- **Location**: `src/index.ts` line 153
- **Impact**: Server completely unusable

### 2. Fix Docker Build Process (HIGH)
- **Priority**: HIGH - Docker deployment broken
- **Action**: Fix TypeScript compilation in Dockerfile
- **Location**: Docker build pipeline
- **Impact**: Docker deployment unusable

### 3. Update Dependencies (MEDIUM)
- **Priority**: MEDIUM - Prevent future issues
- **Action**: Review and update all dependencies
- **Location**: `package.json`
- **Impact**: Long-term stability

## 📋 Testing Checklist

### NPX Method
- [ ] Server starts without `server.resource` error
- [ ] Health endpoint responds correctly
- [ ] All storage adapters work
- [ ] MCP protocol functions properly

### Docker Method
- [ ] Docker image builds successfully
- [ ] Container starts without TypeScript errors
- [ ] Health endpoint responds correctly
- [ ] All storage adapters work in Docker

## 🔗 Related Links

- **Pull Request**: [fix/docker-documentation](https://github.com/sparesparrow/mcp-prompts/pull/new/fix/docker-documentation)
- **Docker Hub**: [sparesparrow/mcp-prompts](https://hub.docker.com/r/sparesparrow/mcp-prompts)
- **NPM Package**: [@sparesparrow/mcp-prompts](https://www.npmjs.com/package/@sparesparrow/mcp-prompts)

## 📝 Technical Details

### Affected Files
- `src/index.ts` - MCP server initialization
- `Dockerfile` - Docker build process
- `package.json` - Dependencies
- `README.md` - Documentation (already fixed)

### Environment
- **OS**: Windows 10/11, Linux, macOS
- **Node.js**: 20+
- **Docker**: All versions
- **NPX**: All versions

## 🎯 Impact Assessment

### User Impact
- **Severity**: CRITICAL - No working deployment method
- **Scope**: ALL users affected
- **Workaround**: None currently available

### Business Impact
- **Reputation**: Negative impact on project credibility
- **Adoption**: Prevents new users from trying the project
- **Support**: Increased support requests

## 📅 Timeline

### Immediate (This Week)
1. Fix NPX runtime error
2. Test and verify NPX method works
3. Update documentation

### Short Term (Next Week)
1. Fix Docker build process
2. Test Docker deployment
3. Update CI/CD pipeline

### Medium Term (Next Month)
1. Add comprehensive testing
2. Improve error handling
3. Add monitoring and logging

---

**Issue Number**: #125  
**Labels**: `bug`, `critical`, `docker`, `npx`, `high-priority`, `blocker`  
**Assignees**: @sparesparrow  
**Milestone**: v1.9.0  
**Priority**: Critical 