import assert from "node:assert";

import type { Instruction } from "./instructions";

import * as ins from "./instructions";
import * as p from "./parser";

export namespace Ast {
  export type Num = {
    t: AstType.Num;
    val: number;
  };

  export type ID = {
    t: AstType.ID;
    val: string;
  };

  export type BinaryOp = {
    t: AstType.BinaryOp;
    lhs: Expr;
    op:
      | p.InferParserResult<typeof token.Z_ADD_OPS>
      | p.InferParserResult<typeof token.Z_MUL_OPS>
      | p.InferParserResult<typeof token.Z_CMP_OPS>
      | p.InferParserResult<typeof token.Z_LOG_OPS>;
    rhs: Expr;
  };

  export type FuncCall = {
    t: AstType.FuncCall;
    name: string;
    args: Expr[];
  };

  export type Expr = Num | ID | BinaryOp | FuncCall;
  export type IR = Num | ID | (FuncCall & { args: IR[] });
}

enum AstType {
  Num,
  ID,
  BinaryOp,
  FuncCall,
}

const FUNC_RE = p.joinRes([
  /\.?\w+(:?\.\w+)+/, // foo.bar or .foo.bar
  /\.\w+/, // .foo
]);

const LEXER_RE = p.joinRes(
  [
    /<=|>=|==|!=|!!/,
    /\|\|/,
    /\&\&/,
    /[(),|<>/*+\-!]/,
    FUNC_RE,
    p.NUM_RE,
    p.STR_LIT_RE,
    p.STR_RE,
    /\./,
  ],
  "g",
);

const token = {
  BANG: p.lit("!"),
  BANG_D: p.lit("!!"),
  COMMA: p.lit(","),
  DOT: p.lit("."),
  MINUS: p.lit("-"),
  PARAN_L: p.lit("("),
  PARAN_R: p.lit(")"),
  PIPE: p.lit("|"),
  Z_ADD_OPS: p.enum(["-", "+"]),
  Z_CMP_OPS: p.enum(["==", "!=", ">", ">=", "<", "<="]),
  Z_LOG_OPS: p.enum(["&&", "||"]),
  Z_MUL_OPS: p.enum(["*", "/"]),
} as const;

const node = {
  id: (val: string): Ast.ID => ({
    t: AstType.ID,
    val,
  }),
  num: (val: number): Ast.Num => ({
    t: AstType.Num,
    val,
  }),
  fn: <A extends Ast.Expr>(
    name: string,
    args: A[],
  ): Ast.FuncCall & { args: A[] } => ({
    t: AstType.FuncCall,
    name,
    args,
  }),
  binOp: (
    lhs: Ast.Expr,
    op: Ast.BinaryOp["op"],
    rhs: Ast.Expr,
  ): Ast.BinaryOp => ({
    t: AstType.BinaryOp,
    lhs,
    op,
    rhs,
  }),
};

const parseNum = p.map<number, Ast.Num>(p.num(), (val) => node.num(val));
const parseId = p.map<string, Ast.ID>(p.str(), (val) => node.id(val));

const parseFuncCall: p.Parser<Ast.FuncCall> = p.lazy(() => {
  const fn = p.oneOf([
    p.map(
      p.tuple([
        parseId,
        token.PARAN_L,
        p.sep(token.COMMA, parseExpression),
        token.PARAN_R,
      ]),
      ([name, _, args]) => node.fn(name.val, args),
    ),
    p.map(p.regex(p.wrapRe(FUNC_RE)), (val) => {
      const norm = val.startsWith(".") ? val.substring(1) : val;
      return node.fn("get", norm.split(".").map(node.id));
    }),
    p.map(token.DOT, () => node.fn("id", [])),
  ]);

  return p.map(p.sep1(token.PIPE, fn), (n) => {
    switch (n.length) {
      case 1:
        return n[0];
      default:
        return node.fn("flow", n);
    }
  });
});

const parseExpression: p.Parser<Ast.Expr> = p.lazy(() => parseLogicalExpr);

const parseLogicalExpr: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([parseEqualityExpression, token.Z_LOG_OPS, parseLogicalExpr]),
      ([lhs, op, rhs]) => node.binOp(lhs, op, rhs),
    ),
    parseEqualityExpression,
  ]),
);

const parseEqualityExpression: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([parseAddativeExpr, token.Z_CMP_OPS, parseAddativeExpr]),
      ([lhs, op, rhs]) => node.binOp(lhs, op, rhs),
    ),
    p.map(token.BANG_D, () =>
      node.binOp(node.fn("id", []), "!=", node.id("null")),
    ),
    parseAddativeExpr,
  ]),
);

const parseAddativeExpr: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([parseMultiplicativeExpr, token.Z_ADD_OPS, parseAddativeExpr]),
      ([lhs, op, rhs]) => node.binOp(lhs, op, rhs),
    ),
    parseMultiplicativeExpr,
  ]),
);

const parseMultiplicativeExpr: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([parsePrimaryExpr, token.Z_MUL_OPS, parseMultiplicativeExpr]),
      ([lhs, op, rhs]) => node.binOp(lhs, op, rhs),
    ),
    parsePrimaryExpr,
  ]),
);

const parsePrimaryExpr: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([token.PARAN_L, parseExpression, token.PARAN_R]),
      ([_, e]) => e,
    ),
    parseNum,
    p.map(p.strLit(), (val) => node.id(val)),
    parseFuncCall,
    parseId,
    p.map(p.tuple([token.BANG, parseExpression]), ([_, rhs]) =>
      node.fn("not", [rhs]),
    ),
    p.map(p.tuple([token.MINUS, parsePrimaryExpr]), ([_, rhs]) =>
      node.binOp(node.num(-1), "*", rhs),
    ),
  ]),
);

const parseQuery: p.Parser<Ast.FuncCall> = p.lazy(() => parseFuncCall);

export const parse = p.make(LEXER_RE, parseQuery);

export function show(e: Ast.Expr) {
  function* step(p: string, e: Ast.Expr): IterableIterator<string> {
    switch (e.t) {
      case AstType.Num:
        yield `${p}(nr: ${e.val})`;
        break;
      case AstType.ID:
        yield `${p}(id: ${e.val})`;
        break;
      case AstType.BinaryOp:
        yield `${p}(${e.op}`;
        yield* step(p + "  ", e.lhs);
        yield* step(p + "  ", e.rhs);
        yield `${p})`;
        break;
      case AstType.FuncCall:
        yield `${p}(fn: ${e.name}`;
        for (const a of e.args) {
          yield* step(p + "  ", a);
        }
        yield `${p})`;
        break;
    }
  }
  return Array.from(step("", e)).join("\n");
}

export function reduce(main: Ast.FuncCall): Ast.IR {
  function step(e: Ast.Expr): Ast.IR {
    switch (e.t) {
      case AstType.Num:
      case AstType.ID:
        return e;
      case AstType.FuncCall: {
        return node.fn(e.name, e.args.map(step));
      }
      case AstType.BinaryOp: {
        const a = step(e.lhs);
        const b = step(e.rhs);
        if (a.t === AstType.Num && b.t === AstType.Num) {
          switch (e.op) {
            case "-":
              return node.num(a.val - b.val);
            case "+":
              return node.num(a.val + b.val);
            case "*":
              return node.num(a.val * b.val);
            case "/":
              return node.num(a.val / b.val);
            case "==":
              return node.num(Number(a.val === b.val));
            case "!=":
              return node.num(Number(a.val != b.val));
            case ">":
              return node.num(Number(a.val > b.val));
            case ">=":
              return node.num(Number(a.val >= b.val));
            case "<":
              return node.num(Number(a.val < b.val));
            case "<=":
              return node.num(Number(a.val <= b.val));
            case "&&":
              return node.num(a.val && b.val);
            case "||":
              return node.num(a.val || b.val);
          }
        }
        switch (e.op) {
          case "-":
            return node.fn("sub", [a, b]);
          case "+":
            return node.fn("add", [a, b]);
          case "&&":
            return node.fn("every", [a, b]);
          case "||":
            return node.fn("some", [a, b]);
          case "*":
            return node.fn("mul", [a, b]);
          case "/":
            return node.fn("div", [a, b]);
          case "==":
            return node.fn("eq", [a, b]);
          case "!=":
            return node.fn("neq", [a, b]);
          case ">":
            return node.fn("gt", [a, b]);
          case ">=":
            return node.fn("gte", [a, b]);
          case "<":
            return node.fn("lt", [a, b]);
          case "<=":
            return node.fn("lte", [a, b]);
        }
      }
    }
  }

  return step(main);
}

export function build(ir: Ast.IR) {
  const kernel = new Proxy(
    Object.entries(ins).reduce<Record<string, Instruction.Any>>(
      (a, [name, ins]) => {
        a[name] = ins;
        ins.meta.alias.forEach((alias) => {
          a[alias] = ins;
        });

        return a;
      },
      {},
    ),
    {
      get(target, name: string) {
        assert(name in target, `Invalid instruction: "${name}"`);
        return target[name];
      },
    },
  );

  function step(e: Ast.IR): Instruction.LazyFunc | Instruction.LazyIter {
    switch (e.t) {
      case AstType.ID:
      case AstType.Num:
        return () => e.val;
      case AstType.FuncCall:
        return kernel[e.name].fn(...e.args.map(step));
    }
  }

  return step(ir);
}

export function compile(q: string) {
  return build(reduce(parse(q)));
}
