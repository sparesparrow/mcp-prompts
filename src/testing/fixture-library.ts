import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// A small prompt library on disk for tests, so they do not depend on the bundled prompts:
//
//   library/root-note.json        plain     tags: x
//   library/alpha/a-plain.json    plain     tags: x
//   library/alpha/a-greet.json    template  tags: y    "Hello {{who}} from {{place}}"
//   library/alpha/deep/a-deep.json template tags: z
//   library/beta/b-plain.json     plain     tags: y
//   library/beta/b-tmpl.json      template  tags: x
//   library/profiles.json         profiles: greetings (the alpha templates), notes (root-note and beta's plain prompts)
//   own/o-tmpl.json               template  (the user's own directory)
//   own/b-plain.json              plain     replaces the library's b-plain

export interface FixtureLibrary {
  root: string;
  library: string;
  own: string;
  cleanup: () => void;
}

function write(file: string, prompt: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(prompt, null, 2));
}

export function makeFixtureLibrary(): FixtureLibrary {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-fixture-'));
  const library = path.join(root, 'library');
  const own = path.join(root, 'own');
  const plain = (id: string, tags: string[]) => ({ id, name: `${id} name`, description: `${id} description`, content: `${id} content`, isTemplate: false, tags });
  write(path.join(library, 'root-note.json'), plain('root-note', ['x']));
  write(path.join(library, 'alpha', 'a-plain.json'), plain('a-plain', ['x']));
  write(path.join(library, 'alpha', 'a-greet.json'), {
    id: 'a-greet', name: 'Greeting', description: 'Greets someone', content: 'Hello {{who}} from {{place}}',
    isTemplate: true, variables: ['who', { name: 'place', description: 'Where from' }], tags: ['y'],
  });
  write(path.join(library, 'alpha', 'deep', 'a-deep.json'), { ...plain('a-deep', ['z']), isTemplate: true, content: 'Deep {{x}}', variables: ['x'] });
  write(path.join(library, 'beta', 'b-plain.json'), plain('b-plain', ['y']));
  write(path.join(library, 'beta', 'b-tmpl.json'), { ...plain('b-tmpl', ['x']), isTemplate: true, content: 'B {{v}}', variables: ['v'] });
  write(path.join(library, 'index.json'), { ignored: true });
  write(path.join(library, 'profiles.json'), {
    profiles: {
      greetings: { description: 'Greeting templates', prompts: 'none', templates: ['alpha'] },
      notes: { description: 'Plain notes', prompts: ['root-note', 'beta'], templates: 'none' },
    },
  });
  write(path.join(own, 'o-tmpl.json'), { ...plain('o-tmpl', []), isTemplate: true, content: 'Own {{v}}', variables: ['v'] });
  write(path.join(own, 'b-plain.json'), { ...plain('b-plain', ['y']), name: 'My b-plain' });
  return { root, library, own, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
