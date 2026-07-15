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
        // LevelEditor still exceeds import/max-dependencies after controller extract.
        // TODO remove override when remaining one-line delegates move out.
        files: ['src/core/LevelEditor.js'],
        rules: {
            'import/max-dependencies': 'off'
        }
    }
];
