#!/usr/bin/env node

/**
 * Claude Code PreToolUse hook (matcher: Bash, if: "Bash(git commit*)").
 * Blocks `git commit` when package.json's version hasn't moved since HEAD.
 */

import fs from 'fs';
import { execSync } from 'child_process';

function allow() {
    process.exit(0);
}

function deny(reason) {
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason
        }
    }));
    process.exit(0);
}

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { allow(); }

let payload;
try { payload = JSON.parse(raw); } catch { allow(); }

const command = payload?.tool_input?.command || '';

if (!/(^|[;&|]\s*)git\s+commit\b/.test(command)) allow();
if (/\s(-h|--help)\b/.test(command)) allow();

function sh(cmd) {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
}

let headVersion;
try {
    headVersion = JSON.parse(sh('git show HEAD:package.json')).version;
} catch {
    allow(); // no HEAD yet / package.json not tracked
}

let indexVersion, workingVersion;
try { indexVersion = JSON.parse(sh('git show :package.json')).version; } catch { indexVersion = headVersion; }
try { workingVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version; } catch { workingVersion = headVersion; }

if (indexVersion !== headVersion || workingVersion !== headVersion) allow();

deny(
    `Версия редактора не поднята (package.json version=${headVersion} не менялся). ` +
    'Перед коммитом: npm run bump:patch | bump:minor | bump:major, ' +
    'затем git add package.json src/core/LevelEditor.js и повтори commit.'
);
