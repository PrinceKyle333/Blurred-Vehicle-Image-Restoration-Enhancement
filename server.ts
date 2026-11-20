import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startPythonBackend } from './src/server/pythonBackend.ts';
import { createRestorationRouter } from './src/server/restorationRouter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  await startPythonBackend(__dirname);

  const app = express();

  app.use('/api', createRestorationRouter());

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    const hasDist = fs.existsSync(path.resolve(__dirname, 'dist'));
    console.log(
      `Vehicle Image Restoration server listening on http://localhost:${PORT} (mode=${process.env.NODE_ENV || 'development'}, dist=${hasDist})`
    );
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${PORT} is already in use - the app is probably already running in another terminal.\n` +
          `Open http://localhost:${PORT}, or stop the other instance (Ctrl+C in its terminal) and try again.`
      );
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
