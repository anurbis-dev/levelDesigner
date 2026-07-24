# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: navMesh (§7 Tier 4, v4.48.0)**: Component `navMesh` + `NavMeshBehavior` — walkable AABB zone (shape fields, never solid) with grid A* pathfinding. Props: `cellSize` (default 16), `blocked` (asset-local rect holes), optional `navMeshAssetId` (catalog merge for cellSize/blocked), `enabled`. Duck-types `containsWorldPoint` / `findPath`; static `findPathInScene`. `StateMachineBehavior` chase follows nav path when a covering mesh exists, else straight-line. `DEFAULT_ASSET_COMPONENTS.navMesh`. Tests: NavMeshBehavior, StateMachineBehavior, GameEngine.integration.
