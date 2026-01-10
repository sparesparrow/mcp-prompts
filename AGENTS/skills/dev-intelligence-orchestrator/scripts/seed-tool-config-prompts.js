#!/usr/bin/env node
/**
 * seed-tool-config-prompts.js - Seed initial tool configuration prompts
 * 
 * Creates initial prompts for common tool configurations that the learning
 * system can validate and improve upon.
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '..', 'data', 'prompts', 'tool-config');

// Ensure directory exists
if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
}

// Seed prompts for common tool configurations
const seedPrompts = [
    {
        name: 'cppcheck-config-embedded-esp32-memory-default',
        description: 'Default cppcheck configuration for ESP32 embedded memory analysis',
        template: JSON.stringify({
            project_type: 'embedded-esp32',
            focus: 'memory',
            is_embedded: true,
            cppcheck_flags: [
                '--quiet',
                '--template={file}:{line}:{column}: {severity}: {id}: {message}',
                '--inline-suppr',
                '--suppress=missingIncludeSystem',
                '--enable=warning,performance,portability',
                '--std=c++11',
                '--platform=unix32'
            ],
            success_count: 0,
            confidence: 'low'
        }, null, 2),
        category: 'tool-config',
        tags: ['cpp', 'cppcheck', 'memory', 'embedded-esp32', 'default'],
        metadata: {
            created: new Date().toISOString(),
            validation: 'default_config',
            confidence: 'low',
            tool: 'cppcheck',
            project_type: 'embedded-esp32'
        }
    },
    {
        name: 'cppcheck-config-embedded-esp32-security-default',
        description: 'Default cppcheck configuration for ESP32 embedded security analysis',
        template: JSON.stringify({
            project_type: 'embedded-esp32',
            focus: 'security',
            is_embedded: true,
            cppcheck_flags: [
                '--quiet',
                '--template={file}:{line}:{column}: {severity}: {id}: {message}',
                '--inline-suppr',
                '--suppress=missingIncludeSystem',
                '--enable=warning,style,performance,portability',
                '--std=c++11',
                '--platform=unix32'
            ],
            success_count: 0,
            confidence: 'low'
        }, null, 2),
        category: 'tool-config',
        tags: ['cpp', 'cppcheck', 'security', 'embedded-esp32', 'default'],
        metadata: {
            created: new Date().toISOString(),
            validation: 'default_config',
            confidence: 'low',
            tool: 'cppcheck',
            project_type: 'embedded-esp32'
        }
    },
    {
        name: 'cppcheck-config-desktop-general-default',
        description: 'Default cppcheck configuration for desktop C++ general analysis',
        template: JSON.stringify({
            project_type: 'desktop',
            focus: 'general',
            is_embedded: false,
            cppcheck_flags: [
                '--quiet',
                '--template={file}:{line}:{column}: {severity}: {id}: {message}',
                '--inline-suppr',
                '--suppress=missingIncludeSystem',
                '--enable=all',
                '--std=c++17'
            ],
            success_count: 0,
            confidence: 'low'
        }, null, 2),
        category: 'tool-config',
        tags: ['cpp', 'cppcheck', 'general', 'desktop', 'default'],
        metadata: {
            created: new Date().toISOString(),
            validation: 'default_config',
            confidence: 'low',
            tool: 'cppcheck',
            project_type: 'desktop'
        }
    },
    {
        name: 'pylint-config-python-general-default',
        description: 'Default pylint configuration for Python general analysis',
        template: JSON.stringify({
            project_type: 'python',
            focus: 'general',
            pylint_opts: [
                '--output-format=json',
                '--reports=n',
                '--disable=C0103,C0114,C0115,C0116,R0913,R0914,R0915'
            ],
            success_count: 0,
            confidence: 'low'
        }, null, 2),
        category: 'tool-config',
        tags: ['python', 'pylint', 'general', 'default'],
        metadata: {
            created: new Date().toISOString(),
            validation: 'default_config',
            confidence: 'low',
            tool: 'pylint',
            project_type: 'python'
        }
    },
    {
        name: 'pylint-config-python-security-default',
        description: 'Default pylint configuration for Python security analysis',
        template: JSON.stringify({
            project_type: 'python',
            focus: 'security',
            pylint_opts: [
                '--output-format=json',
                '--reports=n',
                '--enable=E,W',
                '--disable=C,R,I'
            ],
            success_count: 0,
            confidence: 'low'
        }, null, 2),
        category: 'tool-config',
        tags: ['python', 'pylint', 'security', 'default'],
        metadata: {
            created: new Date().toISOString(),
            validation: 'default_config',
            confidence: 'low',
            tool: 'pylint',
            project_type: 'python'
        }
    },
    {
        name: 'pytest-config-python-default',
        description: 'Default pytest configuration for Python test execution',
        template: JSON.stringify({
            framework: 'pytest',
            project_type: 'python',
            test_opts: [
                '-v',
                '--tb=short'
            ],
            coverage: false,
            success_count: 0,
            confidence: 'low'
        }, null, 2),
        category: 'tool-config',
        tags: ['test', 'pytest', 'python', 'default'],
        metadata: {
            created: new Date().toISOString(),
            validation: 'default_config',
            confidence: 'low',
            framework: 'pytest',
            project_type: 'python'
        }
    }
];

// Write each prompt to a JSON file
seedPrompts.forEach(prompt => {
    const filename = `${prompt.name}.json`;
    const filepath = path.join(PROMPTS_DIR, filename);
    
    // Convert template string to object if needed
    let template = prompt.template;
    if (typeof template === 'string') {
        try {
            template = JSON.parse(template);
        } catch (e) {
            // Keep as string if not valid JSON
        }
    }
    
    const promptData = {
        id: prompt.name,
        name: prompt.name,
        description: prompt.description,
        template: template,
        category: prompt.category,
        tags: prompt.tags,
        version: 'latest',
        createdAt: prompt.metadata.created,
        updatedAt: prompt.metadata.created,
        isLatest: true,
        metadata: prompt.metadata,
        accessLevel: 'public'
    };
    
    fs.writeFileSync(filepath, JSON.stringify(promptData, null, 2));
    console.log(`✓ Created seed prompt: ${filename}`);
});

console.log(`\n✓ Seeded ${seedPrompts.length} tool configuration prompts`);
console.log(`  Location: ${PROMPTS_DIR}`);
