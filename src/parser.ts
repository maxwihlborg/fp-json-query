import assert from "node:assert";

export namespace Parser {
  export type Error = {
    t: ParserType.Error;
  };

  export type Ok<T> = {
    t: ParserType.Ok;
    offset: number;
    value: T;
  };

  export type Tokens = readonly string[];

  export type Result<T> = Error | Ok<T>;
  export type InferResult<T> = [T] extends [Parser<infer R>] ? R : never;
}

enum ParserType {
  Ok,
  Error,
}

export interface Parser<T> {
  (offset: number, tokens: Parser.Tokens): Parser.Result<T>;
}

export const NUM_RE = /\d+(:?\.\d+)?(:?e\d+)?/;
export const STR_LIT_RE = /"([^"\\]|\\[\s\S])*"/;
export const STR_RE = /\w+/;

export const error: Parser.Result<never> = { t: ParserType.Error };
export const ok = <T>(offset: number, value: T): Parser.Result<T> => ({
  t: ParserType.Ok,
  offset,
  value,
});

export const isOk = <T>(o: Parser.Result<T>): o is Parser.Ok<T> =>
  o.t === ParserType.Ok;

export const isError = <T>(o: Parser.Result<T>): o is Parser.Error =>
  o.t === ParserType.Error;

export const make: {
  <P>(lex: RegExp, parse: Parser<P>): (str: string) => P;
} = (lex, parse) => (str) => {
  const tokens = str.match(lex);
  assert(tokens, "Lexer error");
  const res = parse(0, tokens);
  assert(isOk(res), "Parser error");

  return res.value;
};

export const lazy: {
  <A>(fn: () => Parser<A>): Parser<A>;
} = (fn) => (i, t) => fn()(i, t);

export const tuple: {
  <A extends readonly Parser<any>[]>(
    ps: [...A],
  ): Parser<{
    [P in keyof A]: Parser.InferResult<A[P]>;
  }>;
} = (ps) => (i, t) => {
  let n = i,
    r: Parser.Result<any> = error,
    res: any[] = [];

  for (let i = 0; i < ps.length; i++) {
    r = ps[i](n, t);
    if (isError(r)) break;
    n = r.offset;
    res.push(r.value);
  }

  return isError(r) ? r : ok(r.offset, res as any);
};

export const lit: {
  <A extends string>(str: A): Parser<A>;
} = (str) => (i, t) => {
  if (t[i] === str) {
    return ok(i + 1, str);
  }
  return error;
};

export const oneOf: {
  <T extends readonly Parser<any>[]>(
    ps: [...T],
  ): Parser<Parser.InferResult<T[number]>>;
} = (ps) => (i, t) => {
  for (let j = 0; j < ps.length; j++) {
    const r = ps[j](i, t);
    if (isOk(r)) {
      return r as any;
    }
  }
  return error;
};

export const wrapRe: {
  (re: RegExp): RegExp;
} = (re) => new RegExp(`^${re.source}$`, re.flags);

export const joinRes: {
  (res: RegExp[], flags?: string): RegExp;
} = (res, flags) => new RegExp(res.map((re) => re.source).join("|"), flags);

export const str: {
  (): Parser<string>;
} = (() => {
  const re = wrapRe(STR_RE);
  return () => (i, t) => {
    if (re.test(t[i])) {
      return ok(i + 1, t[i]);
    }
    return error;
  };
})();

export const strLit: {
  (): Parser<string>;
} = (() => {
  const re = wrapRe(STR_LIT_RE);
  return () => (i, t) => {
    if (re.test(t[i])) {
      return ok(i + 1, JSON.parse(t[i]));
    }
    return error;
  };
})();

export const num: {
  (): Parser<number>;
} = (() => {
  const re = wrapRe(NUM_RE);
  return () => (i, t) => {
    if (re.test(t[i])) {
      return ok(i + 1, parseFloat(t[i]));
    }
    return error;
  };
})();

const _many: {
  (min: number): <A>(parse: Parser<A>) => Parser<A[]>;
} = (min) => (parse) => (i, t) => {
  let n = i;
  const res: any[] = [];

  do {
    const r = parse(n, t);
    if (isError(r)) break;
    n = r.offset;
    res.push(r.value);
  } while (n < t.length);

  if (res.length < min) {
    return error;
  }

  return ok(n, res);
};

export const many = _many(0);
export const many1 = _many(1);

const _sep: {
  (min: number): <A>(sep: Parser<any>, parse: Parser<A>) => Parser<A[]>;
} = (min) => (sep, parse) => (i, t) => {
  let n = i;
  const res: any[] = [];

  do {
    const r = parse(n, t);
    if (isError(r)) break;
    n = r.offset;
    res.push(r.value);
    const s = sep(n, t);
    if (isError(s)) break;
    n = s.offset;
  } while (n < t.length);

  if (res.length < min) {
    return error;
  }

  return ok(n, res);
};

export const sep = _sep(0);
export const sep1 = _sep(1);

const _enum: {
  <A extends readonly string[]>(as: [...A]): Parser<A[number]>;
} = (as) => (i, t) => {
  if (as.includes(t[i])) {
    return ok(i + 1, t[i]);
  }
  return error;
};

export { _enum as enum };

export const regex: {
  (re: RegExp): Parser<string>;
} = (re) => (i, t) => {
  if (re.test(t[i])) {
    return ok(i + 1, t[i]);
  }
  return error;
};

export const map =
  <A, B>(parse: Parser<A>, fn: (a: A) => B): Parser<B> =>
  (i, t) => {
    const r = parse(i, t);
    return isError(r) ? r : ok(r.offset, fn(r.value));
  };
