# MCP Prompts Utility Scripts

This directory contains utility scripts for managing the MCP Prompts Server. These scripts help with processing, organizing, and managing prompts outside of the main server functionality.

## Available Scripts

| Script | Description |
|--------|-------------|
| `process_prompts.js` | Extracts and processes prompts from raw text sources |
| `manage_tags.js` | Manages tags across all prompts |
| `organize_prompts.js` | Organizes prompts into a logical directory structure |
| `prompt-pipeline.js` | Runs the complete prompt processing pipeline |
| `export_prompts.js` | Exports prompts to various formats for sharing |
| `import_prompts.js` | Imports prompts from exported files or directories |

## Using the Scripts

All scripts are accessible via npm commands. The scripts can be run with various options to customize their behavior.

### Processing Raw Prompts

```bash
npm run prompt:process          # Basic processing
npm run prompt:process:backup   # Create backup before processing
npm run prompt:process:keep     # Keep raw file after processing
```

The script extracts prompts from a `rawprompts.txt` file, de-duplicates them, adds metadata, and saves them in both JSON and Markdown formats.

### Managing Tags

```bash
npm run prompt:tags list        # List all tags and their usage
npm run prompt:tags add <tag> <search>   # Add tag to matching prompts
npm run prompt:tags remove <tag>         # Remove tag from all prompts
npm run prompt:tags rename <old> <new>   # Rename a tag across all prompts
```

### Organizing Prompts

```bash
npm run prompt:organize         # Organize prompts into categories
npm run prompt:organize:dry     # Preview organization without changes
npm run prompt:organize:force   # Force organization (overwrite existing)
```

### Complete Pipeline

```bash
npm run prompt:pipeline         # Run complete processing pipeline
npm run prompt:pipeline:dry     # Preview pipeline without changes
npm run prompt:pipeline:verbose # Show detailed output from each step
npm run prompt:pipeline:keep    # Keep raw prompts file
```

### Exporting Prompts

```bash
npm run prompt:export           # Export as JSON
npm run prompt:export:zip       # Export as ZIP archive
npm run prompt:export:md        # Export as Markdown
```

### Importing Prompts

```bash
npm run prompt:import -- --source=path/to/file     # Import from source
npm run prompt:import:dry -- --source=path/to/file # Preview import
npm run prompt:import:force -- --source=path/to/file # Force import
```

## Script Details

Each script provides its own help information when run without parameters or with `--help`. 