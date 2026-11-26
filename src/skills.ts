import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { StoredPrompt } from './prompt-store.js';

// Prompts as Agent Skills (https://agentskills.io/specification), so Claude Code, Codex and the
// other CLIs that read SKILL.md folders can use the same text mcp-prompts serves.
//
// A prompt becomes <dir>/<name>/SKILL.md:
//   - the skill's name is the prompt id, rewritten to the skill alphabet when it has to be;
//   - the skill's description is the prompt description, shortened at a sentence to the 1024
//     characters a skill allows;
//   - the body is the prompt content. A template's body starts with a "Parameters" section that
//     lists its {{variables}}, between two marker comments so an import can take it out again;
//   - metadata.mcp-prompts-id holds the prompt id, and metadata.mcp-prompts-prompt holds, as JSON,
//     the fields a skill has no place for (name, tags, category, variables, the full
//     description when it was shortened, and so on). With both, an import gives back the prompt.
// A SKILL.md written by hand, without that metadata, is read as a prompt named after the skill.

/** The limits of the Agent Skills specification. */
export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_FILE = 'SKILL.md';

const SKILL_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
const ID_KEY = 'mcp-prompts-id';
const PROMPT_KEY = 'mcp-prompts-prompt';
const PARAMETERS_START = '<!-- mcp-prompts:parameters -->';
const PARAMETERS_END = '<!-- mcp-prompts:end-parameters -->';

/** A skill name: lowercase letters and digits in runs joined by single hyphens, at most 64 characters. */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The skill name for a prompt id: lowercased, other characters turned into hyphens, cut to 64. */
export function skillNameFor(id: string): string {
  const name = id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SKILL_NAME_MAX)
    .replace(/-+$/, '');
  return name || 'prompt';
}

/** Shortens a description to max characters, at the end of a sentence when one ends late enough. */
export function shortenDescription(text: string, max = SKILL_DESCRIPTION_MAX): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);
  const sentence = Math.max(room.lastIndexOf('. '), room.lastIndexOf('.\n'));
  if (sentence >= max / 2) return room.slice(0, sentence + 1);
  const space = room.lastIndexOf(' ');
  return `${room.slice(0, space > max / 2 ? space : room.length).trimEnd()}…`;
}

function variableName(variable: unknown): string | undefined {
  if (typeof variable === 'string') return variable;
  if (variable && typeof variable === 'object' && typeof (variable as { name?: unknown }).name === 'string') {
    return (variable as { name: string }).name;
  }
  return undefined;
}

/** The section a template's body starts with: which placeholders to fill before following it. */
function parametersSection(prompt: StoredPrompt): string {
  const lines = [
    PARAMETERS_START,
    '## Parameters',
    '',
    'This skill is a template. Before you follow it, replace each `{{name}}` placeholder below with',
    'a value from the task, and ask the user for any value you cannot work out.',
    '',
  ];
  const variables = (prompt.variables ?? []) as unknown[];
  if (variables.length === 0) lines.push('- (none listed; look for `{{...}}` in the text)');
  for (const variable of variables) {
    const name = variableName(variable);
    if (!name) continue;
    const description = typeof variable === 'object' ? (variable as { description?: unknown }).description : undefined;
    const required = typeof variable === 'object' && (variable as { required?: unknown }).required === false ? ' (optional)' : '';
    lines.push(`- \`${name}\`${required}${typeof description === 'string' && description ? `: ${description}` : ''}`);
  }
  lines.push('', PARAMETERS_END, '', '');
  return lines.join('\n');
}

// skills-ref, the reference validator, finds the end of the frontmatter by splitting the file at
// the first "---" after the opening one, so a value must not contain three hyphens in a row. In a
// double-quoted YAML string \x2d is a hyphen.
function breakHyphenRuns(yaml: string): string {
  return yaml.replace(/--/g, '-\\x2d');
}

export interface Skill {
  /** The skill's name, which is also its directory name. */
  name: string;
  /** The whole SKILL.md. */
  text: string;
}

/** The SKILL.md for a prompt, named name (skillNameFor(prompt.id) unless a caller had to make it unique). */
export function promptToSkill(prompt: StoredPrompt, name = skillNameFor(prompt.id)): Skill {
  const fullDescription = (prompt.description ?? '').trim() ? (prompt.description as string) : '';
  const description = shortenDescription(fullDescription || prompt.name);
  // Everything except what the frontmatter and body already carry.
  const { id, content, ...rest } = prompt;
  const extra: Record<string, unknown> = { ...rest };
  // Kept when the frontmatter cannot carry it as it is: shortened, empty, or absent (null).
  if (description === prompt.description) delete extra.description;
  else if (prompt.description === undefined) extra.description = null;
  const frontmatter = {
    name,
    description,
    metadata: { [ID_KEY]: id, [PROMPT_KEY]: JSON.stringify(extra) },
  };
  const yaml = breakHyphenRuns(stringifyYaml(frontmatter, { defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN', lineWidth: 0 }));
  const body = prompt.isTemplate ? parametersSection(prompt) + content : content;
  return { name, text: `---\n${yaml}---\n\n${body}` };
}

/** A SKILL.md that cannot be read; the message says why. */
export class SkillFormatError extends Error {}

/** The frontmatter of a SKILL.md, its metadata mapping, and where the body starts. */
function readFrontmatter(text: string): { fields: Record<string, unknown>; metadata: Record<string, unknown>; length: number } {
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) throw new SkillFormatError('it does not start with YAML frontmatter between --- lines');
  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(match[1]);
  } catch (error) {
    throw new SkillFormatError(`its frontmatter is not valid YAML (${error instanceof Error ? error.message.split('\n')[0] : 'error'})`);
  }
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new SkillFormatError('its frontmatter is not a YAML mapping');
  }
  const fields = frontmatter as Record<string, unknown>;
  const metadata = fields.metadata && typeof fields.metadata === 'object' && !Array.isArray(fields.metadata)
    ? (fields.metadata as Record<string, unknown>)
    : {};
  return { fields, metadata, length: match[0].length };
}

