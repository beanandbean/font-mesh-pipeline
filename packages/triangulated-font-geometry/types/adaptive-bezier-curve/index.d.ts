declare module "adaptive-bezier-curve" {
  declare const bezier: (
    start: [number, number],
    c1: [number, number],
    c2: [number, number],
    end: [number, number],
    scale?: number,
    points?: [number, number][]
  ) => number;
  export default bezier;
}
