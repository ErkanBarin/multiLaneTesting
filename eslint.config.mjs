// ESLint flat config — multilanetesting. Enforces the determinism rules in code.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'results/**', 'artifacts/**', 'graphify-out/**', '**/*.d.ts'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Determinism: no manual sleeps anywhere in specs/drivers.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message: 'No waitForTimeout — wait on the object/state channel instead.',
        },
        {
          selector: "CallExpression[callee.name='sleep']",
          message: 'No sleep() — wait on the object/state channel instead.',
        },
      ],
      // No focused/skipped specs left in the tree.
      'no-restricted-properties': [
        'error',
        { object: 'test', property: 'only', message: 'Remove test.only before committing.' },
        { object: 'describe', property: 'only', message: 'Remove describe.only before committing.' },
      ],
    },
  },
);
