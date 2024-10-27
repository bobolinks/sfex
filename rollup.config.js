// import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default [
  {
		input: 'src/export.ts',
		plugins: [
      typescript(),
      json(),
		],
		output: [
			{
				format: 'esm',
				file: 'dist/index.module.js',
        sourcemap: true,
			}
		]
	},
	{
		input: 'src/export.ts',
		plugins: [
      typescript(),
      json(),
		],
		output: [
			{
				format: 'cjs',
				file: 'dist/index.cjs',
        sourcemap: true,
			}
		]
	},
];
