import typescript from '@rollup/plugin-typescript'

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      typescript({
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src'
      })
    ],
    external: ['next', 'webpack', 'fs', 'path']
  },
  // CJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named' // Export as named for proper CommonJS compatibility
    },
    plugins: [
      typescript({
        declaration: false,
        declarationMap: false
      }),
      // Custom plugin to fix CommonJS export for better compatibility
      {
        name: 'fix-cjs-export',
        generateBundle(options, bundle) {
          for (const fileName in bundle) {
            const chunk = bundle[fileName];
            if (chunk.type === 'chunk' && fileName.endsWith('.cjs')) {
              // Add compatibility export at the end
              chunk.code += '\n\n// CommonJS compatibility\nmodule.exports = withDevToolsJSON;\nmodule.exports.default = withDevToolsJSON;\nmodule.exports.withDevToolsJSON = withDevToolsJSON;\n';
            }
          }
        }
      }
    ],
    external: ['next', 'webpack', 'fs', 'path']
  }
]
