export declare class Vector2 {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    add(v: Vector2): Vector2;
    subtract(v: Vector2): Vector2;
    multiply(scalar: number): Vector2;
    divide(scalar: number): Vector2;
    magnitude(): number;
    normalize(): Vector2;
    distanceTo(v: Vector2): number;
    clone(): Vector2;
    lerp(target: Vector2, t: number): Vector2;
    dot(v: Vector2): number;
    static zero(): Vector2;
    static one(): Vector2;
}
//# sourceMappingURL=Vector2.d.ts.map