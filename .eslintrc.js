module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:@typescript-eslint/recommended', './.eslintrc.json'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/class-name-casing': 'error',
    '@typescript-eslint/ban-ts-ignore': 'error',
    '@typescript-eslint/no-angle-bracket-type-assertion': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
  },
};
