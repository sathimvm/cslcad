const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PROJECTS_DIR = path.join(__dirname, 'projects');
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

app.use(express.static(__dirname));

app.post('/upload', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'no files' });

  const saved = [];
  req.files.forEach(file => {
    // file.originalname may contain the relative path when the client sets it
    const rel = file.originalname.replace(/^\/+/, '');
    // Prevent directory traversal
    const safeRel = rel.split(/\\|\//).filter(p => p && p !== '..').join(path.sep);

    const dest = path.join(PROJECTS_DIR, safeRel);
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
      fs.writeFileSync(dest, file.buffer);
      saved.push(path.relative(__dirname, dest));
    } catch (e) {
      console.error('Failed to write', dest, e);
    }
  });

  res.json({ ok: true, saved });
});

app.get('/api/projects', (req, res) => {
  // Provide a simple index of the projects folder
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.map(e => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return { type: 'folder', name: e.name, contents: walk(full) };
      return { type: 'file', name: e.name, path: path.relative(__dirname, full).replace(/\\/g, '/') };
    });
  }

  try {
    const tree = walk(PROJECTS_DIR);
    res.json(tree);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
