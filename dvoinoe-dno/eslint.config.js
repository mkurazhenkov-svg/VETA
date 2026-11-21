import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Инвариант: доменная логика не зависит от рендера, UI, Ink и DOM.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['pixi.js', 'pixi.js/*', '@pixi/*'], message: 'domain/ не импортирует pixi.js' },
            { group: ['preact', 'preact/*', '@preact/*'], message: 'domain/ не импортирует preact' },
            { group: ['inkjs', 'inkjs/*'], message: 'domain/ не импортирует inkjs' },
            { group: ['**/scene/**', '**/ui/**', '**/ink/**', '**/store/**', '**/audio/**'], message: 'domain/ не зависит от слоёв сцены и UI' },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'indexedDB', 'navigator'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Случайность только через rng из состояния' },
        { object: 'Date', property: 'now', message: 'Время только игровое, из журнала' },
      ],
    },
  },
);
