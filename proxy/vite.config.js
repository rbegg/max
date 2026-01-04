import { defineConfig, loadEnv } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Prioritize system environment variables
  const assistantHost = process.env.ASSISTANT_HOST || env.ASSISTANT_HOST || 'assistant';
  const proxyTarget = `http://${assistantHost}:80`;

  return {
    plugins: [
      basicSsl(),
      viteStaticCopy({
        targets: [
          { src: 'node_modules/onnxruntime-web/dist/*.wasm', dest: '.' },
          { src: 'node_modules/onnxruntime-web/dist/*.mjs', dest: '.' },
          { src: 'node_modules/@ricky0123/vad-web/dist/*.onnx', dest: 'assets' },
          { src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.dev.js', dest: '.', rename: 'vad.worklet.bundle.js' }
        ]
      })
    ],
    // Prevents Vite from breaking ONNX internal paths
    optimizeDeps: {
      exclude: ['onnxruntime-web', '@ricky0123/vad-web']
    },
    build: {
      assetsInlineLimit: 0
    }
  };
});