#!/bin/bash
# detect_project_type.sh - Detect project type and language from directory
#
# Usage: detect_project_type.sh [directory]
#
# Returns JSON with project type, languages, and framework info

set -euo pipefail

DIR="${1:-.}"
cd "$DIR"

# Detect primary language
detect_languages() {
    local langs=()
    
    # Check for C++
    if find . -name "*.cpp" -o -name "*.hpp" -o -name "*.h" 2>/dev/null | head -1 | grep -q .; then
        langs+=("cpp")
    fi
    
    # Check for Python
    if find . -name "*.py" 2>/dev/null | head -1 | grep -q .; then
        langs+=("python")
    fi
    
    # Check for Kotlin
    if find . -name "*.kt" 2>/dev/null | head -1 | grep -q .; then
        langs+=("kotlin")
    fi
    
    # Check for Java
    if find . -name "*.java" 2>/dev/null | head -1 | grep -q .; then
        langs+=("java")
    fi
    
    echo "${langs[@]}"
}

# Detect frameworks and build systems
detect_frameworks() {
    local frameworks=()
    
    [ -f "platformio.ini" ] && frameworks+=("platformio")
    [ -f "CMakeLists.txt" ] && frameworks+=("cmake")
    [ -f "conanfile.py" ] || [ -f "conanfile.txt" ] && frameworks+=("conan")
    [ -f "build.gradle" ] || [ -f "build.gradle.kts" ] && frameworks+=("gradle")
    [ -f "setup.py" ] || [ -f "pyproject.toml" ] && frameworks+=("setuptools")
    [ -f "Makefile" ] && frameworks+=("make")
    
    echo "${frameworks[@]}"
}

# Detect test frameworks
detect_test_frameworks() {
    local tests=()
    
    if find . -name "test_*.py" -o -name "*_test.py" 2>/dev/null | head -1 | grep -q .; then
        tests+=("pytest")
    fi
    
    if find . -name "*_test.cpp" -o -name "*Test.cpp" 2>/dev/null | head -1 | grep -q .; then
        tests+=("gtest")
    fi
    
    if [ -f "build.gradle" ] && grep -q "testImplementation" build.gradle 2>/dev/null; then
        tests+=("junit")
    fi
    
    echo "${tests[@]}"
}

# Detect project nature
detect_project_nature() {
    local nature="general"
    
    if [ -f "platformio.ini" ] && grep -q "esp32" platformio.ini; then
        nature="embedded-esp32"
    elif [ -f "platformio.ini" ]; then
        nature="embedded"
    elif [ -f "AndroidManifest.xml" ] || grep -q "com.android" build.gradle 2>/dev/null; then
        nature="android"
    elif [ -d ".raspberry_pi" ] || grep -q "raspberry\|raspi\|RPi" README.md 2>/dev/null; then
        nature="raspberry-pi"
    fi
    
    echo "$nature"
}

# Detect if FlatBuffers is used
detect_flatbuffers() {
    if find . -name "*.fbs" 2>/dev/null | head -1 | grep -q .; then
        echo "true"
    elif grep -r "flatbuffers" . 2>/dev/null | head -1 | grep -q .; then
        echo "true"
    else
        echo "false"
    fi
}

# Build result
LANGUAGES=($(detect_languages))
FRAMEWORKS=($(detect_frameworks))
TEST_FRAMEWORKS=($(detect_test_frameworks))
PROJECT_NATURE=$(detect_project_nature)
HAS_FLATBUFFERS=$(detect_flatbuffers)

# Convert arrays to JSON arrays
langs_json=$(printf '%s\n' "${LANGUAGES[@]}" | jq -R . | jq -s .)
frameworks_json=$(printf '%s\n' "${FRAMEWORKS[@]}" | jq -R . | jq -s .)
tests_json=$(printf '%s\n' "${TEST_FRAMEWORKS[@]}" | jq -R . | jq -s .)

# Output JSON
cat <<EOF
{
  "directory": "$DIR",
  "languages": $langs_json,
  "primary_language": "${LANGUAGES[0]:-unknown}",
  "frameworks": $frameworks_json,
  "test_frameworks": $tests_json,
  "project_nature": "$PROJECT_NATURE",
  "has_flatbuffers": $HAS_FLATBUFFERS
}
EOF
