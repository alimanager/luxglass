import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Serves the MediaPipe WASM runtime from our own origin (/mediapipe/wasm/*),
 * in dev and in the build, instead of depending on a CDN.
 */
function mediapipeWasm(): Plugin {
  const dir = resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
  // FilesetResolver.forVisionTasks() loads the non-module build only
  const files = readdirSync(dir).filter((f) => !f.includes('module'));
  return {
    name: 'mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use('/mediapipe/wasm', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!files.includes(name)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(resolve(dir, name)));
      });
    },
    generateBundle() {
      for (const name of files) {
        this.emitFile({ type: 'asset', fileName: `mediapipe/wasm/${name}`, source: readFileSync(resolve(dir, name)) });
      }
    },
  };
}

/** Runs the Vercel functions of /api in the dev server, with .env.local loaded. */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      server.middlewares.use('/api/apercu', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const { handleApercu } = await server.ssrLoadModule('/server/apercu.ts');
        const origin = `http://${req.headers.host}`;
        const request = new Request(origin + '/api/apercu', {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        });
        const response: Response = await handleApercu(request, { ...process.env, ...env });
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mediapipeWasm(), devApi()],
  server: { host: true },
  build: {
    rollupOptions: {
      output: {
        // three.js in its own long-cached chunk
        manualChunks: { three: ['three'] },
      },
    },
  },
});
