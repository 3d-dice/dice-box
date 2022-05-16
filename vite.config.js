const path = require("path");
const { defineConfig } = require("vite");
const copy = require("rollup-plugin-copy");
// const { visualizer } = require('rollup-plugin-visualizer');

module.exports = defineConfig({
  base: process.env.NODE_ENV === "production" ? "./" : "./src",
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.js"),
      name: "dice-box",
      fileName: (format) => `dice-box.${format}.js`,
    },
    assetsDir: "assets/dice-box",
    rollupOptions: {
      preserveEntrySignatures: "allow-extension",
      input: {
        main: path.resolve(__dirname, "src/index.js"),
      },
      output: [
        {
          format: "es",
          manualChunks: {
            // babylon: ['@babylonjs/core','@babylonjs/loaders','@babylonjs/materials']
          },
          sourcemap: false,
        },
      ],
      plugins: [
        copy({
          targets: [
            {
              // src: path.resolve(__dirname, 'src/assets/*'),
              src: [
                path.resolve(__dirname, "src/assets/ammo"),
                path.resolve(__dirname, "src/assets/models"),
                path.resolve(__dirname, "src/assets/themes"),
              ],
              dest: path.resolve(__dirname, "dist/assets/dice-box"),
            },
          ],
          hook: "writeBundle",
        }),
        // visualizer({
        // 	open: true,
        // 	brotliSize: true
        // })
      ],
    },
  },
});
