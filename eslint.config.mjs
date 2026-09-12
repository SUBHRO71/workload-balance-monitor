import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "**/.turbo/**", "**/cdk.out/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/{contracts,domain,api-client,design-tokens,ui-web,ui-native}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@workload/backend-core", "@workload/backend-core/*", "**/backend-core/**", "**/services/**", "**/infra/**", "@aws-sdk/*", "aws-cdk-lib", "aws-cdk-lib/*"],
          message: "Client-safe code must not import backend implementations or infrastructure." }
      ] }]
    }
  }
);
