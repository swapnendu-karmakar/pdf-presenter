import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_TOTAL_STORAGE_BYTES = 500 * 1024 * 1024;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

function getSessionId(req) {
  const rawId = req.headers['x-session-id'] || req.query.sessionId || req.params.sessionId;
  if (!rawId || typeof rawId !== 'string') return null;
  const sanitized = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return sanitized || null;
}

function getSessionPaths(sessionId) {
  if (!sessionId) return null;
  const dir = path.join(UPLOAD_DIR, sessionId);
  return {
    dir,
    pdf: path.join(dir, 'current.pdf'),
    meta: path.join(dir, 'current.json'),
  };
}

function touchSession(paths) {
  if (!paths || !fs.existsSync(paths.dir)) return;
  const now = new Date();
  try {
    fs.utimesSync(paths.dir, now, now);
  } catch {}
}

function runStorageCleanup() {
  if (!fs.existsSync(UPLOAD_DIR)) return;
  const now = Date.now();

  try {
    const entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true });
    const sessionList = [];
    let totalBytes = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const sessionDir = path.join(UPLOAD_DIR, entry.name);
      try {
        const stats = fs.statSync(sessionDir);
        let sessionSize = 0;
        const files = fs.readdirSync(sessionDir);
        for (const file of files) {
          try {
            sessionSize += fs.statSync(path.join(sessionDir, file)).size;
          } catch {}
        }

        totalBytes += sessionSize;

        if (now - stats.mtimeMs > SESSION_MAX_AGE_MS) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          continue;
        }

        sessionList.push({
          name: entry.name,
          dir: sessionDir,
          mtimeMs: stats.mtimeMs,
          size: sessionSize,
        });
      } catch {}
    }

    if (totalBytes > MAX_TOTAL_STORAGE_BYTES) {
      sessionList.sort((a, b) => a.mtimeMs - b.mtimeMs);
      while (sessionList.length > 0 && totalBytes > MAX_TOTAL_STORAGE_BYTES) {
        const oldest = sessionList.shift();
        try {
          fs.rmSync(oldest.dir, { recursive: true, force: true });
          totalBytes -= oldest.size;
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[Storage] Cleanup scan error:', err);
  }
}

runStorageCleanup();
setInterval(runStorageCleanup, 15 * 60 * 1000);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    let sessionId = getSessionId(req);
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      req.createdSessionId = sessionId;
    }
    const dir = path.join(UPLOAD_DIR, sessionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, _file, cb) => cb(null, 'current.pdf'),
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

app.post('/api/upload', (req, res) => {
  upload.single('pdf')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'That PDF is too large (max 100MB).' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sessionId = req.createdSessionId || getSessionId(req) || path.basename(req.file.destination);
    const sessionPaths = getSessionPaths(sessionId);

    const meta = {
      sessionId,
      originalName: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
    };

    if (sessionPaths) {
      fs.writeFileSync(sessionPaths.meta, JSON.stringify(meta, null, 2));
    }

    res.json({ ok: true, sessionId, ...meta });
  });
});

app.get('/api/current', (req, res) => {
  const sessionId = getSessionId(req);
  if (!sessionId) {
    return res.json({ exists: false });
  }

  const paths = getSessionPaths(sessionId);
  if (!paths || !fs.existsSync(paths.pdf)) {
    return res.json({ exists: false });
  }

  touchSession(paths);

  let meta = {};
  if (fs.existsSync(paths.meta)) {
    try {
      meta = JSON.parse(fs.readFileSync(paths.meta, 'utf-8'));
    } catch {}
  }

  res.json({ exists: true, sessionId, ...meta });
});

app.get('/api/pdf', (req, res) => {
  const sessionId = getSessionId(req);
  if (!sessionId) {
    return res.status(404).json({ error: 'Session ID required' });
  }

  const paths = getSessionPaths(sessionId);
  if (!paths || !fs.existsSync(paths.pdf)) {
    return res.status(404).json({ error: 'No PDF found for this session' });
  }

  touchSession(paths);

  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(paths.pdf);
});

app.get('/api/pdf/:sessionId', (req, res) => {
  const sessionId = getSessionId(req);
  const paths = getSessionPaths(sessionId);
  if (!paths || !fs.existsSync(paths.pdf)) {
    return res.status(404).json({ error: 'No PDF found for this session' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(paths.pdf);
});

function deleteSessionDir(sessionId) {
  if (!sessionId) return false;
  const paths = getSessionPaths(sessionId);
  if (paths && fs.existsSync(paths.dir)) {
    try {
      fs.rmSync(paths.dir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

const activeSessionConnections = new Map();
const sessionDisconnectTimers = new Map();

app.get('/api/session-live', (req, res) => {
  const sessionId = getSessionId(req);
  if (!sessionId) {
    return res.status(400).end();
  }

  if (sessionDisconnectTimers.has(sessionId)) {
    clearTimeout(sessionDisconnectTimers.get(sessionId));
    sessionDisconnectTimers.delete(sessionId);
  }

  const currentCount = activeSessionConnections.get(sessionId) || 0;
  activeSessionConnections.set(sessionId, currentCount + 1);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`data: connected\n\n`);

  const pingInterval = setInterval(() => {
    try {
      res.write(`data: ping\n\n`);
    } catch {
      clearInterval(pingInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    const count = (activeSessionConnections.get(sessionId) || 1) - 1;
    if (count <= 0) {
      activeSessionConnections.delete(sessionId);
      const timer = setTimeout(() => {
        if (!activeSessionConnections.has(sessionId)) {
          deleteSessionDir(sessionId);
        }
        sessionDisconnectTimers.delete(sessionId);
      }, 3000);
      sessionDisconnectTimers.set(sessionId, timer);
    } else {
      activeSessionConnections.set(sessionId, count);
    }
  });
});

app.post('/api/cleanup', (req, res) => {
  let sessionId = getSessionId(req);
  if (!sessionId) {
    if (typeof req.body === 'string') {
      try {
        sessionId = JSON.parse(req.body).sessionId;
      } catch {}
    } else if (req.body?.sessionId) {
      sessionId = req.body.sessionId;
    }
  }

  if (sessionId) {
    deleteSessionDir(sessionId);
  }
  res.json({ ok: true });
});

app.delete('/api/current', (req, res) => {
  const sessionId = getSessionId(req);
  if (sessionId) {
    deleteSessionDir(sessionId);
  }
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
