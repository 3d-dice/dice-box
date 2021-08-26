const path = require('path')
const { defineConfig } = require('vite')
const copy = require('rollup-plugin-copy')

module.exports = defineConfig({
	base: process.env.NODE_ENV === 'production' ? './' : './src',
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'dice-box',
      fileName: (format) => `dice-box.${format}.js`
    },
    rollupOptions: {
      input: {
				main: path.resolve(__dirname, 'src/index.js')
			},
			plugins: [
				copy({
					targets: [
						{
							// src: path.resolve(__dirname, 'src/assets/*'),
							src: [
								path.resolve(__dirname, 'src/assets/models'),
								path.resolve(__dirname, 'src/assets/themes')
							],
							dest: path.resolve(__dirname, 'dist/assets')
						}
					],
					hook: "writeBundle"
				})
			]
    },
  }
})