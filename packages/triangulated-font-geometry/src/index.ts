import quadratic from "adaptive-quadratic-curve";
import bezier from "adaptive-bezier-curve";
import triangulate, {
  Point,
  Result,
  Triangulator,
} from "polygon-winding-solver";

import {
  Font,
  GlyphGeometryCache,
  GlyphLayout,
  SVGPathCommand,
} from "harfbuzz-modern-wrapper";

export type Interval = { min: number; max: number };
export type Geometry = {
  geometry: Result;
  hspan: Interval | undefined;
};

export class GeometryComponent {
  readonly position: Point;

  private cached: Geometry | undefined = undefined;

  private id: number;
  private cache: GlyphGeometryCache<Geometry>;

  constructor(glyph: GlyphLayout, cache: GlyphGeometryCache<Geometry>) {
    this.position = glyph.base;
    this.id = glyph.id;
    this.cache = cache;
  }

  private get geometryData() {
    if (this.cached === undefined) {
      this.cached = this.cache.glyphGeometry(this.id);
    }
    return this.cached!;
  }

  get geometry() {
    return this.geometryData.geometry;
  }

  get hspan() {
    const relativeSpan = this.geometryData.hspan;
    if (relativeSpan === undefined) {
      return undefined;
    } else {
      return {
        min: this.position.x + relativeSpan.min,
        max: this.position.y + relativeSpan.max,
      };
    }
  }
}

type RawPoint = [number, number];

export default class TriangulatedFontGeometry {
  private flatteningEM: number;
  private triangulator: Triangulator | undefined;

  private font: Font;
  private cache: GlyphGeometryCache<Geometry>;

  constructor(
    font: Font,
    options: { flatteningEM?: number; triangulator?: Triangulator } = {}
  ) {
    this.flatteningEM = options.flatteningEM ?? 100;
    this.triangulator = options.triangulator;

    this.font = font;
    this.cache = new GlyphGeometryCache(font, (paths, upem) =>
      this.constructGeometry(paths, upem)
    );
  }

  shape(text: string) {
    const glyphs = this.font.shape(text);
    return {
      components: glyphs.glyphs.map(
        (glyph) => new GeometryComponent(glyph, this.cache)
      ),
      bounds: glyphs.bounds,
    };
  }

  private constructGeometry(paths: SVGPathCommand[], upem: number) {
    const flattenedPaths = new Array<Point[]>();

    const flattenScale = this.flatteningEM / upem;
    let path = new Array<RawPoint>();
    for (const command of paths) {
      switch (command.type) {
        case "M":
          path = [[command.values[0], command.values[1]]];
          break;
        case "L":
          if (path.length > 0) {
            path.push([command.values[0], command.values[1]]);
          }
          break;
        case "Q":
          if (path.length > 0) {
            const begin = path.pop()!;
            const c1: RawPoint = [command.values[0], command.values[1]];
            const end: RawPoint = [command.values[2], command.values[3]];
            quadratic(begin, c1, end, flattenScale, path);
          }
          break;
        case "C":
          if (path.length > 0) {
            const begin = path.pop()!;
            const c1: RawPoint = [command.values[0], command.values[1]];
            const c2: RawPoint = [command.values[2], command.values[3]];
            const end: RawPoint = [command.values[4], command.values[5]];
            bezier(begin, c1, c2, end, flattenScale, path);
          }
          break;
        case "Z":
          if (path.length > 1) {
            const start = path[0]!;
            const end = path[path.length - 1]!;
            if (
              start[0] - end[0] > -1e-8 &&
              start[0] - end[0] < 1e-8 &&
              start[1] - end[1] > -1e-8 &&
              start[1] - end[1] < 1e-8
            ) {
              path.pop();
            }
            flattenedPaths.push(
              path.map((point) => ({ x: point[0], y: point[1] }))
            );
          }
          break;
      }
    }

    const geometry = triangulate(flattenedPaths, this.triangulator);
    if (flattenedPaths.length > 0) {
      const xvals = flattenedPaths.flatMap((path) => path.map((p) => p.x));
      const hspan: Interval = {
        min: Math.min(...xvals),
        max: Math.max(...xvals),
      };

      return { geometry, hspan };
    } else {
      return { geometry, hspan: undefined };
    }
  }
}

// tsc emits emulated ES-modules by default;
// this snippet makes it a standard commonjs module
// for commonjs and native ESM interop
declare let exports: any;
declare const module: { exports: any };
Object.defineProperties(
  exports.default,
  Object.getOwnPropertyDescriptors(exports)
);
exports = module.exports = exports.default;
