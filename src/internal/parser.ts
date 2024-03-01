import type { Parser } from "../parser";

export class SingleShotGen<T, A> implements Generator<T, A> {
  called = false;

  constructor(readonly self: T) {}

  next(a: A): IteratorResult<T, A> {
    if (this.called) {
      return { value: a, done: true };
    }
    this.called = true;
    return { value: this.self, done: false };
  }

  return(a: A): IteratorResult<T, A> {
    return {
      value: a,
      done: true,
    };
  }

  throw(e: unknown): IteratorResult<T, A> {
    throw e;
  }

  [Symbol.iterator](): Generator<T, A> {
    return new SingleShotGen<T, A>(this.self);
  }
}

export class ParserGenImpl {
  constructor(readonly value: Parser<any>) {}
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
}
