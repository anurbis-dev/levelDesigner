/**
 * Git utilities for safe log retrieval without pager issues
 */

import { Logger } from './Logger.js';

class GitUtils {
    /**
     * Run a git command via spawn, without pager hanging.
     * @param {string[]} args - Git CLI arguments
     * @param {Object} [options]
     * @param {Object} [options.env] - Extra env vars merged over process.env
     * @returns {Promise<string>} Trimmed stdout
     */
    static async runGitCommand(args, { env } = {}) {
        return new Promise((resolve, reject) => {
            // Check if we're in a browser environment
            if (typeof require === 'undefined') {
                reject(new Error('GitUtils requires Node.js environment'));
                return;
            }

            const { spawn } = require('child_process');

            const spawnOptions = { stdio: ['ignore', 'pipe', 'pipe'] };
            if (env) {
                spawnOptions.env = { ...process.env, ...env };
            }

            const gitProcess = spawn('git', args, spawnOptions);

            let output = '';
            let error = '';

            gitProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            gitProcess.stderr.on('data', (data) => {
                error += data.toString();
            });

            gitProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Git command failed: ${error}`));
                }
            });
        });
    }

    /**
     * Get git logs safely without pager hanging
     * @param {number} commits - Number of commits to retrieve (default: 10)
     * @param {string} format - Git log format (default: 'oneline')
     * @returns {Promise<string>} Git log output
     */
    static async getLogs(commits = 10, format = 'oneline') {
        // Set environment to disable pager
        return this.runGitCommand(['log', `--${format}`, '-n', commits.toString()], { env: { GIT_PAGER: 'cat' } });
    }

    /**
     * Get current branch name
     * @returns {Promise<string>} Current branch name
     */
    static async getCurrentBranch() {
        return this.runGitCommand(['branch', '--show-current']);
    }

    /**
     * Get git status
     * @returns {Promise<string>} Git status output
     */
    static async getStatus() {
        return this.runGitCommand(['status', '--porcelain']);
    }

    /**
     * Save git logs to file
     * @param {number} commits - Number of commits
     * @param {string} filename - Output filename
     * @returns {Promise<void>}
     */
    static async saveLogsToFile(commits = 10, filename = 'git_logs.txt') {
        try {
            // Check if we're in a browser environment
            if (typeof require === 'undefined') {
                throw new Error('GitUtils requires Node.js environment');
            }
            
            const logs = await this.getLogs(commits);
            const fs = require('fs');
            fs.writeFileSync(filename, logs, 'utf8');
            Logger.git.info(`Git logs saved to: ${filename}`);
        } catch (error) {
            Logger.git.error('Error saving git logs:', error.message);
            throw error;
        }
    }
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitUtils;
}
