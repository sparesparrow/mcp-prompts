#!/usr/bin/env python3
"""Regenerate index.json from all prompt files"""
import json
import os
from pathlib import Path
from datetime import datetime

prompts_dir = Path(__file__).parent.parent / "data" / "prompts"

# Find all JSON files (excluding index.json)
prompt_files = [f for f in prompts_dir.rglob("*.json") if f.name != "index.json"]

valid_prompts = []
for filepath in prompt_files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Validate required fields
        required = ['id', 'name', 'description', 'content', 'isTemplate', 'tags', 'version']
        if all(k in data for k in required):
            entry = {
                'id': data['id'],
                'name': data['name'],
                'description': data['description'],
                'tags': data['tags'],
                'isTemplate': data['isTemplate'],
                'metadata': data.get('metadata', {})
            }
            valid_prompts.append(entry)
    except Exception as e:
        print(f"Skipping {filepath}: {e}")

# Sort by ID
valid_prompts.sort(key=lambda x: x['id'])

# Create index
index_data = {
    'prompts': valid_prompts,
    'metadata': {
        'totalPrompts': len(valid_prompts),
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        'version': '1.0'
    }
}

# Write index
with open(prompts_dir / 'index.json', 'w', encoding='utf-8') as f:
    json.dump(index_data, f, indent=2, ensure_ascii=False)

print(f"✓ Regenerated index with {len(valid_prompts)} prompts")