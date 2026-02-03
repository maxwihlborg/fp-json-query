import assert from "node:assert";

import { type Operator, NodeType } from "./types";

import * as ops from "./operators";
import * as p from "./parser";

export namespace Ast {
  export type Num = {
    t: NodeType.Num;
    val: number;
  };

  export type ID = {
    t: NodeType.ID;
    val: string;
  };

  export type BinaryOp = {
    t: NodeType.BinaryOp;
    lhs: Expr;
    op:
      | p.Parser.InferResult<typeof token.Z_ADD_OPS>
      | p.Parser.InferResult<typeof token.Z_MUL_OPS>
      | p.Parser.InferResult<typeof token.Z_CMP_OPS>
      | p.Parser.InferResult<typeof token.Z_LOG_OPS>
      | "|";
    rhs: Expr;
  };

  export type FuncCall = {
    t: NodeType.FuncCall;
    name: string;
    args: Expr[];
  };

  export type Expr = Num | ID | BinaryOp | FuncCall;
  export type IR = Num | ID | (FuncCall & { args: IR[] });
}

const FUNC_RE = p.joinRes([
  /\.?\w+(:?\.\w+)+/, // foo.bar or .foo.bar
  /\.\w+/, // .foo
]);

const LEXER_RE = p.joinRes(
  [
    /<=|>=|==|!=|!!|\+\+|--/,
    /\|\|/,
    /\&\&/,
    /[(),|<>/*+\-!\[\]%?:]/,
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
  BRACKET_L: p.lit("["),
  COLON: p.lit(":"),
  MINUS_D: p.lit("--"),
  PLUS_D: p.lit("++"),
  QUESTION: p.lit("?"),
  BRACKET_R: p.lit("]"),
  COMMA: p.lit(","),
  DOT: p.lit("."),
  MINUS: p.lit("-"),
  PARAN_L: p.lit("("),
  PARAN_R: p.lit(")"),
  PIPE: p.lit("|"),
  Z_ADD_OPS: p.enum(["-", "+"]),
  Z_CMP_OPS: p.enum(["==", "!=", ">", ">=", "<", "<="]),
  Z_LOG_OPS: p.enum(["&&", "||"]),
  Z_MUL_OPS: p.enum(["*", "/", "%"]),
} as const;

const node = {
  id: (val: string): Ast.ID => ({
    t: NodeType.ID,
    val,
  }),
  num: (val: number): Ast.Num => ({
    t: NodeType.Num,
    val,
  }),
  fn: <A extends Ast.Expr>(
    name: string,
    args: A[],
  ): Ast.FuncCall & { args: A[] } => ({
    t: NodeType.FuncCall,
    name,
    args,
  }),
  binOp: (
    lhs: Ast.Expr,
    op: Ast.BinaryOp["op"],
    rhs: Ast.Expr,
  ): Ast.BinaryOp => ({
    t: NodeType.BinaryOp,
    lhs,
    op,
    rhs,
  }),
};

const parseNum = p.map<number, Ast.Num>(p.num(), (val) => node.num(val));
const parseId = p.map<string, Ast.ID>(p.str(), (val) => node.id(val));

const parseFuncCall: p.Parser<Ast.FuncCall> = p.lazy(() =>
  p.oneOf([
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
  ]),
);

const parseExpression = p.lazy(() => {
  const nextPrecedance = p.oneOf([
    p.map(token.Z_CMP_OPS, () => 5),
    p.map(token.Z_MUL_OPS, () => 4),
    p.map(token.Z_ADD_OPS, () => 3),
    p.map(token.Z_LOG_OPS, () => 2),
    p.map(token.PIPE, () => 1),
    (i) => p.ok(i, 0),
  ]);

  const parseBinaryExpr = (np: number, lhs: Ast.Expr) =>
    p.map(
      p.tuple([
        p.oneOf([
          token.Z_CMP_OPS,
          token.Z_LOG_OPS,
          token.Z_MUL_OPS,
          token.Z_ADD_OPS,
          token.PIPE,
        ]),
        parse(np),
      ]),
      ([op, rhs]) => node.binOp(lhs, op, rhs),
    );

  const parse = (pp: number): p.Parser<Ast.Expr> =>
    p.gen(function* (_) {
      let lhs = yield* _(parsePrimaryExpr);
      while (true) {
        const np = yield* _(p.peek(nextPrecedance));
        if (np === 0 || np <= pp) {
          break;
        }
        lhs = yield* _(parseBinaryExpr(np, lhs));
      }
      return lhs;
    });

  return p.oneOf([
    p.map(
      p.tuple([parse(0), token.QUESTION, parse(0), token.COLON, parse(0)]),
      ([cond, _, then, __, otherwise]) =>
        node.fn("cond", [cond, then, otherwise]),
    ),
    parse(0),
  ]);
});

const parsePrimaryExpr: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([token.PARAN_L, parseExpression, token.PARAN_R]),
      ([_, e]) => e,
    ),
    p.map(
      p.tuple([
        token.BRACKET_L,
        p.sep(token.COMMA, parseExpression),
        token.BRACKET_R,
      ]),
      ([_, args]) => node.fn("array", args),
    ),
    parseNum,
    p.map(p.strLit(), (val) => node.id(val)),
    parseFuncCall,
    parseId,
    p.map(p.tuple([token.BANG_D, parsePrimaryExpr]), ([_, rhs]) =>
      node.fn("bool", [rhs]),
    ),
    p.map(p.tuple([token.BANG, parsePrimaryExpr]), ([_, rhs]) =>
      node.fn("not", [rhs]),
    ),
    p.map(p.tuple([token.MINUS, parsePrimaryExpr]), ([_, rhs]) =>
      node.binOp(node.num(-1), "*", rhs),
    ),
    p.map(p.tuple([token.PLUS_D, parsePrimaryExpr]), ([_, rhs]) =>
      node.binOp(rhs, "+", node.num(1)),
    ),
    p.map(p.tuple([token.MINUS_D, parsePrimaryExpr]), ([_, rhs]) =>
      node.binOp(rhs, "-", node.num(1)),
    ),
  ]),
);

const parseQuery: p.Parser<Ast.Expr> = p.lazy(() => parseExpression);

export const parse = p.make(LEXER_RE, parseQuery);

export function show(e: Ast.Expr): IterableIterator<string> {
  function* step(
    p: string,
    e: Ast.Expr,
    last: boolean,
  ): IterableIterator<string> {
    const ws = p + (last ? "└─" : "├─");
    const np = p + (last ? "  " : "│ ");
    switch (e.t) {
      case NodeType.Num:
        yield `${ws}nr: ${e.val}`;
        break;
      case NodeType.ID:
        yield `${ws}id: ${e.val}`;
        break;
      case NodeType.BinaryOp:
        yield `${ws}op: ${e.op}`;
        yield* step(np, e.lhs, false);
        yield* step(np, e.rhs, true);
        break;
      case NodeType.FuncCall:
        yield `${ws}fn: ${e.name}`;
        for (let i = 0, len = e.args.length; i < len; i++) {
          yield* step(np, e.args[i], i === len - 1);
        }
        break;
    }
  }
  return step("", e, true);
}

export function reduce(main: Ast.Expr): Ast.IR {
  function step(e: Ast.Expr): Ast.IR {
    switch (e.t) {
      case NodeType.Num:
      case NodeType.ID:
        return e;
      case NodeType.FuncCall: {
        return node.fn(e.name, e.args.map(step));
      }
      case NodeType.BinaryOp: {
        const a = step(e.lhs);
        const b = step(e.rhs);
        if (a.t === NodeType.Num && b.t === NodeType.Num) {
          switch (e.op) {
            case "-":
              return node.num(a.val - b.val);
            case "+":
              return node.num(a.val + b.val);
            case "*":
              return node.num(a.val * b.val);
            case "/":
              return node.num(a.val / b.val);
            case "%":
              return node.num(a.val % b.val);
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
            return node.fn("opAnd", [a, b]);
          case "||":
            return node.fn("opOr", [a, b]);
          case "*":
            return node.fn("mul", [a, b]);
          case "/":
            return node.fn("div", [a, b]);
          case "%":
            return node.fn("mod", [a, b]);
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
          case "|":
            return node.fn("flow", [a, b]);
        }
      }
    }
  }

  return step(main);
}

function getKernel() {
  return Object.entries(ops).reduce<Operator.Kernel>((a, [name, op]) => {
    a[name] = op;
    op.meta.alias.forEach((alias) => {
      a[alias] = op;
    });

    return a;
  }, {});
}

export function build(ir: Ast.IR): Operator.Unit {
  const reportingKernel = new Proxy(getKernel(), {
    get(target, name: string) {
      assert(target[name] != null, `Invalid operator: "${name}"`);
      return target[name];
    },
  });

  function step(e: Ast.IR): Operator.Unit {
    switch (e.t) {
      case NodeType.ID:
      case NodeType.Num:
        return () => e.val;
      case NodeType.FuncCall:
        return reportingKernel[e.name].fn(...e.args.map(step));
    }
  }

  return step(ir) as Operator.Unit;
}

export function compile(q: string) {
  return build(reduce(parse(q)));
}
