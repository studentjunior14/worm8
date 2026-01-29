export class Vector2 {
    constructor(public x: number = 0, public y: number = 0) { }

    add(v: Vector2): Vector2 {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    subtract(v: Vector2): Vector2 {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    multiply(scalar: number): Vector2 {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    divide(scalar: number): Vector2 {
        if (scalar === 0) return new Vector2(0, 0);
        return new Vector2(this.x / scalar, this.y / scalar);
    }

    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize(): Vector2 {
        const mag = this.magnitude();
        if (mag === 0) return new Vector2(0, 0);
        return this.divide(mag);
    }

    distanceTo(v: Vector2): number {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    lerp(target: Vector2, t: number): Vector2 {
        return new Vector2(
            this.x + (target.x - this.x) * t,
            this.y + (target.y - this.y) * t
        );
    }

    dot(v: Vector2): number {
        return this.x * v.x + this.y * v.y;
    }

    static zero(): Vector2 {
        return new Vector2(0, 0);
    }

    static one(): Vector2 {
        return new Vector2(1, 1);
    }
}
