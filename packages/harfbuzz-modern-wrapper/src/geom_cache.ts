import { Font, SVGPathCommand } from "./harfbuzz";

export type GlyphGeometryFactory<T> = (
  paths: SVGPathCommand[],
  upem: number
) => T;

export class GlyphGeometryCache<T> {
  private font: Font;
  private factory: GlyphGeometryFactory<T>;
  private glyphTable = new Map<number, T>();

  constructor(font: Font, transformer: GlyphGeometryFactory<T>) {
    this.font = font;
    this.factory = transformer;
  }

  glyphGeometry(id: number) {
    if (this.glyphTable.get(id) === undefined) {
      this.glyphTable.set(
        id,
        this.factory(this.font.glyphGeometry(id), this.font.upem)
      );
    }
    return this.glyphTable.get(id) as T;
  }
}
