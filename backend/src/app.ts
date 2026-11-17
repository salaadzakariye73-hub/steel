import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import { apiRouter } from './routes/api.ts';
import { errorHandler } from './middleware/validate.ts';

export function createExpressApp() {
  const app = express();

  app.use(
    helmet({
      // Allow AI Studio iframe preview and Vite inline scripts in dev
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/kaah-steel-prop-rental-system.zip', (_req, res) => {
    const zipPath = path.resolve(process.cwd(), 'kaah-steel-prop-rental-system.zip');
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ error: 'ZIP archive not found' });
      return;
    }
    res.download(zipPath, 'kaah-steel-prop-rental-system.zip');
  });

  app.use('/api', apiRouter);

  // Return JSON 404 for unknown /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use(errorHandler);
  return app;
}
