/**
 * Utility class for world position calculations
 * Centralizes logic for getting world coordinates of objects and groups
 */
export class WorldPositionUtils {
    /**
     * Rotate a point around a pivot by `deg` degrees clockwise (matches ctx.rotate).
     */
    static rotatePoint(px, py, pivotX, pivotY, deg) {
        if (!deg) return { x: px, y: py };
        const rad = deg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = px - pivotX;
        const dy = py - pivotY;
        return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
    }

    /**
     * Walk the object tree to find target's translation-only ("plain") position plus
     * the chain of rotated ANCESTOR groups above it (target's own rotation is excluded —
     * callers apply that separately). Mirrors exactly how CanvasRenderer composes nested
     * ctx.translate/rotate calls: each group's rotation pivots around the center of its
     * own children (computed in plain, untransformed coordinates — same coordinate space
     * used for every x/y in the tree), and rotations of deeper (more nested) ancestors
     * are meant to be applied to a point BEFORE shallower ones (see _applyRotationChain).
     * @returns {{plainX:number,plainY:number,rotationChain:Array<{pivotX:number,pivotY:number,rotation:number}>}|null}
     *          chain is ordered outermost → innermost ancestor; null if target isn't in the tree.
     */
    static _findPlainPositionAndChain(target, levelObjects) {
        let found = null;

        const dfs = (current, accX, accY, chain) => {
            if (current.id === target.id) {
                found = { plainX: accX + current.x, plainY: accY + current.y, rotationChain: chain };
                return true;
            }
            if (current.type === 'group' && current.children) {
                const nextX = accX + current.x;
                const nextY = accY + current.y;
                let nextChain = chain;
                if (current.rotation) {
                    // Pivot = center of this group's own (rotation-invariant) AABB center,
                    // expressed in the same plain coordinate space as accX/accY.
                    const b = current.getBounds();
                    nextChain = [...chain, {
                        pivotX: accX + (b.minX + b.maxX) / 2,
                        pivotY: accY + (b.minY + b.maxY) / 2,
                        rotation: current.rotation
                    }];
                }
                for (const child of current.children) {
                    if (dfs(child, nextX, nextY, nextChain)) return true;
                }
            }
            return false;
        };

        for (const topObject of levelObjects) {
            if (dfs(topObject, 0, 0, [])) return found;
        }
        return null;
    }

    /**
     * Apply an ancestor rotation chain to a point. Innermost ancestor is applied first,
     * matching the nesting order of ctx.rotate calls in CanvasRenderer (each nested
     * group's rotate composes on top of — i.e. gets carried by — its own parent's).
     */
    static _applyRotationChain(x, y, rotationChain) {
        let px = x, py = y;
        for (let i = rotationChain.length - 1; i >= 0; i--) {
            const r = rotationChain[i];
            const rotated = this.rotatePoint(px, py, r.pivotX, r.pivotY, r.rotation);
            px = rotated.x;
            py = rotated.y;
        }
        return { x: px, y: py };
    }

    static _sumChainRotations(rotationChain) {
        return rotationChain.reduce((sum, r) => sum + r.rotation, 0);
    }

    /**
     * Get world position of an object (including nested groups), accounting for
     * rotated ancestor groups. Returns the world position of the object's own
     * (un-rotated-by-itself) top-left corner.
     * @param {Object} target - Object to find world position for
     * @param {Array} levelObjects - Top-level objects array
     * @returns {Object} World position {x, y}
     */
    static getWorldPosition(target, levelObjects) {
        const found = this._findPlainPositionAndChain(target, levelObjects);
        if (!found) {
            return { x: target.x || 0, y: target.y || 0 };
        }
        return this._applyRotationChain(found.plainX, found.plainY, found.rotationChain);
    }

