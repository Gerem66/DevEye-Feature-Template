import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
    { ignores: ['node_modules', 'types'] },
    { files: ['**/*.{ts,tsx}'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ]
        }
    }
];
