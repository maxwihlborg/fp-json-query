import {
  mapperOp,
  fnOp,
  producerOp,
  reducerOp,
  unknownOp,
  biReducerOp,
  biProducerOp,
} from "./types";

export const map = mapperOp(
  (fn) =>
    function* (it) {
      for (const x of it) {
        yield fn(x);
      }
    },
);

export const filter = mapperOp(
  (fn) =>
    function* (it) {
      for (const x of it) {
        if (fn(x)) {
          yield x;
        }
      }
    },
);

export const unique = mapperOp(
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

export const reverse = mapperOp(
  () =>
    function* (it) {
      const arr = Array.from(it);
      for (let i = arr.length - 1; i >= 0; i--) {
        yield arr[i];
      }
    },
  { alias: ["rev"] },
);

export const sort = mapperOp(
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

export const entries = producerOp(
  (fn) =>
    function* (x) {
      yield* Object.entries(fn(x)).map(([key, value]) => ({
        key,
        value,
      }));
    },
);

export const keys = producerOp(
  (fn) =>
    function* (x) {
      yield* Object.keys(fn(x));
    },
);

export const values = producerOp(
  (fn) =>
    function* (x) {
      yield* Object.values(fn(x));
    },
);

export const fromEntries = reducerOp((fn) => (it) => {
  const result: Record<string, any> = {};
  for (const x of it) {
    const { key, value } = fn(x);
    result[key] = value;
  }
  return result;
});

export const mapValues = fnOp((fn) => (x) => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(x)) {
    result[key] = fn(value);
  }
  return result;
});

export const skip = mapperOp(
  (fn) =>
    function* (it) {
      let i = 0;
      for (const x of it) {
        if (i++ < fn(x)) continue;
        yield x;
      }
    },
);

export const take = mapperOp(
  (fn) =>
    function* (it) {
      let i = 0;
      for (const x of it) {
        if (fn(x) <= i++) break;
        yield x;
      }
    },
);

export const range = producerOp(
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

export const flatMap = mapperOp(
  (fn) =>
    function* (it) {
      for (const x of it) {
        yield* fn(x);
      }
    },
  { alias: ["chain", "concat"] },
);

export const count = reducerOp(
  () => (it) => {
    let i = 0;
    for (const _ of it) {
      i += 1;
    }
    return i;
  },
  { alias: ["len"] },
);

export const constant = unknownOp((ex) => (x) => ex(x), { alias: ["c"] });

export const get = unknownOp(
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

export const project = biReducerOp((k, v) => (x) => ({ [k(x)]: v(x) }), {
  alias: ["p"],
});

export const union = fnOp(
  (...as) =>
    (x) =>
      as.reduce((c, a) => Object.assign(c, a(x)), {}),
  { alias: ["u"] },
);

export const identity = unknownOp(() => (x) => x, { alias: ["id", "i"] });

export const add = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a + b(x), h(x)),
  { alias: [], symbol: "+" },
);

export const subract = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a - b(x), h(x)),
  { alias: ["sub"], symbol: "-" },
);

export const multiply = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a * b(x), h(x)),
  { alias: ["mul"], symbol: "*" },
);

export const divide = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a / b(x), h(x)),
  { alias: ["div"], symbol: "/" },
);

export const modulo = fnOp(
  (h, ...tail) =>
    (x) =>
      tail.reduce((a, b) => a % b(x), h(x)),
  { alias: ["mod"], symbol: "%" },
);

export const greaterThan = fnOp(
  (a, b) => (x) => {
    return a(x) > b(x);
  },
  { alias: ["gt"], symbol: ">" },
);

export const greaterThanEquals = fnOp(
  (a, b) => (x) => {
    return a(x) >= b(x);
  },
  { alias: ["gte"], symbol: ">=" },
);

export const lessThan = fnOp(
  (a, b) => (x) => {
    return a(x) < b(x);
  },
  { alias: ["lt"], symbol: "<" },
);

export const lessThanEquals = fnOp(
  (a, b) => (x) => {
    return a(x) <= b(x);
  },
  { alias: ["lte"], symbol: "<=" },
);

export const notEquals = fnOp(
  (a, b) => (x) => {
    return a(x) != b(x);
  },
  { alias: ["neq"], symbol: "!=" },
);

export const equals = fnOp(
  (a, b) => (x) => {
    return a(x) === b(x);
  },
  { alias: ["eq"], symbol: "==" },
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

export const not = fnOp((a) => (x) => !a(x), { alias: [], symbol: "!" });

export const bool = fnOp((a) => (x) => !!a(x), { alias: [], symbol: "!!" });

export const cond = unknownOp(
  (test, then, otherwise) => (x) => (test(x) ? then(x) : otherwise(x)),
  { alias: [], symbol: "?:" },
);

export const flow = unknownOp(
  (...as) =>
    (x) =>
      as.reduce((a, b) => b(a), x),
  { symbol: "|" },
);

export const every = biReducerOp(
  (...as) =>
    (x) =>
      as.every((a) => a(x)),
  { alias: ["and"] },
);

export const some = biReducerOp(
  (...as) =>
    (x) =>
      as.some((a) => a(x)),
  { alias: ["or"] },
);

export const opAnd = fnOp(
  (...as) =>
    (x) =>
      as.reduce((acc, a) => acc && a(x), true),
  { alias: [], symbol: "&&" },
);

export const opOr = fnOp(
  (...as) =>
    (x) =>
      as.reduce((acc, a) => acc || a(x), false),
  { alias: [], symbol: "||" },
);

export const first = reducerOp(
  () => (it) => {
    for (const x of it) {
      return x;
    }
    return undefined;
  },
  { alias: ["head", "fst"] },
);

export const last = reducerOp(
  () => (it) => {
    let result;
    for (const x of it) {
      result = x;
    }
    return result;
  },
  { alias: ["lst"] },
);

export const tail = mapperOp(
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

export const merge = reducerOp((fn) => (it) => {
  let acc = {};
  for (const x of it) {
    acc = { ...acc, ...fn(x) };
  }
  return acc;
});

export const sum = reducerOp(
  (fn) => (it) => {
    let acc = 0;
    for (const x of it) {
      acc += fn(x);
    }
    return acc;
  },
  { alias: ["total"] },
);

export const average = reducerOp(
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

export const median = reducerOp((fn) => (it) => {
  const values = Array.from<any, number>(it, fn).sort((a, b) => a - b);
  const len = values.length;
  if (len === 0) return 0;
  const mid = Math.floor(len / 2);
  return len % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
});

export const min = reducerOp((fn) => (it) => {
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

export const max = reducerOp((fn) => (it) => {
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

export const groupBy = reducerOp(
  (fn) => (it) => {
    const groups: Record<string, any[]> = {};
    for (const x of it) {
      (groups[fn(x)] ??= []).push(x);
    }
    return groups;
  },
  { alias: ["group"] },
);

export const array = producerOp(
  (...as) =>
    function* (x) {
      for (const a of as) {
        yield a(x);
      }
    },
);
