export namespace Operator {
  export type Any = Generator<LazyFunc[]> | Operator<LazyFunc[]>;

  export interface LazyFunc {
    (...as: any[]): any;
  }

  export interface LazyIter {
    (it: Iterable<any>): IterableIterator<any>;
  }

  export type Generator<A extends any[]> = {
    t: OperatorType.Generator;
    fn(...as: [...A]): LazyIter;
    meta: Meta;
  };

  export type Operator<A extends any[]> = {
    t: OperatorType.Function;
    fn(...as: [...A]): LazyFunc;
    meta: Meta;
  };

  export interface Meta {
    alias: string[];
  }
}

enum OperatorType {
  Generator,
  Function,
}

const genOp: {
  <T extends Operator.LazyFunc[]>(
    fn: (...as: [...T]) => Operator.LazyIter,
    meta?: Partial<Operator.Meta>,
  ): Operator.Generator<T>;
} = (fn, meta) => ({
  t: OperatorType.Generator,
  fn,
  meta: {
    alias: meta?.alias ?? [],
  },
});

const fnOp: {
  <T extends Operator.LazyFunc[]>(
    fn: (...as: [...T]) => Operator.LazyFunc,
    meta?: Partial<Operator.Meta>,
  ): Operator.Operator<T>;
} = (fn, meta) => ({
  t: OperatorType.Function,
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

export const reverse = genOp(
  () =>
    function* (it) {
      const arr = Array.from(it);
      for (let i = arr.length - 1; i >= 0; i--) {
        yield arr[i];
      }
    },
);

export const sort = genOp(
  (fn) =>
    function* (it) {
      yield* Array.from(it).sort((a, b) => {
        const x = fn(a);
        const y = fn(b);
        if (x < y) {
          return -1;
        } else if (x > y) {
          return 1;
        } else {
          return 0;
        }
      });
    },
);

export const entries = genOp(
  (fn) =>
    function* (x) {
      yield* Object.entries(fn(x)).map(([key, value]) => ({
        key,
        value,
      }));
    },
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

export const first = fnOp(
  () => (it) => {
    for (const x of it) {
      return x;
    }
    return undefined;
  },
  { alias: ["head", "fst"] },
);

export const last = fnOp(
  () => (it) => {
    let result;
    for (const x of it) {
      result = x;
    }
    return result;
  },
  { alias: ["lst"] },
);

export const tail = genOp(
  () =>
    function* (it) {
      let first = true;
      for (const x of it) {
        if (first) {
          first = false;
          continue;
        }
        yield x;
      }
    },
);

export const merge = fnOp((fn) => (it) => {
  let acc = {};
  for (const x of it) {
    acc = { ...acc, ...fn(x) };
  }
  return acc;
});

export const concat = fnOp(
  (fn) => (it) => {
    let acc: unknown[] = [];
    for (const x of it) {
      acc = acc.concat(fn(x));
    }
    return acc;
  },
  { alias: ["join"] },
);

export const sum = fnOp(
  (fn) => (it) => {
    let acc = 0;
    for (const x of it) {
      acc += fn(x);
    }
    return acc;
  },
  { alias: ["total"] },
);

export const average = fnOp(
  (fn) => (it) => {
    let sum = 0;
    let count = 0;
    for (const x of it) {
      sum += fn(x);
      count++;
    }
    return count === 0 ? 0 : sum / count;
  },
  { alias: ["avg", "mean"] },
);

export const median = fnOp((fn) => (it) => {
  const values = Array.from(it, fn).sort((a, b) => a - b);
  const len = values.length;
  if (len === 0) return 0;
  const mid = Math.floor(len / 2);
  return len % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
});

export const min = fnOp((fn) => (it) => {
  let result;
  let minVal;
  for (const x of it) {
    const val = fn(x);
    if (minVal === undefined || val < minVal) {
      minVal = val;
      result = x;
    }
  }
  return result;
});

export const max = fnOp((fn) => (it) => {
  let result;
  let maxVal;
  for (const x of it) {
    const val = fn(x);
    if (maxVal === undefined || val > maxVal) {
      maxVal = val;
      result = x;
    }
  }
  return result;
});

export const groupBy = fnOp(
  (fn) => (it) => {
    const groups: Record<string, any[]> = {};
    for (const x of it) {
      (groups[fn(x)] ??= []).push(x);
    }
    return groups;
  },
  { alias: ["group"] },
);
