import { Logger } from '../utils/Logger.js';

export class StatusBar {
    constructor(element) {
        this.element = element;
        this.messageEl = element.querySelector('.status-bar-message');
        this.isVisible = !element.classList.contains('hidden');

        this._history = [];
        this._historyOpen = false;
        this._historyEl = null;
        this._historyListEl = null;

        this._boundOutsideClick = this._onOutsideClick.bind(this);
        this._boundKeyDown = this._onKeyDown.bind(this);

        this._createHistoryPanel();
        this._setupEvents();
    }

    show(message, type = 'info') {
        if (!this.messageEl) return;
        this.messageEl.textContent = message;
        this.messageEl.className = `status-bar-message status-${type}`;

        this._history.push({ message, type, time: new Date() });
        if (this._history.length > 100) this._history.shift();

        if (this._historyOpen) this._renderHistory();
    }

    clear() {
        if (!this.messageEl) return;
        this.messageEl.textContent = '';
        this.messageEl.className = 'status-bar-message';
    }

    setVisible(visible) {
        this.isVisible = visible;
        if (visible) {
            this.element.classList.remove('hidden');
            this.element.style.display = 'flex';
        } else {
            this.element.classList.add('hidden');
            this.element.style.display = 'none';
            this._closeHistory();
        }
    }

    _createHistoryPanel() {
        const panel = document.createElement('div');
        panel.id = 'status-bar-history';
        panel.className = 'status-bar-history hidden';

        const header = document.createElement('div');
        header.className = 'status-bar-history-header';
        header.textContent = 'Status History';

        const list = document.createElement('div');
        list.className = 'status-bar-history-list';

        panel.appendChild(header);
        panel.appendChild(list);
        document.body.appendChild(panel);

        this._historyEl = panel;
        this._historyListEl = list;
    }

    _setupEvents() {
        this.element.style.cursor = 'pointer';
        this.element.addEventListener('click', () => this._toggleHistory());
    }

    _toggleHistory() {
        if (this._historyOpen) {
            this._closeHistory();
        } else {
            this._openHistory();
        }
    }

    _openHistory() {
        if (!this._historyEl) return;
        this._renderHistory();
        this._historyEl.classList.remove('hidden');
        this._historyOpen = true;

        // rAF so the click that triggered open doesn't immediately close via outside-click
        requestAnimationFrame(() => {
            document.addEventListener('mousedown', this._boundOutsideClick);
            document.addEventListener('keydown', this._boundKeyDown);
        });
    }

    _closeHistory() {
        if (!this._historyEl) return;
        this._historyEl.classList.add('hidden');
        this._historyOpen = false;
        document.removeEventListener('mousedown', this._boundOutsideClick);
        document.removeEventListener('keydown', this._boundKeyDown);
    }

    _renderHistory() {
        if (!this._historyListEl) return;
        this._historyListEl.innerHTML = '';

        if (this._history.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'status-bar-history-empty';
            empty.textContent = 'No messages yet';
            this._historyListEl.appendChild(empty);
            return;
        }

        // oldest at top, newest at bottom (popup opens upward from status bar)
        this._history.forEach(entry => {
            const item = document.createElement('div');
            item.className = `status-bar-history-item status-${entry.type}`;

            const time = document.createElement('span');
            time.className = 'status-bar-history-time';
            time.textContent = `[${entry.time.toLocaleTimeString()}]`;

            const text = document.createTextNode(` ${entry.message}`);

            item.appendChild(time);
            item.appendChild(text);
            this._historyListEl.appendChild(item);
        });

        this._historyListEl.scrollTop = this._historyListEl.scrollHeight;
    }

    _onOutsideClick(e) {
        const inHistory = this._historyEl && this._historyEl.contains(e.target);
        const inBar = this.element.contains(e.target);
        if (!inHistory && !inBar) {
            this._closeHistory();
        }
    }

    _onKeyDown(e) {
        if (e.key === 'Escape') {
            this._closeHistory();
        }
    }

    destroy() {
        this._closeHistory();
        if (this._historyEl) {
            this._historyEl.remove();
            this._historyEl = null;
            this._historyListEl = null;
        }
        Logger.ui.debug('StatusBar destroyed');
    }
}
