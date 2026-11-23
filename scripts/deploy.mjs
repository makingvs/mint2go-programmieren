// Veröffentlicht die gebaute Seite (dist/) auf den Zweig gh-pages des Repositorys (GitHub Pages liefert ihn aus).
// Aufruf: npm run deploy   (baut zuerst; braucht Schreibrechte auf "origin")
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: cmd === 'npm' && process.platform === 'win32' });
const out = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8', shell: cmd === 'npm' && process.platform === 'win32' }).trim();

run('npm', ['run', 'build']);
const remote = out('git', ['remote', 'get-url', 'origin']);
const sha = out('git', ['rev-parse', '--short', 'HEAD']);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
try {
  fs.cpSync(path.join(root, 'dist'), tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, '.nojekyll'), '');
  run('git', ['init', '-q', '-b', 'gh-pages'], tmp);
  run('git', ['add', '-A'], tmp);
  run('git', ['commit', '-q', '-m', `Seite veröffentlichen (${sha})`], tmp);
  run('git', ['push', '-f', remote, 'gh-pages'], tmp);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