    /**
     * Get world position plus the total rotation imposed by rotated ancestor groups
     * (NOT including target's own rotation). Needed to compute the object's true
     * on-screen orientation, since composed 2D rotations are additive regardless of
     * how many different pivots were used along the ancestor chain.
     * @returns {{x:number,y:number,ancestorRotation:number}}
     */
    static getWorldTransform(target, levelObjects) {
        const found = this._findPlainPositionAndChain(target, levelObjects);
        if (!found) {
            return { x: target.x || 0, y: target.y || 0, ancestorRotation: 0 };
        }
        const pos = this._applyRotationChain(found.plainX, found.plainY, found.rotationChain);
        return { x: pos.x, y: pos.y, ancestorRotation: this._sumChainRotations(found.rotationChain) };
    }

    /**
     * Rotate a free vector (no pivot) by `deg` degrees clockwise — for converting deltas
     * (e.g. mouse-drag movement) between world space and a rotated local frame.
     */
    static rotateVector(dx, dy, deg) {
        if (!deg) return { x: dx, y: dy };
        const rad = deg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
    }

    /**
     * Sum of rotated-ancestor rotations above `target` (NOT including target's own rotation).
     * Convenience wrapper around getWorldTransform for callers that only need the angle.
     */
    static getAncestorRotation(target, levelObjects) {
        return this.getWorldTransform(target, levelObjects).ancestorRotation;
    }

    /**
     * Convert a WORLD-space movement delta into the LOCAL delta to add to `obj.x/obj.y` so
     * the object actually moves by that world delta on screen. Needed because dragging
     * computes mouse movement in world space, but `obj.x/y` live in its immediate parent's
     * (possibly rotated) local frame — adding a world delta directly only works when every
     * ancestor is unrotated. Composed pure rotations are additive regardless of pivot, so
     * this only needs the SUM of ancestor rotations, inverted.
     */
    static worldDeltaToLocalDelta(dx, dy, obj, levelObjects) {
        const ancestorRotation = this.getAncestorRotation(obj, levelObjects);
        if (!ancestorRotation) return { x: dx, y: dy };
        return this.rotateVector(dx, dy, -ancestorRotation);
    }

    /**
     * Get the exact draw geometry for a rotated frame matching the object's true on-screen
     * shape: half-width/half-height of the UN-rotated-by-itself rect, plus the total
     * rotation (ancestor rotations + object's own) needed to reproduce the rendered
     * orientation exactly. Callers combine this with a separately-computed world CENTER
     * (e.g. from getWorldBounds, which may also include a parallax offset) since the AABB
     * center is invariant to rotation and unaffected by parallax translation.
     * @returns {{halfW:number, halfH:number, rotationDeg:number}}
     */
    static getFrameGeometry(obj, levelObjects) {
        const ancestorRotation = this.getAncestorRotation(obj, levelObjects);
        const ownRotation = obj.rotation || 0;

        if (obj.type !== 'group') {
            return { halfW: (obj.width || 0) / 2, halfH: (obj.height || 0) / 2, rotationDeg: ancestorRotation + ownRotation };
        }

        // Group: use its own UN-rotated local children bounds (exact rigid-body footprint,
        // matching exactly what CanvasRenderer rotates as a whole — see Group.getBounds(true)).
        const localBounds = obj.getBounds(true);
        if (localBounds.minX === Infinity) {
            return { halfW: 0, halfH: 0, rotationDeg: ancestorRotation + ownRotation };
        }
        return {
            halfW: (localBounds.maxX - localBounds.minX) / 2,
            halfH: (localBounds.maxY - localBounds.minY) / 2,
            rotationDeg: ancestorRotation + ownRotation
        };
    }

