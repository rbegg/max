import { defineConfig, loadEnv } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  const proxyTarget = `http://${env.ASSISTANT_HOST}:80`;
  console.log(`Proxying WebSocket requests to: ${proxyTarget}`);

  return {
    // Keep alias for 'path' as it resolved a previous Rollup error
    resolve: {
      alias: {
        path: "path-browserify",
        'node:path': "path-browserify"
      }
    },
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      proxy: {
        '/ws': {
          target: proxyTarget,
          ws: true,
        },
      },
    },
    // Keep optimizeDeps.exclude as recommended for onnxruntime-web
    optimizeDeps: {
      exclude: ['onnxruntime-web'],
    },
    // Keep assetsInclude for .onnx as it resolved a previous build error
    assetsInclude: ['**/*.onnx'],
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
            dest: 'assets'
          },
          // Copy WASM and MJS files to the build output root (dist/) as per docs
          {
            src: 'node_modules/onnxruntime-web/dist/*.{wasm,mjs}',
            dest: 'assets' // Destination is root
          },
          // Also copy ONNX model to the build output root (dist/) as per docs
          {
            src: 'src/silero_vad.onnx', // Source from src (copied by postinstall)
            dest: '.', // Destination is root
            rename: 'silero_vad.onnx' // Ensure original name
          },
          // Keep explicit copy to /assets as a fallback for client expectation
           {
            src: 'src/silero_vad.onnx',
            dest: 'assets',
            rename: 'silero_vad.onnx'
          }
        ]
      })
    ],

  };
});

