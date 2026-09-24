import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Node's JSON.parse error message quotes its input, so secret data goes through
    // safeParseJson (src/lib/json.ts) only.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/json.ts', 'src/lib/config.ts', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
          message: 'Use safeParseJson from @/lib/json for anything that may hold secret data.',
        },
        {
          // request.json() / response.json() echo the body in their parse error too.
          selector: "CallExpression[callee.property.name='json'][arguments.length=0]",
          message: 'Read the body with .text() and parse it with safeParseJson.',
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
