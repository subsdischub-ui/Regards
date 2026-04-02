const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('./docs/superpowers/plans/2026-04-01-regards-implementation.md', 'utf8');

const regex = /`([a-zA-Z0-9_\-\.\/\[\]\(\)]+?)`:\s*\n```[a-z]*\n([\s\S]*?)\n```/g;

let match;
while ((match = regex.exec(content)) !== null) {
  let filepath = match[1];
  const code = match[2];

  if (filepath.includes('package.json') || filepath.includes('docker-compose') || filepath.includes('schema.ts') || filepath.includes('globals.css')) {
      continue;
  }

  filepath = path.join(__dirname, filepath);

  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log('Writing', filepath);
  fs.writeFileSync(filepath, code);
}
