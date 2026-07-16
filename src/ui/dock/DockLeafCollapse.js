/**
 * DK-CLP: dock leaf accordion collapse in column stacks.
 * Pure tree helpers (no DOM); used by DockTreeModel / DockRenderer.
 */

/** Immediate parent split of leaf id, or null if root / missing. */
export function findParentOfLeaf(node, id) {
    if (!node || node.type === 'leaf') return null;
    for (const c of node.children) {
        if (c.type === 'leaf' && c.id === id) return node;
        if (c.type === 'split') {
            const found = findParentOfLeaf(c, id);
            if (found) return found;
        }
    }
    return null;
}

/** Collapsed leaf, or split whose both children are fully collapsed. */
export function isNodeCollapsed(node) {
    if (!node) return true;
    if (node.type === 'leaf') return !!node.collapsed;
    return isNodeCollapsed(node.children[0]) && isNodeCollapsed(node.children[1]);
}

/**
 * Clear collapsed flags invalid after restructure (only column siblings may stay collapsed).
 * @param {object|null} node
 * @param {'row'|'column'|null} parentDirection
 */
export function sanitizeCollapsedFlags(node, parentDirection = null) {
    if (!node) return;
    if (node.type === 'leaf') {
        if (node.collapsed && parentDirection !== 'column') node.collapsed = false;
        return;
    }
    sanitizeCollapsedFlags(node.children[0], node.direction);
    sanitizeCollapsedFlags(node.children[1], node.direction);
}

/**
 * @param {object|null} tree
 * @param {string} leafId
 * @param {(node: object, id: string) => object|null} findNode
 */
export function canToggleLeafCollapse(tree, leafId, findNode) {
    if (!tree) return false;
    const leaf = findNode(tree, leafId);
    if (!leaf || leaf.type !== 'leaf') return false;
    const parent = findParentOfLeaf(tree, leafId);
    if (!parent || parent.type !== 'split' || parent.direction !== 'column') return false;
    if (leaf.collapsed) return true;
    const sibling = parent.children[0] === leaf
        || (parent.children[0].type === 'leaf' && parent.children[0].id === leafId)
        ? parent.children[1]
        : parent.children[0];
    return !isNodeCollapsed(sibling);
}

/**
 * @param {object|null} tree
 * @param {string} leafId
 * @param {(node: object, id: string) => object|null} findNode
 * @returns {boolean}
 */
export function toggleLeafCollapse(tree, leafId, findNode) {
    if (!canToggleLeafCollapse(tree, leafId, findNode)) return false;
    const leaf = findNode(tree, leafId);
    if (!leaf) return false;
    leaf.collapsed = !leaf.collapsed;
    return true;
}
