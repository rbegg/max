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
          {
            // Copy the WASM, ONNX, and the browser-compatible JS wrapper
            src: 'node_modules/@gooney-001/ten-vad-lib/*.{wasm,onnx,js}',
            dest: 'lib'
          }
        ]
      })
    ],
    build: {
      assetsInlineLimit: 0,
      rollupOptions: {
        external: [
          '/lib/ten_vad.js'
        ]
      }
    }
  };
});
