# triangulated-font-geometry

This utility consumes SVG paths of glyphs and triangulate them for the creation of 3D meshes.

## Usage

The following code is used after you have created a font instance using [harfbuzz-modern-wrapper](../harfbuzz-modern-wrapper/):

```typescript
import TriangulatedFontGeometry from "triangulated-font-geometry";

const textShaper = new TriangulatedFontGeometry(font, options);
const layout = textShaper.shape(text);
for (const component of layout.components) {
  // access `component.position` and `component.geometry` for rendering
}
```

Here `component.geometry.geometry` is the result of triangulating the glyph using [polygon-winding-solver](https://github.com/beanandbean/polygon-winding-solver); `component.geometry.hspan` provides the horizontal span that this character occupies, and will be `undefined` when the character is a whitespace. All coordinates will be given using the internal metrics defined by the font file. To convert them for display, scale all numbers by a ratio of `fontSize / layout.bounds.height`).

### Initialisation options

- `options.flatteningEM`: the font size to use when converting curves in a glyph to polylines. The larger this value is, the more points will be sampled on the glyph. Defaults to 100.


- `options.triangulator`: supply a custom triangulator to use with the [polygon-winding-solver](https://github.com/beanandbean/polygon-winding-solver) package.

## TODO

2D constructive solid geometry is a planned feature of the triangulator we use. Expect in the near future an option to merge the overlapping components.
