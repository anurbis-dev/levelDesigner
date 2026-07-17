/**
 * Play-mode dialogue overlay: speaker/text, choice buttons, item picker for itemPick.
 * DOM layer on #play-overlay; polls scene each rAF. English-only UI.
 */

export class DialoguePlayHud {
    /**
     * @param {HTMLElement} overlayHost play-overlay element
     * @param {() => object|null|undefined} getScene () => GameEngine.scene
     */
    constructor(overlayHost, getScene) {
        this._host = overlayHost;
        this._getScene = getScene;
        this._rafId = null;
        this._root = null;
        /** @type {string|null} signature of last rendered state */
        this._sig = null;
        /** Pending choice index waiting for item pick */
        this._pendingChoiceIndex = null;
        this._build();
    }

    start() {
        if (this._rafId != null) return;
        const loop = () => {
            this.sync();
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stop() {
        if (this._rafId != null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this._rafId);
        }
        this._rafId = null;
        this._sig = null;
        this._pendingChoiceIndex = null;
        if (this._root) {
            this._root.remove();
            this._root = null;
        }
    }

    /** @private */
    _build() {
        const root = document.createElement('div');
        root.className = 'dialogue-play-hud';
        root.setAttribute('aria-live', 'polite');
        this._host.appendChild(root);
        this._root = root;
        this._hide();
    }

    /** @private */
    _hide() {
        if (!this._root) return;
        this._root.style.display = 'none';
        this._root.innerHTML = '';
    }

    /**
     * Resolve item label from scene.itemDefs / raw id.
     * @param {object} scene
     * @param {string} itemId
     */
    _itemLabel(scene, itemId) {
        const def = scene.itemDefs?.get?.(itemId);
        if (def?.displayName) return `${def.displayName} (${itemId})`;
        return itemId;
    }

    sync() {
        const scene = this._getScene?.();
        const runner = scene?.dialogueRunner;
        if (!scene?.dialogueActive || !runner || runner.isEnded()) {
            if (this._sig !== 'hidden') {
                this._hide();
                this._sig = 'hidden';
                this._pendingChoiceIndex = null;
            }
            return;
        }

        const node = runner.getCurrentNode();
        const speaker = runner.getCurrentSpeaker();
        const choices = runner.getVisibleChoices();
        const hasChoices = Array.isArray(node?.choices) && node.choices.length > 0;
        const invList = scene.inventory?.list?.() || [];
        const invSig = invList.map((r) => `${r.itemId}:${r.count}`).join(',');
        const choiceSig = choices.map((c) => c.text).join('|');
        const sig = [
            runner.currentNodeId,
            speaker.displayName,
            node?.text || '',
            hasChoices ? 'c' : 'l',
            choiceSig,
            this._pendingChoiceIndex ?? '-',
            invSig
        ].join('§');

        if (sig === this._sig) return;
        this._sig = sig;
        this._render(scene, runner, node, speaker, choices, hasChoices, invList);
    }

    /**
     * @private
     */
    _render(scene, runner, node, speaker, choices, hasChoices, invList) {
        const root = this._root;
        if (!root) return;
        root.style.display = 'flex';
        root.innerHTML = '';

        const panel = document.createElement('div');
        panel.className = 'dialogue-play-hud__panel';

        const who = document.createElement('div');
        who.className = 'dialogue-play-hud__speaker';
        who.textContent = speaker.displayName || '…';
        panel.appendChild(who);

        const text = document.createElement('div');
        text.className = 'dialogue-play-hud__text';
        text.textContent = node?.text || '';
        panel.appendChild(text);

        if (this._pendingChoiceIndex != null) {
            const pickBox = document.createElement('div');
            pickBox.className = 'dialogue-play-hud__picks';
            const lab = document.createElement('div');
            lab.className = 'dialogue-play-hud__hint';
            lab.textContent = 'Choose an item:';
            pickBox.appendChild(lab);

            if (!invList.length) {
                const empty = document.createElement('div');
                empty.className = 'dialogue-play-hud__hint';
                empty.textContent = 'Inventory empty';
                pickBox.appendChild(empty);
            } else {
                for (const row of invList) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'dialogue-play-hud__btn dialogue-play-hud__btn--item';
                    btn.textContent = `${this._itemLabel(scene, row.itemId)} ×${row.count}`;
                    btn.addEventListener('click', () => {
                        const idx = this._pendingChoiceIndex;
                        this._pendingChoiceIndex = null;
                        this._sig = null;
                        runner.advance(idx, { selectedItemId: row.itemId });
                    });
                    pickBox.appendChild(btn);
                }
            }

            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'dialogue-play-hud__btn dialogue-play-hud__btn--secondary';
            cancel.textContent = 'Cancel';
            cancel.addEventListener('click', () => {
                this._pendingChoiceIndex = null;
                this._sig = null;
            });
            pickBox.appendChild(cancel);
            panel.appendChild(pickBox);
        } else {
            const actions = document.createElement('div');
            actions.className = 'dialogue-play-hud__actions';

            if (!hasChoices) {
                const cont = document.createElement('button');
                cont.type = 'button';
                cont.className = 'dialogue-play-hud__btn';
                cont.textContent = 'Continue';
                cont.addEventListener('click', () => {
                    this._sig = null;
                    runner.advance();
                });
                actions.appendChild(cont);
            } else {
                choices.forEach((choice, index) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'dialogue-play-hud__btn';
                    let label = choice.text || `Choice ${index + 1}`;
                    if (choice.itemPick) label += ' [item…]';
                    btn.textContent = label;
                    btn.addEventListener('click', () => {
                        if (choice.itemPick) {
                            this._pendingChoiceIndex = index;
                            this._sig = null;
                            return;
                        }
                        this._sig = null;
                        runner.advance(index);
                    });
                    actions.appendChild(btn);
                });
                if (!choices.length) {
                    const stuck = document.createElement('div');
                    stuck.className = 'dialogue-play-hud__hint';
                    stuck.textContent = 'No available replies';
                    actions.appendChild(stuck);
                }
            }
            panel.appendChild(actions);
        }

        // Mini inventory strip
        const invStrip = document.createElement('div');
        invStrip.className = 'dialogue-play-hud__inv';
        if (invList.length) {
            invStrip.textContent = 'Bag: ' + invList
                .map((r) => `${this._itemLabel(scene, r.itemId)}×${r.count}`)
                .join(', ');
        } else {
            invStrip.textContent = 'Bag: empty';
        }
        panel.appendChild(invStrip);

        root.appendChild(panel);
    }
}
