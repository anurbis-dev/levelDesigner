#!/usr/bin/env node

/**
 * Runs as the git pre-push hook (.githooks/pre-push).
 * Blocks push if the outgoing commits don't touch package.json's version,
 * or if package.json/LevelEditor.js versions are out of sync.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const LEVEL_EDITOR_PATH = path.join(REPO_ROOT, 'src', 'core', 'LevelEditor.js');
const ZERO_SHA = '0'.repeat(40);

function sh(cmd) {
    return execSync(cmd, { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

function findMergeBaseWithDefault(localSha) {
    for (const ref of ['origin/master', 'origin/main']) {
        try {
            return sh(`git merge-base ${localSha} ${ref}`);
        } catch {
            // try next
        }
    }
    return null;
}

const input = fs.readFileSync(0, 'utf8').trim();
if (!input) process.exit(0);

let blocked = false;

for (const line of input.split('\n')) {
    if (!line.trim()) continue;
    const [localRef, localSha, , remoteSha] = line.split(' ');
    if (!localRef.startsWith('refs/heads/') || localSha === ZERO_SHA) continue;

    const base = (!remoteSha || remoteSha === ZERO_SHA)
        ? findMergeBaseWithDefault(localSha)
        : remoteSha;
    const range = base ? `${base}..${localSha}` : localSha;

    if (base === localSha) continue; // nothing new to push on this ref

    const pkgChanged = sh(`git diff --name-only ${range} -- package.json`);
    if (!pkgChanged) {
        const stat = sh(`git diff --shortstat ${range}`) || 'н/д';
        const commitCount = sh(`git rev-list --count ${range}`);
        console.error('');
        console.error(`✗ push заблокирован (${localRef}): версия редактора не поднята`);
        console.error(`  Коммитов в пуше: ${commitCount}`);
        console.error(`  Изменения: ${stat}`);
        console.error('  Подними версию: npm run bump:patch | bump:minor | bump:major');
        console.error('  Затем закоммить package.json + src/core/LevelEditor.js и повтори push.');
        console.error('');
        blocked = true;
        continue;
    }

    const pkgVersion = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')).version;
    const editorSrc = fs.readFileSync(LEVEL_EDITOR_PATH, 'utf8');
    const match = editorSrc.match(/static\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
    const editorVersion = match ? match[1] : null;

    if (editorVersion !== pkgVersion) {
        console.error('');
        console.error(`✗ push заблокирован: версия рассинхронизирована — package.json=${pkgVersion}, LevelEditor.js=${editorVersion}`);
        console.error('  Синхронизируй обе версии и закоммить.');
        console.error('');
        blocked = true;
    }
}

process.exit(blocked ? 1 : 0);
