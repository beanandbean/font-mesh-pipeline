# harfbuzz-modern-wrapper

A TypeScript wrapper for the [HarfBuzz text shaping engine](https://harfbuzz.github.io/), via the official JavaScript binding [harfbuzz/harfbuzzjs](https://github.com/harfbuzz/harfbuzzjs). This implementation also integrates the [Unicode Bidirectional Algorithm](https://unicode.org/reports/tr9/) via [bidi-js](https://github.com/lojjic/bidi-js).

## The HarfBuzz singleton

The HarfBuzz singleton is accessed through
```typescript
import harfbuzz from "harfbuzz-modern-wrapper";
```

This object boots up the HarfBuzz web assembly instance and manages all raw pointers exposed by it.

### Initialisation

To check whether the web assembly instance has been initialized, either check the return value of the sync method `harfbuzz.ready()`, or wait until the async `harfbuzz.init()` method returns.

The web assembly instance is automatically fetched on module load and `harfbuzz.init()` does nothing more than simply waiting for the initialisation to complete. Thus it is safe to invoke this at multiple locations in client code.

### Manage fonts

The following method on the singleton exposes a font to the HarfBuzz instance:
```typescript
createFont(id: string, data: Uint8Array, index: number = 0): Font | undefined
```
Here, `id` is an arbitrary identifier (any previously registered font with the same identifier will automatically be freed), `data` is the content of any file type supported by the HarfBuzz engine and `index` locates a specific font face when the provided file is a TrueType/OpenType Collection.

A registered font instance can be requested through `harfbuzz.getFont(id)` and, when no longer in use, it can be freed by `harfbuzz.freeFont(id)`. Use `harfbuzz.fontIds` to access a list of all currently registered fonts.

### Text shaping

A font instance exposes the following signature for text shaping:
```typescript
type GlyphLayout = { id: number; base: { x: number; y: number } };
Font.shape(text: string): { glyphs: GlyphLayout[]; bounds: { width: number; height: number } };
```

This will convert a Unicode string to a sequence of glyphs in the font file. As per implementation of the HarfBuzz engine, the anchor points of the glyphs will be sorted in a left-to-right order, even if the input text is using a right-to-left script.

Use the methods `font.glyphName(id)` and `font.glyphGeometry(id)` to retrieve information about each specific glyph. The latter will return a sequence of [SVG path commands](https://svgwg.org/specs/paths/#PathData). It is guaranteed that only commands of types `M`, `L`, `Q`, `C` and `Z` will be generated.

All coordinates will be given using the internal metrics defined by the font file. To convert them for display, scale all numbers by a ratio of `fontSize / shapingResult.bounds.height`).

## Glyph Geometry Cache

The glyph geometry cache is a utility to cache the geometric data of each glyph, should you run any post-processing on the retrieved SVG commands — for example, to cache the results of triangulation. A typical invocation looks like the following:

```typescript
import { GlyphGeometryCache, GlyphGeometryFactory } from "harfbuzz-modern-wrapper";

const geometryFactory: GlyphGeometryFactory<T> = (paths, upem) => {
  // analyse `paths` and build a geometry object of type `T`
};
const geometryCache = new GlyphGeometryCache(font, geometryFactory);
```

Now, `geometryCache.glyphGeometry(id)` can be used in place of `font.glyphGeometry(id)` to retrieve the geometry after post-processing.
