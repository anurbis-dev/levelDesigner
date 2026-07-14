import importPlugin from 'eslint-plugin-import';

export default [
    {
        files: ['src/**/*.js'],
        plugins: { import: importPlugin },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module'
        },
        rules: {
            'import/max-dependencies': ['error', { max: 20 }]
        }
    },
    {
        // Фаза 3 (см. tmp/2D_Editor_REFACTOR_PLAN.md) extracted EditorConfigController/
        // EditorLifecycleController/EditorPreferencesController — 46 imports -> 34. Still
        // over the 20 limit (tree-search helpers, player-start tracking, and ~30 one-line
        // delegate methods remain un-extracted, out of Фаза 3's explicit scope — logged as
        // backlog for a future pass, not a new named phase). TODO remove override once those
        // move out too.
        files: ['src/core/LevelEditor.js'],
        rules: {
            'import/max-dependencies': 'off'
        }
    }
];
