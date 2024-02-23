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
    rhs: [
      op:
        | p.InferParserResult<typeof token.Z_ADD_OPS>
        | p.InferParserResult<typeof token.Z_MUL_OPS>,
      val: Expr,
    ][];
  };

  export type FuncCall = {
    t: AstType.FuncCall;
    name: string;
    args: Expr[];
  };

  export type Predicate = {
    t: AstType.Predicate;
    op: p.InferParserResult<typeof token.Z_CMP_OPS>;
    lhs: Expr;
    rhs: Expr;
  };

  export type Expr = Num | ID | BinaryOp | FuncCall | Predicate;
}

enum AstType {
  Num,
  ID,
  BinaryOp,
  FuncCall,
  Predicate,
}

const LEXER_RE = p.joinRes(
  [
    /<=|>=|==|!=|!!/,
    /\|\|/,
    /\&\&/,
    /[(),|<>/*+\-!]/,
    p.NUM_RE,
    /\.\w*/,
    /\w+(:?\.\w+)*/,
  ],
  "g",
);

const token = {
  AMP_D: p.lit("&&"),
  BANG_D: p.lit("!!"),
  BANG: p.lit("!"),
  COMMA: p.lit(","),
  DOT: p.lit("."),
  MINUS: p.lit("-"),
  PARAN_L: p.lit("("),
  PARAN_R: p.lit(")"),
  PIPE: p.lit("|"),
  PIPE_D: p.lit("||"),
  Z_MUL_OPS: p.enum(["*", "/"]),
  Z_ADD_OPS: p.enum(["-", "+"]),
  Z_CMP_OPS: p.enum(["==", "!=", ">", ">=", "<", "<="]),
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
  fn: (name: string, args: Ast.Expr[]): Ast.FuncCall => ({
    t: AstType.FuncCall,
    name,
    args,
  }),
  biOp: (lhs: Ast.Expr, rhs: Ast.BinaryOp["rhs"]): Ast.BinaryOp => ({
    t: AstType.BinaryOp,
    lhs,
    rhs,
  }),
  pred: (
    lhs: Ast.Expr,
    op: Ast.Predicate["op"],
    rhs: Ast.Expr,
  ): Ast.Predicate => ({
    t: AstType.Predicate,
    op,
    lhs,
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
    p.map(
      p.regex(
        p.wrapRe(
          p.joinRes([
            /\.\w+/, // .foo
            /\.?\w+(:?\.\w+)+/, // foo.bar or .foo.bar
          ]),
        ),
      ),
      (val) => {
        const norm = val.startsWith(".") ? val.substring(1) : val;
        return node.fn("get", norm.split(".").map(node.id));
      },
    ),
    p.map(p.lit("."), () => node.fn("id", [])),
  ]),
);

const parseExpression: p.Parser<Ast.Expr> = p.lazy(
  () => parseEqualityExpression,
);

const parseEqualityExpression: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([parseAddativeExpr, token.Z_CMP_OPS, parseAddativeExpr]),
      ([lhs, op, rhs]) => node.pred(lhs, op, rhs),
    ),
    parseAddativeExpr,
    p.map(token.BANG_D, () =>
      node.pred(node.fn("id", []), "!=", node.id("null")),
    ),
  ]),
);

const parseAddativeExpr: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([
        parseMultiplicativeExpr,
        p.many1(p.tuple([token.Z_ADD_OPS, parseMultiplicativeExpr])),
      ]),
      ([lhs, rhs]) => node.biOp(lhs, rhs),
    ),
    parseMultiplicativeExpr,
  ]),
);

const parseMultiplicativeExpr: p.Parser<Ast.Expr> = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([
        parsePrimaryExpr,
        p.many1(p.tuple([token.Z_MUL_OPS, parsePrimaryExpr])),
      ]),
      ([lhs, rhs]) => node.biOp(lhs, rhs),
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
    parseFuncCall,
    parseId,
    p.map(p.tuple([token.BANG, parsePrimaryExpr]), ([_, rhs]) =>
      node.fn("not", [rhs]),
    ),
    p.map(p.tuple([token.MINUS, parsePrimaryExpr]), ([_, rhs]) =>
      node.biOp(node.num(-1), [["*", rhs]]),
    ),
  ]),
);

const parseQuery: p.Parser<Ast.FuncCall[]> = p.sep(token.PIPE, parseFuncCall);

export const parse = p.make(LEXER_RE, parseQuery);

export const show = (e: Ast.Expr) => {
  function* step(p: string, e: Ast.Expr): IterableIterator<string> {
    switch (e.t) {
      case AstType.Num:
        yield `${p}nr: ${e.val}`;
        break;
      case AstType.ID:
        yield `${p}id: ${e.val}`;
        break;
      case AstType.Predicate:
        yield `${p}cn: ${e.op}`;
        yield* step(p + "  ", e.lhs);
        yield* step(p + "  ", e.rhs);
        break;
      case AstType.BinaryOp:
        yield* step(p, e.lhs);
        for (const [o, r] of e.rhs) {
          yield `${p}  bi: ${o}`;
          yield* step(p + "  ", r);
        }
        break;
      case AstType.FuncCall:
        yield `${p}fn: ${e.name}`;
        for (const a of e.args) {
          yield* step(p + "  ", a);
        }
        break;
    }
  }
  return Array.from(step("", e)).join("\n");
};
