import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import postcss from "rollup-plugin-postcss";

const commonOptions = {
  input: "src/index.ts",
  external: (id) => !/^[./]/.test(id) && !/^@\//.test(id),
};

export default [
  {
    ...commonOptions,
    plugins: [
      postcss({
        extract: false,
        inject: true,
        minimize: true,
      }),
      esbuild(),
    ],
    output: [
      {
        dir: `dist`,
        format: "es",
        sourcemap: true,
        preserveModules: true,
        entryFileNames: "[name].js",
      },
    ],
  },
  {
    ...commonOptions,
    plugins: [postcss(), dts()],
    output: {
      file: `dist/src/index.d.ts`,
      format: "es",
    },
  },
];
