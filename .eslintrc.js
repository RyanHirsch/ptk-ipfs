/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
  },
  plugins: ["import", "@typescript-eslint", "sonarjs"],
  extends: [
    "airbnb-base",
    "airbnb-typescript/base",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "plugin:prettier/recommended",
    "plugin:sonarjs/recommended",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
      },
    ],
    "no-plusplus": "off",
    "import/prefer-default-export": "off",
    "import/newline-after-import": "error",
    "import/order": [
      "error",
      {
        "newlines-between": "always",
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
        pathGroups: [
          {
            pattern: "types",
            group: "internal",
          },
          {
            pattern: "lib/**",
            group: "internal",
          },
          {
            pattern: "pages/**",
            group: "internal",
          },
          {
            pattern: "components/**",
            group: "internal",
          },
          {
            pattern: "client-utils/**",
            group: "internal",
          },
          {
            pattern: "server-utils/**",
            group: "internal",
          },
        ],
      },
    ],
    "no-return-await": "off",
    "@typescript-eslint/return-await": ["error", "in-try-catch"],
    "@typescript-eslint/consistent-type-imports": "error",
    "no-console": "off",
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: ["**/*.test.*", "**/__tests__/**", "**/testUtils.*", "**/__mocks__/**"],
        includeTypes: false,
      },
    ],
  },
  overrides: [
    {
      files: ["**/*.test.tsx", "**/*.test.ts"],
      rules: {
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-var-requires": "off",
        "sonarjs/no-duplicate-string": "off",
        "sonarjs/no-identical-functions": "off",
      },
    },
  ],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "./",
      },
    },
  },
};
