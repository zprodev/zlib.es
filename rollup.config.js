export default {
  input: 'tsc/zlib.js',
  output: [
    {
      file: 'dist/zlib.js',
      format: 'iife',
      name: 'zlibes'
    },
    {
      file: 'lib/zlib.js',
      format: 'cjs',
    },
    {
      file: 'lib/zlib.mjs',
      format: 'es',
    }
  ]
};