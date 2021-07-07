module.exports = {
  env: {
    es6: true,
    node: true,
    mocha: true,
  },
  extends: ["airbnb-base"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    quotes: ["error", "single"],
    "no-plusplus": 0,
    "no-await-in-loop": 0,
    "prefer-default-export": 0,
    "import/extensions": 0,
    "import/prefer-default-export": 0,
    "class-methods-use-this": 0,
    "import/no-unresolved": 0,
    "no-unused-vars": 0,
    "max-len": ["error", { code: 180 }],
    "no-param-reassign": 0,
    "guard-for-in": "off",
    "no-return-assign": 0,
    "no-prototype-builtins": 0,
    "operator-linebreak": 0,
  },
  settings: {
    "import/extensions": [".js", ".jsx", ".ts", ".tsx"],
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    },
  },
};