    /**
     * Convert a WORLD point into coordinates local to `group` (i.e. the (x,y) a NEW child of
     * `group` would need to render at exactly that world point). Accounts for `group`'s own
     * rotation and any rotated ancestors above it — needed when reparenting an object into a
     * rotated group (dragging into its bounds), where a plain translation subtraction would
     * place the object at the wrong spot.
     */
    static worldPointToLocalPointInGroup(worldX, worldY, group, levelObjects) {
        const found = this._findPlainPositionAndChain(group, levelObjects);
        const ancestorChain = found ? found.rotationChain : [];
        const groupPlainX = found ? found.plainX : (group.x || 0);
        const groupPlainY = found ? found.plainY : (group.y || 0);

        // Chain for a CHILD of `group` includes group's own rotation as the innermost link
        // (rotatePoint/rotateVector are no-ops when rotation is 0, so this is safe even for
        // an unrotated group).
        const b = group.getBounds(true); // parent-relative, own rotation excluded
        const pivotX = groupPlainX - group.x + (b.minX + b.maxX) / 2;
        const pivotY = groupPlainY - group.y + (b.minY + b.maxY) / 2;
        const fullChain = [...ancestorChain, { pivotX, pivotY, rotation: group.rotation || 0 }];

        const plain = this._applyInverseRotationChain(worldX, worldY, fullChain);
        return { x: plain.x - groupPlainX, y: plain.y - groupPlainY };
    }

    /**
     * Inverse of _applyRotationChain: undoes the ancestor rotations OUTERMOST-first
     * (mirror image of the forward chain's innermost-first order).
     */
    static _applyInverseRotationChain(x, y, rotationChain) {
        let px = x, py = y;
        for (let i = 0; i < rotationChain.length; i++) {
            const r = rotationChain[i];
            const rotated = this.rotatePoint(px, py, r.pivotX, r.pivotY, -r.rotation);
            px = rotated.x;
            py = rotated.y;
        }
        return { x: px, y: py };
    }

    /**
     * Get AABB of a rectangle rotated around its center
     * @param {number} x - Top-left X
     * @param {number} y - Top-left Y
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {number} deg - Rotation in degrees
     * @returns {Object} Bounds {minX, minY, maxX, maxY}
     */
    static getRotatedRectAABB(x, y, w, h, deg) {
        if (!deg) {
            return { minX: x, minY: y, maxX: x + w, maxY: y + h };
        }
        const rad = deg * Math.PI / 180;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const hw = (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h) / 2;
        const hh = (Math.abs(Math.sin(rad)) * w + Math.abs(Math.cos(rad)) * h) / 2;
        return { minX: cx - hw, minY: cy - hh, maxX: cx + hw, maxY: cy + hh };
    }

    /**
     * Rotate an AABB around its own center (conservative approximation)
     * @param {Object} bounds - Bounds {minX, minY, maxX, maxY}
     * @param {number} deg - Rotation in degrees
     * @returns {Object} Rotated bounds
     */
    static rotateBoundsAroundCenter(bounds, deg) {
        if (!deg || bounds.minX === Infinity) return bounds;
        return this.getRotatedRectAABB(
            bounds.minX, bounds.minY,
            bounds.maxX - bounds.minX, bounds.maxY - bounds.minY,
            deg
        );
    }

