import dts from "rollup-plugin-dts"
import esbuild from "rollup-plugin-esbuild"
import postcss from "rollup-plugin-postcss"
import url from "@rollup/plugin-url"

const commonOptions = {
  input: "src/index.ts",
  external: (id) => !/^[./]/.test(id) && !/^@\//.test(id),
}

export default [
  {
    ...commonOptions,
    plugins: [
      url({
        include: ["**/*.webp", "**/*.png", "**/*.jpg", "**/*.svg"],
      }),
      postcss({
        extract: true,
        inject: false,
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
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    ],
  },
  {
    ...commonOptions,
    plugins: [
      url({
        include: ["**/*.webp", "**/*.png", "**/*.jpg"],
      }),
      postcss(),
      dts(),
    ],
    output: {
      file: `dist/src/index.d.ts`,
      format: "es",
    },
  },
]
