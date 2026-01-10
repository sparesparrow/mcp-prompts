#!/usr/bin/env python3
"""
parse_build_errors.py - Intelligent build error analysis + LEARNING LOOP

Usage: python3 parse_build_errors.py <build_log_file> <project_type> [build_system]
   build_log_file: File containing build output
   project_type: sparetools|mia|esp32|cliphist
   build_system: conan|gradle|cmake|platformio|make (optional, auto-detected)

Returns JSON with parsed errors, diagnosis, and recommendations

LEARNING BEHAVIOR:
   1. Before analysis: Query mcp-prompts for similar error patterns
   2. During analysis: Use learned diagnosis patterns if available
   3. After analysis: Capture novel error patterns and successful fixes
"""

import sys
import json
import re
import subprocess
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

class BuildErrorAnalyzer:
    def __init__(self, project_type: str, build_system: Optional[str] = None):
        self.project_type = project_type
        self.build_system = build_system
        self.errors = []
        self.warnings = []
        self.diagnosis = {}
        self.should_capture = False
        self.learned_patterns = {}
        
    def _query_mcp_prompts(self, query: str, category: str = None) -> Dict[str, Any]:
        """Query mcp-prompts for similar error patterns"""
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            mcp_query = os.path.join(script_dir, "mcp_query.sh")
            
            if not os.path.exists(mcp_query):
                return {"prompts": []}
            
            # Search for similar patterns
            cmd = [mcp_query, "search", query]
            if category:
                cmd.append(category)
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                return {"prompts": []}
        except Exception as e:
            # Graceful degradation
            return {"prompts": []}
    
    def _create_error_signature(self) -> str:
        """Create a signature from error patterns for matching"""
        categories = {}
        for error in self.errors:
            cat = error.get("category", "unknown")
            categories[cat] = categories.get(cat, 0) + 1
        
        # Create signature from top categories
        top_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:3]
        signature = " ".join([f"{cat}:{count}" for cat, count in top_cats])
        return signature
    
    def analyze(self, log_content: str) -> Dict[str, Any]:
        """Analyze build log and extract structured information"""
        
        # Auto-detect build system if not specified
        if not self.build_system:
            self.build_system = self._detect_build_system(log_content)
        
        # Parse errors and warnings
        self._parse_compilation_errors(log_content)
        self._parse_linking_errors(log_content)
        self._parse_dependency_errors(log_content)
        self._parse_schema_errors(log_content)
        
        # ═══════════════════════════════════════════════════════════
        # LEARNING STEP 1: QUERY EXISTING KNOWLEDGE
        # ═══════════════════════════════════════════════════════════
        
        error_signature = self._create_error_signature()
        search_query = f"{self.project_type} {self.build_system} {error_signature}"
        
        print("🔍 Checking for accumulated knowledge...", file=sys.stderr)
        
        past_patterns = self._query_mcp_prompts(search_query, "build-error")
        
        if past_patterns.get("prompts") and len(past_patterns["prompts"]) > 0:
            print(f"✓ Found {len(past_patterns['prompts'])} relevant knowledge item(s)", file=sys.stderr)
            
            # Use first matching pattern's diagnosis
            best_match = past_patterns["prompts"][0]
            prompt_id = best_match.get("id") or best_match.get("name")
            
            if prompt_id:
                # Fetch full prompt
                try:
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    mcp_query = os.path.join(script_dir, "mcp_query.sh")
                    
                    result = subprocess.run(
                        [mcp_query, "get", prompt_id],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    
                    if result.returncode == 0:
                        prompt_data = json.loads(result.stdout)
                        template = prompt_data.get("prompt", {}).get("template", {})
                        
                        if isinstance(template, str):
                            try:
                                template = json.loads(template)
                            except:
                                pass
                        
                        if isinstance(template, dict) and "diagnosis" in template:
                            self.diagnosis = template["diagnosis"]
                            self.learned_patterns = {
                                "prompt_id": prompt_id,
                                "confidence": template.get("confidence", "medium")
                            }
                            print(f"✓ Using learned diagnosis from: {prompt_id}", file=sys.stderr)
                except Exception as e:
                    pass
        
        # Generate diagnosis if not learned
        if not self.diagnosis:
            self._diagnose()
            self.should_capture = True
        else:
            # Validate learned diagnosis
            self.should_capture = True
        
        # Generate recommendations
        recommendations = self._generate_recommendations()
        
        return {
            "project_type": self.project_type,
            "build_system": self.build_system,
            "errors": self.errors,
            "warnings": self.warnings,
            "diagnosis": self.diagnosis,
            "recommendations": recommendations,
            "severity": self._assess_severity(),
            "error_signature": error_signature,
            "learned_from": self.learned_patterns.get("prompt_id") if self.learned_patterns else None
        }
    
    def _detect_build_system(self, log: str) -> str:
        """Detect build system from log content"""
        if "platformio" in log.lower() or "pio run" in log.lower():
            return "platformio"
        elif "conan install" in log.lower() or "conanfile" in log.lower():
            return "conan"
        elif "gradle" in log.lower() or "build.gradle" in log.lower():
            return "gradle"
        elif "cmake" in log.lower() or "CMakeLists" in log.lower():
            return "cmake"
        elif "make[" in log or "Makefile" in log:
            return "make"
        return "unknown"
    
    def _parse_compilation_errors(self, log: str):
        """Parse C++ compilation errors"""
        
        # GCC/Clang error pattern
        # Format: file:line:column: error: message
        error_pattern = r'([^\s:]+):(\d+):(\d+):\s+(error|fatal error):\s+(.+?)(?:\n|$)'
        
        for match in re.finditer(error_pattern, log, re.MULTILINE):
            file_path, line, column, severity, message = match.groups()
            
            error = {
                "type": "compilation",
                "file": file_path,
                "line": int(line),
                "column": int(column),
                "severity": "error",
                "message": message.strip(),
                "category": self._categorize_error(message)
            }
            self.errors.append(error)
    
    def _parse_linking_errors(self, log: str):
        """Parse linking errors"""
        
        # Undefined reference pattern
        undef_pattern = r'undefined reference to [`\']([^\'`]+)[\'`]'
        for match in re.finditer(undef_pattern, log):
            symbol = match.group(1)
            error = {
                "type": "linking",
                "severity": "error",
                "message": f"Undefined reference to '{symbol}'",
                "symbol": symbol,
                "category": "missing_symbol"
            }
            self.errors.append(error)
        
        # Multiple definition pattern
        multi_def_pattern = r'multiple definition of [`\']([^\'`]+)[\'`]'
        for match in re.finditer(multi_def_pattern, log):
            symbol = match.group(1)
            error = {
                "type": "linking",
                "severity": "error",
                "message": f"Multiple definition of '{symbol}'",
                "symbol": symbol,
                "category": "duplicate_symbol"
            }
            self.errors.append(error)
    
    def _parse_dependency_errors(self, log: str):
        """Parse dependency resolution errors"""
        
        # Conan missing package
        conan_pattern = r"ERROR.*Unable to find ['\"]([\w/]+)['\"](.*?remotes|.*?cache)"
        for match in re.finditer(conan_pattern, log):
            package = match.group(1)
            error = {
                "type": "dependency",
                "severity": "error",
                "message": f"Conan package '{package}' not found",
                "package": package,
                "category": "missing_dependency"
            }
            self.errors.append(error)
        
        # PlatformIO library not found
        pio_pattern = r"Could not find the package.*?['\"]([\w-]+)['\"](.*?requirements)"
        for match in re.finditer(pio_pattern, log):
            library = match.group(1)
            error = {
                "type": "dependency",
                "severity": "error",
                "message": f"PlatformIO library '{library}' not found",
                "library": library,
                "category": "missing_library"
            }
            self.errors.append(error)
    
    def _parse_schema_errors(self, log: str):
        """Parse FlatBuffers and other schema errors"""
        
        # FlatBuffers version mismatch
        fb_version_pattern = r'"(FLATBUFFERS_VERSION_\w+)" redefined'
        if re.search(fb_version_pattern, log):
            error = {
                "type": "schema",
                "severity": "warning",
                "message": "FlatBuffers version macros redefined",
                "category": "flatbuffers_version_mismatch"
            }
            self.warnings.append(error)
        
        # FlatBuffers missing type
        fb_missing_pattern = r"error:\s+['\"](\w+)['\"] is not a member of ['\"]([\w:]+)['\"]"
        for match in re.finditer(fb_missing_pattern, log):
            missing_type, namespace = match.groups()
            error = {
                "type": "schema",
                "severity": "error",
                "message": f"Type '{missing_type}' not found in '{namespace}'",
                "missing_type": missing_type,
                "namespace": namespace,
                "category": "flatbuffers_type_missing"
            }
            self.errors.append(error)
        
        # FlatBuffers missing method
        fb_method_pattern = r"has no member named ['\"]([\w_]+)['\"]"
        for match in re.finditer(fb_method_pattern, log):
            method = match.group(1)
            if "flatbuffers" in log[max(0, match.start()-200):match.start()].lower():
                error = {
                    "type": "schema",
                    "severity": "error",
                    "message": f"FlatBuffers method '{method}' not found",
                    "method": method,
                    "category": "flatbuffers_method_missing"
                }
                self.errors.append(error)
    
    def _categorize_error(self, message: str) -> str:
        """Categorize error based on message content"""
        message_lower = message.lower()
        
        if "cannot find" in message_lower or "no such file" in message_lower:
            return "missing_file"
        elif "undefined" in message_lower:
            return "undefined_symbol"
        elif "expected" in message_lower or "syntax" in message_lower:
            return "syntax_error"
        elif "type" in message_lower and "mismatch" in message_lower:
            return "type_error"
        elif "template" in message_lower:
            return "template_error"
        elif "switch" in message_lower:
            return "switch_error"
        elif "cannot convert" in message_lower:
            return "conversion_error"
        else:
            return "unknown"
    
    def _diagnose(self):
        """Generate diagnosis based on error patterns"""
        
        # Count error categories
        categories = {}
        for error in self.errors:
            cat = error.get("category", "unknown")
            categories[cat] = categories.get(cat, 0) + 1
        
        # FlatBuffers schema issues
        if any(e.get("category", "").startswith("flatbuffers") for e in self.errors + self.warnings):
            self.diagnosis["flatbuffers_issue"] = {
                "detected": True,
                "confidence": 0.95,
                "description": "FlatBuffers schema mismatch detected",
                "likely_cause": "Generated code out of sync with schema definitions",
                "fix_approach": "Regenerate FlatBuffers code from schemas"
            }
        
        # Missing dependencies
        if categories.get("missing_dependency", 0) > 0 or categories.get("missing_library", 0) > 0:
            self.diagnosis["dependency_issue"] = {
                "detected": True,
                "confidence": 0.9,
                "description": "Missing dependencies detected",
                "missing_count": categories.get("missing_dependency", 0) + categories.get("missing_library", 0),
                "fix_approach": "Install missing packages"
            }
        
        # Type/symbol issues
        if categories.get("undefined_symbol", 0) > 5 or categories.get("type_error", 0) > 5:
            self.diagnosis["major_api_change"] = {
                "detected": True,
                "confidence": 0.7,
                "description": "Multiple undefined symbols suggest API changes",
                "fix_approach": "Update code to match new API or revert library versions"
            }
    
    def _generate_recommendations(self) -> List[Dict[str, Any]]:
        """Generate fix recommendations based on diagnosis"""
        recommendations = []
        
        # FlatBuffers recommendations
        if "flatbuffers_issue" in self.diagnosis:
            recommendations.append({
                "priority": "high",
                "title": "Regenerate FlatBuffers Code",
                "description": "Schema definitions don't match generated code",
                "commands": [
                    "cd <project_root>",
                    "flatc --cpp --gen-mutable --gen-object-api --scoped-enums schemas/*.fbs -o include/",
                    "# Or for your specific schema files:",
                    "flatc --cpp --gen-mutable --gen-object-api schemas/BpmRequests.fbs schemas/BpmCommon.fbs -o include/"
                ],
                "explanation": "FlatBuffers version mismatch or schema changes require regenerating C++ code"
            })
        
        # Dependency recommendations
        if "dependency_issue" in self.diagnosis:
            if self.build_system == "conan":
                recommendations.append({
                    "priority": "high",
                    "title": "Install Missing Conan Dependencies",
                    "commands": [
                        "conan install . --build=missing",
                        "# Or if specific package missing:",
                        "conan search <package_name> -r=all"
                    ],
                    "explanation": "Required Conan packages not found in cache or remotes"
                })
            elif self.build_system == "platformio":
                recommendations.append({
                    "priority": "high",
                    "title": "Update PlatformIO Libraries",
                    "commands": [
                        "pio pkg update",
                        "pio pkg install",
                        "# Check platformio.ini lib_deps section"
                    ],
                    "explanation": "Required libraries not found or need updating"
                })
        
        # Clean build recommendation
        if len(self.errors) > 10:
            recommendations.append({
                "priority": "medium",
                "title": "Try Clean Build",
                "commands": [
                    "# For PlatformIO:",
                    "pio run --target clean",
                    "# For Conan/CMake:",
                    "rm -rf build/ && mkdir build && cd build && cmake ..",
                    "# For Gradle:",
                    "./gradlew clean build"
                ],
                "explanation": "Many errors may be due to stale build artifacts"
            })
        
        return recommendations
    
    def _assess_severity(self) -> str:
        """Assess overall build failure severity"""
        error_count = len(self.errors)
        
        if error_count == 0:
            return "success"
        elif error_count < 5:
            return "minor"
        elif error_count < 20:
            return "moderate"
        else:
            return "severe"
    
    def capture_pattern(self, result: Dict[str, Any]) -> None:
        """Capture error pattern to mcp-prompts if novel"""
        if not self.should_capture:
            return
        
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            mcp_query = os.path.join(script_dir, "mcp_query.sh")
            
            if not os.path.exists(mcp_query):
                return
            
            prompt_name = f"build-error-{self.project_type}-{self.build_system}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            
            prompt_data = {
                "name": prompt_name,
                "description": f"Build error pattern for {self.project_type} using {self.build_system}",
                "template": json.dumps({
                    "project_type": self.project_type,
                    "build_system": self.build_system,
                    "error_signature": result.get("error_signature", ""),
                    "diagnosis": self.diagnosis,
                    "error_categories": {cat: sum(1 for e in self.errors if e.get("category") == cat) 
                                        for cat in set(e.get("category", "unknown") for e in self.errors)},
                    "recommendations": result.get("recommendations", []),
                    "confidence": "low",
                    "success_count": 0
                }),
                "category": "build-error",
                "tags": ["build-error", self.project_type, self.build_system, "diagnosis"],
                "metadata": {
                    "created": datetime.now().isoformat(),
                    "validation": "error_analysis",
                    "confidence": "low",
                    "error_count": len(self.errors),
                    "severity": result.get("severity", "unknown")
                }
            }
            
            cmd = [mcp_query, "create", json.dumps(prompt_data)]
            subprocess.run(cmd, capture_output=True, timeout=5)
            
            print("💡 Captured error pattern for future reference", file=sys.stderr)
        except Exception as e:
            # Silent failure - learning is optional
            pass


def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "error": "Usage: parse_build_errors.py <log_file> <project_type> [build_system]"
        }))
        sys.exit(1)
    
    log_file = sys.argv[1]
    project_type = sys.argv[2]
    build_system = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        with open(log_file, 'r') as f:
            log_content = f.read()
    except FileNotFoundError:
        # Assume it's the log content itself
        log_content = log_file
    
    analyzer = BuildErrorAnalyzer(project_type, build_system)
    result = analyzer.analyze(log_content)
    
    # Capture pattern if novel
    analyzer.capture_pattern(result)
    
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
