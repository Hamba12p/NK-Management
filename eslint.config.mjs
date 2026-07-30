import nextPlugin from 'eslint-config-next'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextPlugin,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/no-children-prop': 'warn',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-uses-react': 'warn',
      'react/jsx-uses-vars': 'warn',
      'no-undef': 'off', // TypeScript already catches this; the base JS rule false-positives on TS-only globals
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@next/next/no-html-link-for-pages': 'off',
      quotes: ['warn', 'single', { avoidEscape: true }],
    },
  },
]

export default eslintConfig
