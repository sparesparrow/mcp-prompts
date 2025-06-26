import esbuild from 'esbuild';
import { exec } from 'child_process';
import { readFileSync } from 'fs';

// Read dependencies from package.json to mark them as external
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const external = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {}),
];

const entryPoints = [
  'src/index.ts',
  'src/scripts/sse-test.ts',
  'src/scripts/validate-json.ts',
  'src/scripts/validate-prompts.ts',
  'src/scripts/workflow-cli.ts',
];

esbuild
  .build({
    entryPoints,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outdir: 'dist',
    outExtension: { '.js': '.mjs' },
    logLevel: 'info',
    external: [
      'pg',
      'pg-native', 
      'pino', 
      'pino-pretty',
      'proper-lockfile',
      'form-data',
      'combined-stream',
      'proxy-from-env',
      'follow-redirects',
      'path',
      'fs',
      'crypto',
      'stream',
      'util',
      'url',
      'querystring',
      'http',
      'https',
      'net',
      'tls',
      'zlib',
      'buffer',
      'process',
      'os',
      'child_process',
      'cluster',
      'dgram',
      'dns',
      'domain',
      'module',
      'punycode',
      'readline',
      'repl',
      'string_decoder',
      'sys',
      'timers',
      'tty',
      'v8',
      'vm',
      'worker_threads',
      'events',
      'assert',
      'constants',
      'fs/promises',
      'perf_hooks',
      'inspector',
      'trace_events',
      'async_hooks'
    ],
  })
  .then(() => {
    exec('shx chmod +x dist/index.mjs dist/scripts/*.mjs', (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
    });
  })
  .catch(() => process.exit(1));
