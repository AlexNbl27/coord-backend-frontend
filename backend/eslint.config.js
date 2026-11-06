const useDbOutsideTenancy = {
  selector: "CallExpression[callee.property.name='useDb'], CallExpression[callee.property.value='useDb'], CallExpression[callee.name='useDb']",
  message: 'useDb est réservé à src/tenancy/ : passer par useTenantDb(slug) ou req.tenant.db.'
};

export default [
  {
    ignores: ['node_modules/**', 'coverage/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-restricted-syntax': ['error', useDbOutsideTenancy]
    }
  },
  {
    files: ['src/tenancy/**/*.js'],
    rules: {
      'no-restricted-syntax': 'off'
    }
  }
];
