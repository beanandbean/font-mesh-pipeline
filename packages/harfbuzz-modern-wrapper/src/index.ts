export * from "./harfbuzz";
export { default } from "./harfbuzz";

export * from "./geom_cache";

// tsc emits emulated ES-modules by default;
// this snippet makes it a standard commonjs module
// for commonjs and native ESM interop.
// we could do this for every module but
// for now this is only applied to `index.ts`
declare let exports: any;
declare const module: { exports: any };
Object.defineProperties(
  exports.default,
  Object.getOwnPropertyDescriptors(exports)
);
exports = module.exports = exports.default;
