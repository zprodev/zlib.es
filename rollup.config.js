export default {
  input: 'dist/tsc/zlib.js',
  output: [
    {
      file: 'dist/browser/zlib.js',
      format: 'iife',
      name: 'zlibes'
    },
    {
      file: 'dist/cjs/zlib.js',
      format: 'cjs',
    },
    {
      file: 'dist/esm/zlib.js',
      format: 'es',
    }
  ]
};