import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
    },
  },
  entry: ['src/index.ts', 'src/client.ts'],
  format: ['cjs', 'esm'],
  target: 'esnext',
  outDir: 'dist',
});
