#!/usr/bin/env node
/**
 * `npm run build:game -- --project=<path-to-saved-project.json> [--out=dist/game]`
 *
 * Minimal Фаза 4 release build (engine plan §4.2, "build:game" cut). Reads a project
 * file produced by the editor's "Save Project" (Project.toJSON() shape — see
 * src/models/Project.js), turns it into a runtime-Project manifest through the same
 * ProjectExporter used by Play-in-editor (src/core/PlayOperations.js), bundles
 * src/engine/index.js standalone via esbuild, and writes a self-contained
 * dist/<out>/ folder: engine.js + project.json + player.html + a verbatim copy of
 * content/ (asset images/data — no dead-asset stripping yet, see plan §4.2 note on
 * the asset-usage graph, deliberately deferred).
 *
 * Levels in a saved project file have no stable id (Level.toJSON() doesn't serialize
 * one — see plan §0.4); this script derives one from each level's `fileName` (falls
 * back to `level-<index>`, de-duplicated) purely to satisfy ProjectExporter's
 * `session.id` field. Not meaningful across separate export runs yet — irrelevant
 * until Addon override-by-id (Фаза 0.4) is actually wired into a build target.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import { ProjectExporter } from '../src/models/ProjectExporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function parseArgs(argv) {
    const args = {};
    for (const raw of argv) {
        const m = /^--([^=]+)=(.*)$/.exec(raw);
        if (m) args[m[1]] = m[2];
    }
    return args;
}

function fail(message) {
    console.error(`build:game — ${message}`);
    process.exit(1);
}

function loadProjectFile(projectPath) {
    let raw;
    try {
        raw = fs.readFileSync(projectPath, 'utf8');
    } catch (e) {
        fail(`cannot read project file "${projectPath}" (${e.message})`);
    }
    let json;
    try {
        json = JSON.parse(raw);
    } catch (e) {
        fail(`project file is not valid JSON (${e.message})`);
    }
    if (!json || !Array.isArray(json.levels) || json.levels.length === 0) {
        fail('project file has no levels (expected Project.toJSON() shape — save it from the editor via File > Save Project)');
    }
    return json;
}

/**
 * Project.toJSON() shape -> {levelSessions, levelOrder, project, entryLevelId} that
 * ProjectExporter.export() expects (see src/models/ProjectExporter.js jsdoc).
 */
function toExporterInputs(projectJson) {
    const sorted = [...projectJson.levels].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const usedIds = new Set();
    const levelSessions = new Map();
    const levelOrder = [];

    sorted.forEach((entry, index) => {
        let id = entry.fileName ? entry.fileName.replace(/\.json$/i, '') : `level-${index}`;
        if (usedIds.has(id)) id = `${id}-${index}`;
        usedIds.add(id);
        levelOrder.push(id);
        levelSessions.set(id, { id, level: { toJSON: () => entry.data } });
    });

    const currentIndex = Number.isInteger(projectJson.currentLevelIndex) ? projectJson.currentLevelIndex : 0;
    const entryLevelId = levelOrder[currentIndex] ?? levelOrder[0];

    return { levelSessions, levelOrder, project: { name: projectJson.name }, entryLevelId };
}

async function bundleEngine(outDir) {
    await esbuild.build({
        entryPoints: [path.join(rootDir, 'src/engine/index.js')],
        bundle: true,
        format: 'esm',
        target: 'es2020',
        outfile: path.join(outDir, 'engine.js')
    });
}

function copyContent(outDir) {
    const src = path.join(rootDir, 'content');
    if (!fs.existsSync(src)) return;
    fs.cpSync(src, path.join(outDir, 'content'), { recursive: true });
}

function writePlayerHtml(outDir, title) {
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title.replace(/[<>&]/g, '')}</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<canvas id="game-canvas"></canvas>
<script type="module">
import { GameEngine } from './engine.js';

const canvas = document.getElementById('game-canvas');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

const engine = new GameEngine(canvas);
fetch('./project.json')
  .then((r) => r.json())
  .then((manifest) => engine.loadProject(manifest))
  .then(() => engine.start())
  .catch((err) => console.error('Failed to load project:', err));
</script>
</body>
</html>
`;
    fs.writeFileSync(path.join(outDir, 'player.html'), html);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.project) {
        fail('missing --project=<path-to-saved-project.json>');
    }
    const projectPath = path.resolve(process.cwd(), args.project);
    const outDir = path.resolve(rootDir, args.out || 'dist/game');

    const projectJson = loadProjectFile(projectPath);
    const { levelSessions, levelOrder, project, entryLevelId } = toExporterInputs(projectJson);
    const manifest = ProjectExporter.export(levelSessions, levelOrder, project, { entryLevelId });

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(path.join(outDir, 'project.json'), JSON.stringify(manifest, null, 2));
    await bundleEngine(outDir);
    copyContent(outDir);
    writePlayerHtml(outDir, manifest.name);

    console.log(`build:game — wrote ${path.relative(rootDir, outDir)}/ (${manifest.levels.length} level(s), entry "${manifest.entryLevelId}")`);
}

main();
