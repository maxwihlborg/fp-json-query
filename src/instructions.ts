export namespace Instruction {
  export type Any = Generator<LazyFunc[]> | Operation<LazyFunc[]>;

  export interface LazyFunc {
    (...as: any[]): any;
  }

  export interface LazyIter {
    (it: Iterable<any>): IterableIterator<any>;
  }

  export type Generator<A extends any[]> = {
    t: InstructionType.Generator;
    fn(...as: [...A]): LazyIter;
    meta: Meta;
  };

  export type Operation<A extends any[]> = {
    t: InstructionType.Operation;
    fn(...as: [...A]): LazyFunc;
    meta: Meta;
  };

  export interface Meta {
    alias: string[];
  }
}

enum InstructionType {
  Generator,
  Operation,
}

const genOp: {
  <T extends Instruction.LazyFunc[]>(
    fn: (...as: [...T]) => Instruction.LazyIter,
    meta?: Partial<Instruction.Meta>,
  ): Instruction.Generator<T>;
} = (fn, meta) => ({
  t: InstructionType.Generator,
  fn,
  meta: {
    alias: meta?.alias ?? [],
  },
});

const fnOp: {
  <T extends Instruction.LazyFunc[]>(
    fn: (...as: [...T]) => Instruction.LazyFunc,
    meta?: Partial<Instruction.Meta>,
  ): Instruction.Operation<T>;
} = (fn, meta) => ({
  t: InstructionType.Operation,
  fn,
  meta: {
    alias: meta?.alias ?? [],
  },
});

export const map = genOp(
  (fn) =>
    function* (it) {
      for (const x of it) {
        yield fn(x);
      }
    },
);

export const filter = genOp(
  (fn) =>
    function* (it) {
      for (const x of it) {
        if (fn(x)) {
          yield x;
        }
      }
    },
);

export const unique = genOp(
  (fn) =>
    function* (it) {
      const seen = new Set();
      for (const x of it) {
        const n = fn(x);
        if (seen.has(n)) continue;
        seen.add(n);
        yield x;
      }
    },
  { alias: ["uniq"] },
);

export const skip = genOp(
  (fn) =>
    function* (it) {
      let i = 0;
      for (const x of it) {
        if (i++ < fn(x)) continue;
        yield x;
      }
    },
);

export const take = genOp(
  (fn) =>
    function* (it) {
      let i = 0;
      for (const x of it) {
        if (fn(x) <= i++) break;
        yield x;
      }
    },
);

export const range = genOp(
  (min, max, step = () => 1) =>
    function* () {
      const a = min();
      const b = max();
      const c = step();
      if (c === 0) return;

      if (a < b && c > 0) {
        for (let i = a; i <= b; i += c) {
          yield i;
        }
      } else {
        for (let i = a; i >= b; i -= c) {
          yield i;
        }
      }
    },
);

export const flatMap = genOp(
  (fn) =>
    function* (it) {
      for (const x of it) {
        yield* fn(x);
      }
    },
  { alias: ["chain"] },
);

export const count = fnOp(
  () => (it) => {
    let i = 0;
    for (const _ of it) {
      i += 1;
    }
    return i;
  },
  { alias: ["len"] },
);

export const constant = fnOp((ex) => (x) => ex(x), { alias: ["c"] });

export const get = fnOp(
  (...as) =>
    (x) =>
      as.reduce((c, a) => c?.[a(x)], x),
  { alias: ["pluck"] },
);

export const pick = fnOp(
  (...as) =>
    (x) =>
      as.reduce<Record<string, any>>((a, b) => {
        const k = b(x);
        a[k] = x[k];
        return a;
      }, {}),
);

export const omit = fnOp((...as) => (x) => {
  const toOmit = as.reduce<Set<string>>((a, b) => {
    a.add(b(x));
    return a;
  }, new Set());
  return Object.keys(x).reduce<Record<string, any>>((a, k) => {
    if (toOmit.has(k)) {
      return a;
    }
    a[k] = x[k];
    return a;
  }, {});
});

export const project = fnOp((k, v) => (x) => ({ [k(x)]: v(x) }), {
  alias: ["p"],
});

export const union = fnOp(
  (...as) =>
    (x) =>
      as.reduce((c, a) => Object.assign(c, a(x)), {}),
  { alias: ["u"] },
);

export const identity = fnOp(() => (x) => x, { alias: ["id", "i"] });

export const add = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a + b(x), h(x)),
);

export const subract = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a - b(x), h(x)),
  { alias: ["sub"] },
);

export const multiply = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a * b(x), h(x)),
  { alias: ["mul"] },
);

export const divide = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a / b(x), h(x)),
  { alias: ["div"] },
);

export const greaterThan = fnOp(
  (a, b) => (x) => {
    return a(x) > b(x);
  },
  { alias: ["gt"] },
);

export const greaterThanEquals = fnOp(
  (a, b) => (x) => {
    return a(x) >= b(x);
  },
  { alias: ["gte"] },
);

export const lessThan = fnOp(
  (a, b) => (x) => {
    return a(x) < b(x);
  },
  { alias: ["lt"] },
);

export const lessThanEquals = fnOp(
  (a, b) => (x) => {
    return a(x) <= b(x);
  },
  { alias: ["lte"] },
);

export const notEquals = fnOp(
  (a, b) => (x) => {
    return a(x) != b(x);
  },
  { alias: ["neq"] },
);

export const equals = fnOp(
  (a, b) => (x) => {
    return a(x) === b(x);
  },
  { alias: ["eq"] },
);

export const includes = fnOp(
  (a) => (x) => {
    if (Array.isArray(x) || typeof x === "string") {
      return x.includes(a(x));
    }
    return false;
  },
  { alias: ["has"] },
);

export const not = fnOp((a) => (x) => !a(x));

export const flow = fnOp(
  (...as) =>
    (x) =>
      as.reduce((a, b) => b(a), x),
);

export const every = fnOp(
  (...as) =>
    (x) =>
      as.every((a) => a(x)),
  { alias: ["and"] },
);

export const some = fnOp(
  (...as) =>
    (x) =>
      as.some((a) => a(x)),
  { alias: ["or"] },
);
