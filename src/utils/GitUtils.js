/**
 * Git utilities for safe log retrieval without pager issues
 */

import { Logger } from './Logger.js';

class GitUtils {
    /**
     * Get git logs safely without pager hanging
     * @param {number} commits - Number of commits to retrieve (default: 10)
     * @param {string} format - Git log format (default: 'oneline')
     * @returns {Promise<string>} Git log output
     */
    static async getLogs(commits = 10, format = 'oneline') {
        return new Promise((resolve, reject) => {
            // Check if we're in a browser environment
            if (typeof require === 'undefined') {
                reject(new Error('GitUtils requires Node.js environment'));
                return;
            }
            
            const { spawn } = require('child_process');
            
            // Set environment to disable pager
            const env = { ...process.env, GIT_PAGER: 'cat' };
            
            const gitProcess = spawn('git', ['log', `--${format}`, `-n`, commits.toString()], {
                env: env,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
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
     * Get current branch name
     * @returns {Promise<string>} Current branch name
     */
    static async getCurrentBranch() {
        return new Promise((resolve, reject) => {
            // Check if we're in a browser environment
            if (typeof require === 'undefined') {
                reject(new Error('GitUtils requires Node.js environment'));
                return;
            }
            
            const { spawn } = require('child_process');
            
            const gitProcess = spawn('git', ['branch', '--show-current'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
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
     * Get git status
     * @returns {Promise<string>} Git status output
     */
    static async getStatus() {
        return new Promise((resolve, reject) => {
            // Check if we're in a browser environment
            if (typeof require === 'undefined') {
                reject(new Error('GitUtils requires Node.js environment'));
                return;
            }
            
            const { spawn } = require('child_process');
            
            const gitProcess = spawn('git', ['status', '--porcelain'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
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