/**
 * The prompt a SKILL.md describes, as the raw object a prompt file would hold (the store checks
 * it like any other). dirName is the skill's directory name, used when the frontmatter has no name.
 */
export function skillToPrompt(text: string, dirName: string): Record<string, unknown> {
  const { fields, metadata, length } = readFrontmatter(text);
  const name = typeof fields.name === 'string' && fields.name.trim() ? fields.name.trim() : dirName;
  const description = typeof fields.description === 'string' ? fields.description : undefined;
  let body = text.slice(length);

  if (typeof metadata[ID_KEY] === 'string' && metadata[ID_KEY]) {
    // Written by promptToSkill: the separator line after the frontmatter, then the body as written.
    if (body.startsWith('\n')) body = body.slice(1);
    else if (body.startsWith('\r\n')) body = body.slice(2);
    let extra: Record<string, unknown> = {};
    if (typeof metadata[PROMPT_KEY] === 'string') {
      try {
        const parsed: unknown = JSON.parse(metadata[PROMPT_KEY] as string);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) extra = parsed as Record<string, unknown>;
      } catch {
        throw new SkillFormatError(`metadata.${PROMPT_KEY} is not JSON`);
      }
    }
    if (extra.isTemplate === true && body.startsWith(PARAMETERS_START)) {
      const end = body.indexOf(`${PARAMETERS_END}\n\n`);
      if (end >= 0) body = body.slice(end + PARAMETERS_END.length + 2);
    }
    const prompt: Record<string, unknown> = {
      ...extra,
      id: metadata[ID_KEY],
      name: typeof extra.name === 'string' ? extra.name : name,
      // The description kept beside the frontmatter's stand-in, else the frontmatter's own.
      description: typeof extra.description === 'string' ? extra.description : description,
      content: body,
    };
    if (extra.description === null) delete prompt.description;
    return prompt;
  }

  // Written by hand: the skill as it is, with the fields a prompt has no place for kept in metadata.
  const skill: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key !== 'name' && key !== 'description') skill[key] = value;
  }
  return {
    id: name,
    name,
    ...(description !== undefined ? { description } : {}),
    content: body.replace(/^(?:\r?\n)+/, ''),
    tags: ['skill'],
    ...(Object.keys(skill).length > 0 ? { metadata: { skill } } : {}),
  };
}

/** Problems that would make a SKILL.md fail the Agent Skills specification; empty when it passes. */
export function checkSkill(text: string, dirName: string): string[] {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return ['missing frontmatter'];
  const problems: string[] = [];
  if (match[1].includes('---')) problems.push('the frontmatter contains "---", which ends it early for skills-ref');
  const fields = parseYaml(match[1]) as Record<string, unknown>;
  for (const key of Object.keys(fields)) if (!SKILL_FIELDS.includes(key)) problems.push(`unexpected field ${key}`);
  const name = fields.name;
  if (typeof name !== 'string' || !SKILL_NAME_PATTERN.test(name) || name.length > SKILL_NAME_MAX) problems.push(`invalid name ${String(name)}`);
  else if (name !== dirName) problems.push(`name ${name} does not match the directory ${dirName}`);
  const description = fields.description;
  if (typeof description !== 'string' || !description.trim()) problems.push('empty description');
  else if (description.length > SKILL_DESCRIPTION_MAX) problems.push(`description is ${description.length} characters`);
  const metadata = fields.metadata;
  if (metadata !== undefined) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) problems.push('metadata is not a mapping');
    else for (const [key, value] of Object.entries(metadata)) if (typeof value !== 'string') problems.push(`metadata.${key} is not a string`);
  }
  return problems;
}

export interface ExportResult {
  dir: string;
  written: { id: string; skill: string }[];
  /** Prompts not written, and why: a skill of that name was not written by mcp-prompts for this prompt. */
  skipped: { id: string; skill: string; reason: string }[];
}

/** The prompt id a SKILL.md was exported from, or undefined for one written by hand or unreadable. */
function exportedId(file: string): string | undefined {
  try {
    const id = readFrontmatter(fs.readFileSync(file, 'utf8')).metadata[ID_KEY];
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes each prompt as <dir>/<skill>/SKILL.md. A SKILL.md that is already there is replaced only
 * when mcp-prompts exported it from the same prompt; anything else in the directory is left alone.
 */
export function exportSkills(prompts: StoredPrompt[], dir: string): ExportResult {
  const result: ExportResult = { dir, written: [], skipped: [] };
  const taken = new Set<string>();
  fs.mkdirSync(dir, { recursive: true });
  for (const prompt of prompts) {
    const base = skillNameFor(prompt.id);
    let name = base;
    for (let n = 2; taken.has(name); n++) {
      const suffix = `-${n}`;
      name = `${base.slice(0, SKILL_NAME_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    }
    taken.add(name);
    const file = path.join(dir, name, SKILL_FILE);
    if (fs.existsSync(file)) {
      const owner = exportedId(file);
      if (owner !== prompt.id) {
        result.skipped.push({
          id: prompt.id,
          skill: name,
          reason: owner === undefined ? `${file} was not written by mcp-prompts` : `${file} holds the prompt ${owner}`,
        });
        continue;
      }
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, promptToSkill(prompt, name).text);
    result.written.push({ id: prompt.id, skill: name });
  }
  return result;
}
