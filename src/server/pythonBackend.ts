import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEFAULT_PYTORCH_API_URL = 'http://127.0.0.1:8000';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1', '[::1]']);

function findVenvPython(backendDir: string): string | null {
  const candidates =
    process.platform === 'win32'
      ? [path.join(backendDir, '.venv', 'Scripts', 'python.exe')]
      : [path.join(backendDir, '.venv', 'bin', 'python3'), path.join(backendDir, '.venv', 'bin', 'python')];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

async function isReachable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/v1/models/status`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function pipeWithPrefix(stream: NodeJS.ReadableStream | null, out: NodeJS.WriteStream) {
  if (!stream) return;
  let buffered = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? '';
    for (const line of lines) out.write(`[python] ${line}\n`);
  });
}

/**
 * Starts the FastAPI/PyTorch backend (backend/app.py) as a child process so
 * `npm run dev` brings up the whole stack. Skipped when:
 *   - START_PYTHON_BACKEND=false
 *   - PYTORCH_API_URL points at a non-local host
 *   - something is already serving at PYTORCH_API_URL
 *   - backend/.venv does not exist (prints setup instructions instead)
 *
 * Must be called before createRestorationRouter(), since it may set
 * process.env.PYTORCH_API_URL to the default local URL.
 */
export async function startPythonBackend(projectRoot: string): Promise<ChildProcess | null> {
  if (process.env.START_PYTHON_BACKEND === 'false') return null;

  const apiUrl = (process.env.PYTORCH_API_URL || '').trim() || DEFAULT_PYTORCH_API_URL;
  process.env.PYTORCH_API_URL = apiUrl;

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    console.warn(`[python] PYTORCH_API_URL "${apiUrl}" is not a valid URL; not starting backend.`);
    return null;
  }

  if (!LOCAL_HOSTS.has(parsed.hostname)) return null;

  if (await isReachable(apiUrl)) {
    console.log(`[python] Backend already running at ${apiUrl}; not starting another.`);
    return null;
  }

  const backendDir = path.join(projectRoot, 'backend');
  const python = findVenvPython(backendDir);
  if (!python) {
    console.warn(
      '[python] backend/.venv not found, so the PyTorch backend was not started.\n' +
        '[python] Set it up once with:\n' +
        '[python]   cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt\n' +
        '[python]   (on macOS/Linux use .venv/bin/python)'
    );
    return null;
  }

  const host = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname.replace(/^\[|\]$/g, '');
  const port = parsed.port || '8000';

  console.log(`[python] Starting PyTorch backend on http://${host}:${port} ...`);
  const child = spawn(python, ['-m', 'uvicorn', 'app:app', '--host', host, '--port', port], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  pipeWithPrefix(child.stdout, process.stdout);
  pipeWithPrefix(child.stderr, process.stderr);

  child.on('error', (err) => console.error('[python] Failed to start backend:', err.message));
  child.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM') console.warn(`[python] Backend exited (code=${code}, signal=${signal}).`);
  });

  const stop = () => {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  };
  process.on('exit', stop);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(sig, () => {
      stop();
      process.exit(0);
    });
  }

  return child;
}
