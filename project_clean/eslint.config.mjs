import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // These React Compiler rules remain visible as warnings during the
    // hardening release. They describe performance/refactoring opportunities
    // in established components; they are not TypeScript or production-build
    // failures. They will be resolved in the dedicated performance sprint.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
    },
  },  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
