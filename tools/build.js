/**
 * Build script for CodeMirror bundle
 * Creates a single minified file with all CodeMirror dependencies
 */

import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../static/vendor/codemirror.bundle.js');

console.log('Building CodeMirror bundle...');

try {
  await esbuild.build({
    entryPoints: [resolve(__dirname, 'codemirror-entry.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    outfile: outputPath,
    platform: 'browser',
    target: 'es2020'
  });
  
  console.log('✓ Bundle created:', outputPath);
  console.log('✓ Commit this file to git, exclude node_modules');
} catch (error) {
  console.error('✗ Build failed:', error);
  process.exit(1);
}
