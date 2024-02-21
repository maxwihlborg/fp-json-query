import { purry } from "remeda";
import assert from "node:assert";

interface ParseError {
  readonly tag: "ParseError";
}

interface ParseOk<T> {
  readonly tag: "ParseOk";
  offset: number;
  value: T;
}

type Tokens = readonly string[];

type ParserResult<T> = ParseError | ParseOk<T>;
type InferParserResult<T> = [T] extends [Parser<infer R>] ? R : never;

export interface Parser<T> {
  (offset: number, tokens: Tokens): ParserResult<T>;
}

export const error: ParserResult<never> = { tag: "ParseError" };
export const ok = <T>(offset: number, value: T): ParserResult<T> => ({
  tag: "ParseOk",
  offset,
  value,
});

export const isOk = <T>(o: ParserResult<T>): o is ParseOk<T> =>
  o.tag === "ParseOk";

export const isError = <T>(o: ParserResult<T>): o is ParseError =>
  o.tag === "ParseError";

export const make: {
  <P>(lex: RegExp, parse: Parser<P>): (str: string) => P;
} = (lex, parse) => (str) => {
  const tokens = str.match(lex);
  assert(tokens, "Lexer error");
  const res = parse(0, tokens);
  assert(isOk(res), "Parser error");

  return res.value;
};

export const tuple: {
  <A extends readonly Parser<any>[]>(
    ps: [...A],
  ): Parser<{
    [P in keyof A]: InferParserResult<A[P]>;
  }>;
} = (ps) => (i, t) => {
  let n = i,
    r: ParserResult<any> = error,
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
  ): Parser<InferParserResult<T[number]>>;
} = (ps) => (i, t) => {
  for (let j = 0; j < ps.length; j++) {
    const r = ps[j](i, t);
    if (isOk(r)) {
      return r as any;
    }
  }
  return error;
};

export const str: {
  (): Parser<string>;
} = () => (i, t) => {
  if (/^\w+$/.test(t[i])) {
    return ok(i + 1, t[i]);
  }
  return error;
};

export const num: {
  (): Parser<number>;
} = () => (i, t) => {
  if (/^-?\d+(\.\d+)?$/.test(t[i])) {
    return ok(i + 1, parseFloat(t[i]));
  }
  return error;
};

export const many: {
  <A>(parse: Parser<A>): Parser<A[]>;
} = (parse) => (i, t) => {
  let n = i;
  const res: any[] = [];

  do {
    const r = parse(n, t);
    if (isError(r)) break;
    n = r.offset;
    res.push(r.value);
  } while (n < t.length);

  return ok(n, res);
};

export const lazy: {
  <A>(fn: () => Parser<A>): Parser<A>;
} = (fn) => (i, t) => fn()(i, t);

export const sep: {
  <A>(sep: Parser<any>, parse: Parser<A>): Parser<A[]>;
} = (sep, parse) => (i, t) => {
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

  return ok(n, res);
};

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

const _map =
  <A, B>(parse: Parser<A>, fn: (a: A) => B): Parser<B> =>
  (i, t) => {
    const r = parse(i, t);
    return isError(r) ? r : ok(r.offset, fn(r.value));
  };

export const map: {
  <A, B>(fn: (a: A) => B): (parse: Parser<A>) => Parser<B>;
  <A, B>(parse: Parser<A>, fn: (a: A) => B): Parser<B>;
} = function () {
  return purry(_map, arguments);
};
