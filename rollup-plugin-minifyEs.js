import { transform } from 'esbuild';

export default function () {
  return {
    name: 'minifyEs',
    renderChunk: async (code, chunk, outputOptions) => {
      if (outputOptions.format === 'es' && chunk.fileName.endsWith('.min.js')) {
        const output = await transform(code, { minify: true });
        return output
      }
      return code;
    }
  };
}