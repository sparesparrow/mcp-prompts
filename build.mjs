import esbuild from 'esbuild';
import { exec } from 'child_process';

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
    logLevel: 'info',
    external: ['pg-native'],
  })
  .then(() => {
    exec('shx chmod +x dist/index.js dist/scripts/*.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
    });
  })
  .catch(() => process.exit(1)); 