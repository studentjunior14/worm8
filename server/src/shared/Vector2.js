export class Vector2 {
    x;
    y;
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }
    subtract(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }
    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }
    divide(scalar) {
        if (scalar === 0)
            return new Vector2(0, 0);
        return new Vector2(this.x / scalar, this.y / scalar);
    }
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    normalize() {
        const mag = this.magnitude();
        if (mag === 0)
            return new Vector2(0, 0);
        return this.divide(mag);
    }
    distanceTo(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    clone() {
        return new Vector2(this.x, this.y);
    }
    lerp(target, t) {
        return new Vector2(this.x + (target.x - this.x) * t, this.y + (target.y - this.y) * t);
    }
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
    static zero() {
        return new Vector2(0, 0);
    }
    static one() {
        return new Vector2(1, 1);
    }
}
//# sourceMappingURL=Vector2.js.map