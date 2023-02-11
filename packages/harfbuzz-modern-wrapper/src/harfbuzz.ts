import hbInstance from "harfbuzzjs/hb.wasm";
import hbjs, { HBBlob, HBFace, HBFont, HBHandle } from "harfbuzzjs/hbjs.js";
import bidiFactory from "bidi-js";

const bidi = bidiFactory();

export type Point = { x: number; y: number };
export type Bounds = { width: number; height: number };
export type GlyphLayout = { id: number; base: Point };

// redefine type used by the harfbuzzjs package,
// so we do not need a type declaration for that package
export type SVGPathCommand =
  | { type: "M"; values: [number, number] }
  | { type: "L"; values: [number, number] }
  | { type: "Q"; values: [number, number, number, number] }
  | { type: "C"; values: [number, number, number, number, number, number] }
  | { type: "Z"; values: [] };

export interface Font {
  get upem(): number;

  shape(text: string): { glyphs: GlyphLayout[]; bounds: Bounds };
  glyphName(id: number): string;
  glyphGeometry(id: number): SVGPathCommand[];
}

class FontImpl implements Font {
  readonly id: string;

  private hb: HBHandle;
  private blob: HBBlob;
  private face: HBFace;
  private font: HBFont;

  constructor(hb: HBHandle, id: string, data: Uint8Array, index: number = 0) {
    this.id = id;
    this.hb = hb;
    this.blob = hb.createBlob(data);
    this.face = hb.createFace(this.blob, index);
    this.font = hb.createFont(this.face);
  }

  get upem() {
    return this.face.upem;
  }

  shape(text: string) {
    // unicode bidirectional text support
    type TextSegment = { text: string; direction: "ltr" | "rtl" };
    const segmentStack = [new Array<TextSegment>()];
    const reduceStack = (stack: TextSegment[][], target: number) => {
      const validatedTarget = target < 0 ? 0 : target;
      while (stack.length > validatedTarget + 1) {
        const current = stack.pop()!;
        stack[stack.length - 1]!.push(...current.reverse());
      }
    };
    const pushInStack = (
      stack: TextSegment[][],
      text: string,
      level: number
    ) => {
      if (level + 1 > stack.length) {
        stack.push(
          ...Array.from(
            { length: level + 1 - stack.length },
            () => new Array<TextSegment>()
          )
        );
      } else {
        reduceStack(stack, level);
      }
      stack[level]!.push({ text, direction: level % 2 === 0 ? "ltr" : "rtl" });
    };

    const embeddingLevels = bidi.getEmbeddingLevels(text);
    const iter = embeddingLevels.levels.entries();
    const first = iter.next();
    if (!first.done) {
      let [prevIndex, prevLevel] = first.value;
      for (const [i, level] of iter) {
        if (level !== prevLevel) {
          pushInStack(segmentStack, text.slice(prevIndex, i), prevLevel);
          prevIndex = i;
          prevLevel = level;
        }
      }
      pushInStack(segmentStack, text.slice(prevIndex), prevLevel);
      reduceStack(segmentStack, 0);
    }

    const base = { x: 0, y: 0 };
    const glyphs = new Array<GlyphLayout>();
    for (const segment of segmentStack[0]!) {
      const buffer = this.hb.createBuffer();
      buffer.addText(segment.text);
      buffer.guessSegmentProperties();
      buffer.setDirection(segment.direction);
      this.hb.shape(this.font, buffer);
      const result = buffer.json();
      buffer.destroy();

      for (const glyph of result) {
        glyphs.push({
          id: glyph.g,
          base: { x: base.x + glyph.dx, y: base.y + glyph.dy },
        });
        base.x += glyph.ax;
        base.y += glyph.ay;
      }
    }

    return {
      glyphs,
      bounds: { width: base.x, height: this.upem },
    };
  }

  glyphName(id: number) {
    return this.font.glyphName(id);
  }

  glyphGeometry(id: number) {
    return this.font.glyphToJson(id);
  }

  // the client will never call this directly.
  // the client must free a font through `HarfBuzzSingleton.freeFont`
  destroy() {
    this.font.destroy();
    this.face.destroy();
    this.blob.destroy();
  }
}

// a singleton that has the same lifetime as the harfbuzz wasm module;
// all interactions with harfbuzz should be through this singleton
// so that no leak in the webassembly memory are created
export class HarfBuzzSingleton {
  private initialisation: Promise<void>;
  private hb: HBHandle | undefined = undefined;

  private fonts = new Map<string, FontImpl>();

  get ready() {
    return this.hb !== undefined;
  }

  constructor() {
    this.initialisation = this.constructInstance();
  }

  private async constructInstance() {
    this.hb = hbjs({ exports: await hbInstance });
  }

  async init() {
    await this.initialisation;
  }

  get fontIds() {
    return Array.from(this.fonts.keys());
  }

  createFont(
    id: string,
    data: Uint8Array,
    index: number = 0
  ): Font | undefined {
    if (this.hb !== undefined) {
      if (this.fonts.has(id)) {
        this.fonts.get(id)!.destroy();
      }

      const font = new FontImpl(this.hb, id, data, index);
      this.fonts.set(id, font);
      return font;
    } else {
      return undefined;
    }
  }

  getFont(id: string): Font | undefined {
    return this.fonts.get(id);
  }

  freeFont(id: string) {
    if (this.fonts.has(id)) {
      this.fonts.get(id)!.destroy();
      this.fonts.delete(id);
    }
  }
}

const harfbuzz = new HarfBuzzSingleton();
export default harfbuzz;
