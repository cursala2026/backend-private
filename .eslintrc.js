module.exports = {
  extends: [
    'airbnb-base',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2020: true,
  },
  ignorePatterns: ['build.ts'],
  rules: {
    'no-console': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'no-underscore-dangle': 'off',
    'class-methods-use-this': 'off',
    'no-param-reassign': 'off',
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-useless-constructor': 'off',
    'no-empty-function': ['error', { allow: ['constructors'] }],
    'consistent-return': 'off',
    'no-shadow': 'off',
    'no-redeclare': 'off',
  },
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['src/controllers/**/*.ts'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['src/repositories/**/*.ts'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['src/services/**/*.ts'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['src/models/**/*.ts'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['src/config/errors/error-handler.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-unused-vars': 'off',
      },
    },
    {
      files: ['src/utils/fileUpload.util.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['src/express/server.ts'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['src/middlewares/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['**/__tests__/**/*', '**/*.spec.ts', '**/*.test.ts'],
      rules: {
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      },
    },
    {
      files: ['**/__tests__/**/*', '**/*.spec.ts', '**/*.test.ts', 'jest.setup.ts'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['src/types/**/*.d.ts'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};