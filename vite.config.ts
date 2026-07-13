import { defineConfig, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { scrapeCore } from './api/scrape.ts';
import { enhanceCore } from './api/enhance.ts';

/**
 * Dev-only API bridge. In production the files in `/api` are deployed as
 * Vercel serverless functions. Locally, `npm run dev` alone won't run them,
 * so this plugin mounts the exact same core handlers as middleware — meaning
 * `npm run dev` is fully functional without the Vercel CLI. Both paths import
 * from `server/core.ts`, so behaviour is identical.
 */
function devApi() {
  const route = (
    server: { middlewares: Connect.Server },
    path: string,
    fn: (body: unknown, env: NodeJS.ProcessEnv) => Promise<{ status: number; body: unknown }>,
  ) => {
    server.middlewares.use(path, async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');
        const body = raw ? JSON.parse(raw) : {};
        const { status, body: out } = await fn(body, process.env);
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(out));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
  };
  return {
    name: 'dev-api',
    configureServer(server: { middlewares: Connect.Server }) {
      route(server, '/api/scrape', scrapeCore);
      route(server, '/api/enhance', enhanceCore);
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
});