    /**
     * Get world bounds of an object or group (rotation-aware, AABB)
     * @param {Object} obj - Object to get bounds for
     * @param {Array} levelObjects - Top-level objects array
     * @param {Array} excludeIds - IDs to exclude from bounds calculation
     * @param {boolean} skipOwnRotation - Return the unrotated rect (used to draw rotated outlines)
     * @returns {Object} Bounds {minX, minY, maxX, maxY}
     */
    static getWorldBounds(obj, levelObjects, excludeIds = [], skipOwnRotation = false) {
        // Skip if object is in exclude list
        if (excludeIds.includes(obj.id)) {
            return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        }

        const found = this._findPlainPositionAndChain(obj, levelObjects);
        const chain = found ? found.rotationChain : [];
        const ancestorRotation = this._sumChainRotations(chain);

        if (obj.type !== 'group') {
            // Simple object: the AABB center is invariant to the object's OWN rotation,
            // so carry the plain (un-rotated-by-self) center through the ancestor chain to
            // get its true world center, then rotate the rect by the combined angle —
            // composed 2D rotations are additive regardless of how many different pivots
            // were used along the chain, so this reproduces the exact on-screen orientation.
            const plainX = found ? found.plainX : (obj.x || 0);
            const plainY = found ? found.plainY : (obj.y || 0);
            const w = obj.width || 0;
            const h = obj.height || 0;
            const centerWorld = this._applyRotationChain(plainX + w / 2, plainY + h / 2, chain);
            const ownRotation = skipOwnRotation ? 0 : (obj.rotation || 0);
            return this.getRotatedRectAABB(centerWorld.x - w / 2, centerWorld.y - h / 2, w, h, ancestorRotation + ownRotation);
        }

        // Group object - calculate bounds from all children.
        // Bounds relative to the group's parent frame: includes group.x/group.y
        // and the group's own rotation (applied as conservative AABB rotation).
        const localBounds = (current) => {
            if (excludeIds.includes(current.id)) {
                return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            }

            if (current.type !== 'group' || !current.children) {
                return this.getRotatedRectAABB(current.x, current.y, current.width || 0, current.height || 0, current.rotation || 0);
            }

            let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            for (const child of current.children) {
                const cb = localBounds(child);
                if (cb.minX === Infinity) continue;
                bounds.minX = Math.min(bounds.minX, current.x + cb.minX);
                bounds.minY = Math.min(bounds.minY, current.y + cb.minY);
                bounds.maxX = Math.max(bounds.maxX, current.x + cb.maxX);
                bounds.maxY = Math.max(bounds.maxY, current.y + cb.maxY);
            }

            // If group has no visible children, use its own position
            if (bounds.minX === Infinity) {
                bounds = { minX: current.x, minY: current.y, maxX: current.x, maxY: current.y };
            }

            // Top-level group rotation can be skipped to get the unrotated rect
            const ownRotation = (skipOwnRotation && current.id === obj.id) ? 0 : (current.rotation || 0);
            return this.rotateBoundsAroundCenter(bounds, ownRotation);
        };

        // localBounds is in obj's PARENT-local (plain, ancestor-rotation-unaware) frame,
        // already including obj's own rotation. Shift it to plain world coordinates, then
        // — if any ancestor above obj is rotated — carry its four corners through the
        // ancestor chain (same cascaded rotation the renderer applies) for a corrected AABB.
        const plainX = found ? found.plainX : (obj.x || 0);
        const plainY = found ? found.plainY : (obj.y || 0);
        const bounds = localBounds(obj);
        const offsetX = plainX - obj.x;
        const offsetY = plainY - obj.y;
        const plainWorldBounds = {
            minX: bounds.minX + offsetX,
            minY: bounds.minY + offsetY,
            maxX: bounds.maxX + offsetX,
            maxY: bounds.maxY + offsetY
        };

        if (chain.length === 0 || plainWorldBounds.minX === Infinity) {
            return plainWorldBounds;
        }

        const corners = [
            { x: plainWorldBounds.minX, y: plainWorldBounds.minY },
            { x: plainWorldBounds.maxX, y: plainWorldBounds.minY },
            { x: plainWorldBounds.maxX, y: plainWorldBounds.maxY },
            { x: plainWorldBounds.minX, y: plainWorldBounds.maxY }
        ].map(p => this._applyRotationChain(p.x, p.y, chain));

        return {
            minX: Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x),
            minY: Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y),
            maxX: Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x),
            maxY: Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y)
        };
    }

    /**
     * Return the "reference center" of `obj` in its PARENT's local coordinate frame,
     * plus the offset (offX, offY) from obj.x/obj.y to that center.
     *
     *  - Simple objects : center = (obj.x + w/2, obj.y + h/2)
     *  - Groups         : center = center of getBounds(true)
     *                     (unrotated children bounds, already in parent-local frame)
     *
     * This center is ROTATION-INVARIANT — it doesn't move when obj.rotation changes —
     * so it can safely be used as the stable "world anchor" during reparenting.
     */
    static getLocalCenter(obj) {
        if (obj.type === 'group') {
            const b = obj.getBounds(true); // parent-local, includes obj.x/y
            if (b.minX === Infinity) {
                return { x: obj.x, y: obj.y, offX: 0, offY: 0 };
            }
            const cx = (b.minX + b.maxX) / 2;
            const cy = (b.minY + b.maxY) / 2;
            return { x: cx, y: cy, offX: cx - obj.x, offY: cy - obj.y };
        }
        const offX = (obj.width  || 0) / 2;
        const offY = (obj.height || 0) / 2;
        return { x: obj.x + offX, y: obj.y + offY, offX, offY };
    }

    /**
     * Return the world-space center of `obj` (rotation-invariant anchor) and the
     * total accumulated rotation (all ancestor rotations + obj's own rotation).
     *
     * Math:  center_plain  = plainX - obj.x + lc.x  (works for simple objects and groups)
     *        worldCenter   = _applyRotationChain(center_plain)
     *        accumulatedRotation = sum(chain) + obj.rotation
     *
     * @returns {{ x:number, y:number, accumulatedRotation:number }}
     */
    static getWorldCenterAndRotation(obj, levelObjects) {
        const found = this._findPlainPositionAndChain(obj, levelObjects);
        const chain  = found ? found.rotationChain : [];
        const plainX = found ? found.plainX : (obj.x || 0);
        const plainY = found ? found.plainY : (obj.y || 0);
        const lc = this.getLocalCenter(obj);
        // Unified formula valid for both simple objects and groups:
        //   simple : lc.x = obj.x + w/2  →  plainX - obj.x + lc.x = plainX + w/2
        //   group  : lc.x = bounds_center (parent-local, includes obj.x)
        //                                 →  plainX - obj.x + lc.x = accumulated_parent + bounds_center
        const cx_plain = plainX - obj.x + lc.x;
        const cy_plain = plainY - obj.y + lc.y;
        const wc = this._applyRotationChain(cx_plain, cy_plain, chain);
        return {
            x: wc.x,
            y: wc.y,
            accumulatedRotation: this._sumChainRotations(chain) + (obj.rotation || 0)
        };
    }

    /**
     * After group.children has changed (child added or removed), adjust group.x/y
     * so that ALL remaining children stay visually where they were.
     *
     * When a group's children change, the "pivot" (center of children bounds) shifts
     * by Δ = P_new − P_old (both in G-local space).  Every rendered child drifts by
     * (I − R)·Δ in parent space.  Translating the group by −(I − R)·Δ cancels that
     * drift for ALL children simultaneously (the correction is point-independent).
     *
     *   G.x −= (1 − cosθ)·Δx + sinθ·Δy
     *   G.y −= −sinθ·Δx  + (1 − cosθ)·Δy
     *
     * No-op when group has no rotation (no drift possible).
     *
     * @param {Object}        group       - The group whose children just changed.
     * @param {{ x, y }}      pOldGLocal  - G-local pivot BEFORE the structural change.
     *                                      Capture as getGroupLocalPivot(group) before touching children.
     */
    static applyGroupPivotCompensation(group, pOldGLocal) {
        if (!group.rotation) return;
        const b = group.getBounds();
        if (b.minX === Infinity) return;
        const Δx = (b.minX + b.maxX) / 2 - group.x - pOldGLocal.x;
        const Δy = (b.minY + b.maxY) / 2 - group.y - pOldGLocal.y;
        if (Δx === 0 && Δy === 0) return;
        const cos = Math.cos(group.rotation * Math.PI / 180);
        const sin = Math.sin(group.rotation * Math.PI / 180);
        group.x -= (1 - cos) * Δx + sin * Δy;
        group.y -= -sin * Δx + (1 - cos) * Δy;
    }

    /**
     * Return the G-local pivot of group G (center of its current children's bounding
     * box minus G.x/G.y).  Must be called BEFORE modifying G.children.
     */
    static getGroupLocalPivot(group) {
        const b = group.getBounds();
        if (b.minX === Infinity) return { x: 0, y: 0 };
        return {
            x: (b.minX + b.maxX) / 2 - group.x,
            y: (b.minY + b.maxY) / 2 - group.y
        };
    }

    /**
     * Get center point of an object in world coordinates
     * @param {Object} obj - Object to get center for
     * @param {Array} levelObjects - Top-level objects array
     * @returns {Object} Center position {x, y}
     */
    static getWorldCenter(obj, levelObjects) {
        const pos = this.getWorldPosition(obj, levelObjects);
        return {
            x: pos.x + (obj.width || 0) / 2,
            y: pos.y + (obj.height || 0) / 2
        };
    }

    /**
     * Check if a point is inside object bounds in world coordinates
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     * @param {Object} obj - Object to check
     * @param {Array} levelObjects - Top-level objects array
     * @returns {boolean} True if point is inside object
     */
    /**
     * True if (px,py) is inside the rect, OR within `tolerance` world units of its
     * nearest edge/corner — i.e. the click POINT is expanded into a disk of radius
     * `tolerance` and tested against the rect (Euclidean distance), not the rect
     * expanded into a bigger box (which would over-forgive corners: a square/per-axis
     * expansion lets clicks up to tolerance·√2 away from a corner still hit, whereas
     * a genuine "point within N px of the shape" check keeps corners circular).
     */
    static _pointNearRect(px, py, minX, minY, maxX, maxY, tolerance) {
        const clampedX = Math.min(Math.max(px, minX), maxX);
        const clampedY = Math.min(Math.max(py, minY), maxY);
        const dx = px - clampedX;
        const dy = py - clampedY;
        return dx * dx + dy * dy <= tolerance * tolerance;
    }

    /**
     * True if the axis-aligned rect [minX,minY,maxX,maxY] intersects the (possibly
     * rotated) rectangle described by `geom` (as returned by getHitTestGeometry) — exact
     * polygon-vs-polygon test via the Separating Axis Theorem, not a bounding-box
     * approximation. Used by marquee-drag selection so dragging a selection box near a
     * rotated object's AABB corner (but outside its true rotated shape) correctly excludes
     * it, matching what clicking that same point would do.
     */
    static rectIntersectsGeometry(minX, minY, maxX, maxY, geom) {
        const rectCorners = [
            { x: minX, y: minY }, { x: maxX, y: minY },
            { x: maxX, y: maxY }, { x: minX, y: maxY }
        ];

        const rad = geom.rotationDeg * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const local = [
            { x: -geom.halfW, y: -geom.halfH }, { x: geom.halfW, y: -geom.halfH },
            { x: geom.halfW, y: geom.halfH }, { x: -geom.halfW, y: geom.halfH }
        ];
        const rotCorners = local.map(p => ({
            x: geom.cx + p.x * cos - p.y * sin,
            y: geom.cy + p.x * sin + p.y * cos
        }));

        const axes = geom.rotationDeg
            ? [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: cos, y: sin }, { x: -sin, y: cos }]
            : [{ x: 1, y: 0 }, { x: 0, y: 1 }];

        const project = (corners, ax, ay) => {
            let min = Infinity, max = -Infinity;
            for (const c of corners) {
                const p = c.x * ax + c.y * ay;
                if (p < min) min = p;
                if (p > max) max = p;
            }
            return { min, max };
        };

        for (const axis of axes) {
            const a = project(rectCorners, axis.x, axis.y);
            const b = project(rotCorners, axis.x, axis.y);
            if (a.max < b.min || b.max < a.min) return false; // separating axis found
        }
        return true;
    }

    /**
     * Single source of truth for the exact rectangle isPointInWorldBounds tests against
     * (center + half-extents + rotation, all in world space) — also used by the
     * "Object Boundaries" debug overlay (RenderOperations.drawSingleObjectBoundary) so the
     * two can NEVER visually diverge from what's actually clickable, by construction.
     * @returns {{cx:number, cy:number, halfW:number, halfH:number, rotationDeg:number}}
     */
    static getHitTestGeometry(obj, levelObjects) {
        const found = this._findPlainPositionAndChain(obj, levelObjects);
        const chain = found ? found.rotationChain : [];
        const ancestorRotation = this._sumChainRotations(chain);
        const ownRotation = obj.rotation || 0;
        const totalRotation = ancestorRotation + ownRotation;

        if (!totalRotation) {
            const bounds = this.getWorldBounds(obj, levelObjects);
            return {
                cx: (bounds.minX + bounds.maxX) / 2,
                cy: (bounds.minY + bounds.maxY) / 2,
                halfW: (bounds.maxX - bounds.minX) / 2,
                halfH: (bounds.maxY - bounds.minY) / 2,
                rotationDeg: 0
            };
        }

        let w, h, center;
        if (obj.type !== 'group') {
            // Simple object with known width/height
            const plainX = found ? found.plainX : (obj.x || 0);
            const plainY = found ? found.plainY : (obj.y || 0);
            w = obj.width || 0;
            h = obj.height || 0;
            center = this._applyRotationChain(plainX + w / 2, plainY + h / 2, chain);
        } else {
            // Group with rotation: getWorldBounds(..., skipOwnRotation=true) is NOT the
            // right box here — once obj has a rotated ancestor, that path re-bounds the
            // box's 4 corners through the ancestor chain (for accurate frame-drawing),
            // producing an AABB-of-a-rotated-rect that's inflated relative to the true
            // rect whenever ancestorRotation isn't a multiple of 90°. Inverse-rotating the
            // click point by the FULL totalRotation and testing against that inflated box
            // double-counts the ancestor rotation. Instead, mirror the simple-object branch
            // above: use the tight box with NO rotation baked in at all (own OR ancestor)
            // via getLocalCenter()/getBounds(true), and inverse-rotate by totalRotation.
            const lc = this.getLocalCenter(obj);
            const b = obj.getBounds(true);
            w = b.maxX - b.minX;
            h = b.maxY - b.minY;
            const plainX = found ? found.plainX : (obj.x || 0);
            const plainY = found ? found.plainY : (obj.y || 0);
            center = this._applyRotationChain(plainX - obj.x + lc.x, plainY - obj.y + lc.y, chain);
        }

        return { cx: center.x, cy: center.y, halfW: w / 2, halfH: h / 2, rotationDeg: totalRotation };
    }

    static isPointInWorldBounds(x, y, obj, levelObjects, tolerance = 0) {
        // Precise test for rotated objects: inverse-rotate the point (by the TOTAL
        // rotation — rotated ancestors plus the object's own) around its true world
        // center, then test against the unrotated rect — the click point itself is what
        // `tolerance` expands (see _pointNearRect), matching how a mouse click is
        // forgiven in screen space regardless of the object's shape/rotation.
        const geom = this.getHitTestGeometry(obj, levelObjects);

        const rad = -geom.rotationDeg * Math.PI / 180;
        const dx = x - geom.cx;
        const dy = y - geom.cy;
        const lx = geom.cx + dx * Math.cos(rad) - dy * Math.sin(rad);
        const ly = geom.cy + dx * Math.sin(rad) + dy * Math.cos(rad);

        return this._pointNearRect(
            lx, ly,
            geom.cx - geom.halfW, geom.cy - geom.halfH,
            geom.cx + geom.halfW, geom.cy + geom.halfH,
            tolerance
        );
    }

    /**
     * Snap coordinates to grid
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} gridSize - Grid size in pixels
     * @returns {Object} Snapped coordinates {x, y}
     */
    static snapToGrid(x, y, gridSize) {
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }
}
