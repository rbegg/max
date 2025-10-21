import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  const proxyTarget = `http://${env.ASSISTANT_HOST}:80`;

  return {
    server: {
      headers: {
        // These headers are required to enable SharedArrayBuffer,
        // which is used by the VAD library's underlying worklets.
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      proxy: {
        // Any request to '/ws' will be proxied.
        '/ws': {
          target: proxyTarget,
          ws: true, // This is essential for WebSockets to work.
        },
      },
    },
  };
});

