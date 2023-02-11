declare module "adaptive-quadratic-curve" {
  declare const quadratic: (
    start: [number, number],
    c1: [number, number],
    end: [number, number],
    scale?: number,
    points?: [number, number][]
  ) => number;
  export default quadratic;
}
