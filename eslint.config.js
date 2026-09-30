import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/",
    "**/build/",
    "**/dist/",
    "**/.wrangler/",
    "**/.react-router/",
    "**/worker-configuration.d.ts",
    "**/coverage/",
    "**/playwright-report/",
    "**/test-results/",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["apps/web/app/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      "**/*.config.{js,ts}",
      "eslint.config.js",
      "apps/api/seeds/**",
      "apps/api/scripts/**",
    ],
    languageOptions: { globals: globals.node },
  },
]);
