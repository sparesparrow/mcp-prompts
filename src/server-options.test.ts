import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  OptionsError,
  optionsFromConfigFile,
  optionsFromEnv,
  optionsFromQuery,
  parseCommandLine,
  parseExpose,
  parseSelector,
  resolveOptions,
} from './server-options';

describe('parseSelector', () => {
  it('reads comma-separated and repeated entries, without duplicates', () => {
    expect(parseSelector('templates', ['mia-car, tag:voice', 'openclaw', 'mia-car'])).toEqual(['mia-car', 'tag:voice', 'openclaw']);
  });

  it('maps all and none', () => {
    expect(parseSelector('prompts', 'all')).toBe('all');
    expect(parseSelector('prompts', 'none')).toEqual([]);
  });

  it('rejects empty lists, keywords mixed with entries, and a bare tag:', () => {
    expect(() => parseSelector('prompts', ' , ')).toThrow(OptionsError);
    expect(() => parseSelector('prompts', 'all,mia-car')).toThrow(/cannot be combined/);
    expect(() => parseSelector('prompts', 'none,mia-car')).toThrow(/cannot be combined/);
    expect(() => parseSelector('prompts', 'tag:')).toThrow(/tag name/);
  });
});

describe('parseExpose', () => {
  it('keeps a fixed order and rejects unknown capabilities', () => {
    expect(parseExpose('resources,tools,prompts,tools')).toEqual(['tools', 'prompts', 'resources']);
    expect(() => parseExpose('tools,sampling')).toThrow(/unknown capability sampling/);
  });
});

describe('parseCommandLine', () => {
  it('reads every option, resolving paths against cwd', () => {
    const cli = parseCommandLine(
      ['catalog', '--prompts', 'none', '--templates', 'a', '--templates', 'b', '--exclude', 'x', '--expose', 'prompts',
        '--read-only', '--prompts-dir', 'lib', '--dir', 'own', '--dir', '/abs', '--config', 'c.json', '--json'],
      '/work'
    );
    expect(cli.command).toBe('catalog');
    expect(cli.json).toBe(true);
    expect(cli.configPath).toBe(path.resolve('/work', 'c.json'));
    expect(cli.layer).toEqual({
      prompts: [], templates: ['a', 'b'], exclude: ['x'], expose: ['prompts'], readOnly: true,
      promptsDir: path.resolve('/work', 'lib'), dirs: [path.resolve('/work', 'own'), path.resolve('/abs')],
    });
  });

  it('expands ~ in paths', () => {
    expect(parseCommandLine(['--dir', '~/mine']).layer.dirs).toEqual([path.join(os.homedir(), 'mine')]);
  });

  it('rejects unknown flags and extra arguments', () => {
    expect(() => parseCommandLine(['--template', 'x'])).toThrow(/Unknown option '--template'$/);
    expect(() => parseCommandLine(['catalog', 'extra'])).toThrow(/unexpected argument "extra"/);
  });
});

describe('optionsFromEnv', () => {
  it('reads the variables, ignores empty ones and warns about unknown MCP_PROMPTS_ names', () => {
    const { layer, configPath, warnings } = optionsFromEnv({
      MCP_PROMPTS_PROMPTS: 'none',
      MCP_PROMPTS_TEMPLATES: '',
      MCP_PROMPTS_EXPOSE: 'tools,resources',
      MCP_PROMPTS_READ_ONLY: 'yes',
      MCP_PROMPTS_DIRS: ['a', 'b'].join(path.delimiter),
      MCP_PROMPTS_CONFIG: 'conf.json',
      MCP_PROMPTS_TEMPLATE: 'typo',
      PROMPTS_DIR: 'lib',
    }, '/work');
    expect(layer).toEqual({
      prompts: [], expose: ['tools', 'resources'], readOnly: true,
      promptsDir: path.resolve('/work', 'lib'), dirs: [path.resolve('/work', 'a'), path.resolve('/work', 'b')],
    });
    expect(configPath).toBe(path.resolve('/work', 'conf.json'));
    expect(warnings).toEqual(['ignoring unknown environment variable MCP_PROMPTS_TEMPLATE']);
  });

  it('rejects a read-only value that is not a boolean', () => {
    expect(() => optionsFromEnv({ MCP_PROMPTS_READ_ONLY: 'maybe' })).toThrow(/true or false/);
  });
});

describe('config files', () => {
  let dir: string;
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const writeConfig = (content: unknown) => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-config-'));
    const file = path.join(dir, 'mcp-prompts.json');
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
  };

  it('takes strings or arrays and resolves paths against the file', () => {
    const file = writeConfig({ prompts: 'none', templates: ['a', 'b,c'], expose: 'prompts', readOnly: true, promptsDir: 'lib', dirs: ['own'] });
    expect(optionsFromConfigFile(file)).toEqual({
      prompts: [], templates: ['a', 'b', 'c'], expose: ['prompts'], readOnly: true,
      promptsDir: path.join(dir, 'lib'), dirs: [path.join(dir, 'own')],
    });
  });

  it('names unknown keys and unreadable files', () => {
    expect(() => optionsFromConfigFile(writeConfig({ template: ['a'] }))).toThrow(/config file .*template/);
    expect(() => optionsFromConfigFile(writeConfig('{ not json'))).toThrow(/cannot read config file/);
  });

  it('is overridden by the environment, which is overridden by flags', () => {
    const file = writeConfig({ prompts: ['from-file'], templates: ['from-file'], expose: ['prompts'], readOnly: true });
    const { options } = resolveOptions(
      ['--templates', 'from-flag'],
      { MCP_PROMPTS_CONFIG: file, MCP_PROMPTS_TEMPLATES: 'from-env', MCP_PROMPTS_PROMPTS: 'from-env' },
      dir
    );
    expect(options.selection).toEqual({ prompts: ['from-env'], templates: ['from-flag'], exclude: [] });
    expect(options.expose).toEqual(['prompts']);
    expect(options.readOnly).toBe(true);
  });

  it('prefers --config over MCP_PROMPTS_CONFIG', () => {
    const file = writeConfig({ prompts: ['chosen'] });
    const { options } = resolveOptions(['--config', file], { MCP_PROMPTS_CONFIG: path.join(dir, 'missing.json') });
    expect(options.selection.prompts).toEqual(['chosen']);
  });
});

describe('optionsFromQuery', () => {
  it('reads the selection, capabilities and read-only from the URL', () => {
    const layer = optionsFromQuery(new URLSearchParams('prompts=none&templates=a,tag:y&templates=b&expose=prompts&readOnly=true'));
    expect(layer).toEqual({ prompts: [], templates: ['a', 'tag:y', 'b'], expose: ['prompts'], readOnly: true });
  });

  it('refuses unknown parameters, including paths', () => {
    expect(() => optionsFromQuery(new URLSearchParams('promptsDir=/etc'))).toThrow(/unknown query parameter promptsDir/);
    expect(() => optionsFromQuery(new URLSearchParams('template=a'))).toThrow(/accepted: prompts, templates/);
  });
});
