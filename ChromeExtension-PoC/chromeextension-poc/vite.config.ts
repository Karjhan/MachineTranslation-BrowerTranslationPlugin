import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { name, version } from './package.json'
import fs from 'fs/promises';
import type { Plugin } from 'vite';

function copyTransformersAssetsPlugin(): Plugin {
  return {
    name: 'copy-transformers-assets',
    apply: 'build',
    async closeBundle() {
      const root = process.cwd();
      const srcDir = path.resolve(root, 'node_modules/@huggingface/transformers/dist');
      const destDir = path.resolve(root, 'dist/transformers');
      await fs.mkdir(destDir, { recursive: true });
      const files = [
        'ort-wasm-simd-threaded.jsep.mjs',
        'ort-wasm-simd-threaded.jsep.wasm',
        'ort-wasm-simd-threaded.wasm',
        'ort-wasm-simd.wasm',
        'ort-wasm-threaded.wasm',
        'ort-wasm.wasm',
      ];
      for (const file of files) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        try {
          await fs.copyFile(src, dest);
        } catch (err) {
          console.warn(`Could not copy ${file}:`, err);
        }
      }
    }
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
    dedupe: ["onnxruntime-web"],
  },
  plugins: [
    react(),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
    copyTransformersAssetsPlugin()
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
})
