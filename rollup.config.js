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
      exports: 'named'
    },
    plugins: [
      typescript({
        declaration: false
      })
    ],
    external: ['next', 'webpack', 'fs', 'path']
  }
]
