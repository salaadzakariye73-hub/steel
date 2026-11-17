import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { env } from './backend/src/config/env.ts';
import { connectDatabase } from './backend/src/config/db.ts';
import { ensureInitialDatabaseSeed } from './backend/src/services/seedService.ts';
import { createExpressApp } from './backend/src/app.ts';

async function bootstrap() {
  await connectDatabase();
  await ensureInitialDatabaseSeed();

  const app = createExpressApp();

  if (env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[Server] Kaah Steel Prop Rental System running on http://0.0.0.0:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
