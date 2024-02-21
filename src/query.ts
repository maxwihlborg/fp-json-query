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

  export type FuncCall = {
    t: AstType.FuncCall;
    name: string;
    args: Expr[];
  };

  export type Predicate = {
    t: AstType.Predicate;
    op: p.InferParserResult<typeof parsePredicateOp>;
    lhs: Expr;
    rhs: Expr;
  };

  export type Expr = Num | ID | FuncCall | Predicate;
}

enum AstType {
  Num,
  ID,
  FuncCall,
  Predicate,
}

const LEX_RE = /<=|>=|==|!=|!!|\|\||\&\&|[(),|<>]|\d+(:?.\d+)?|\.\w*|\w+/g;

const token = {
  AMP_D: p.lit("&&"),
  BANG_D: p.lit("!!"),
  COMMA: p.lit(","),
  EQ: p.lit("=="),
  EQ_N: p.lit("!="),
  GT: p.lit(">"),
  GTE: p.lit(">="),
  LT: p.lit("<"),
  LTE: p.lit("<="),
  PARAN_L: p.lit("("),
  PARAN_R: p.lit(")"),
  PIPE: p.lit("|"),
  PIPE_D: p.lit("||"),
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

const parseNum = p.lazy(() => p.map(p.num(), (val) => node.num(val)));

const parseId = p.lazy(() => p.map(p.str(), (val) => node.id(val)));

const parsePredicateOp = p.lazy(() =>
  p.oneOf([token.LT, token.GT, token.LTE, token.GTE, token.EQ, token.EQ_N]),
);

const parsePredicate = p.lazy<Ast.Predicate>(() =>
  p.oneOf([
    p.map(
      p.tuple([
        p.oneOf([parseFuncCall, parseNum, parseId]),
        parsePredicateOp,
        p.oneOf([parseFuncCall, parseNum, parseId]),
      ]),
      ([lhs, op, rhs]) => node.pred(lhs, op, rhs),
    ),
    p.map(token.BANG_D, () =>
      node.pred(node.fn("id", []), "!=", node.id("null")),
    ),
  ]),
);

const parseFuncCallArg = p.lazy(
  (): p.Parser<Ast.Expr> =>
    p.oneOf([parsePredicate, parseFuncCall, parseNum, parseId]),
);

const parseFuncCall = p.lazy<Ast.FuncCall>(() =>
  p.oneOf([
    p.map(
      p.tuple([
        parseId,
        token.PARAN_L,
        p.sep(token.COMMA, parseFuncCallArg),
        token.PARAN_R,
      ]),
      ([name, _, args]) => node.fn(name.val, args),
    ),
    p.map(p.regex(/* .prop */ /^\.\w+$/), (val) =>
      node.fn("pluck", [node.id(val.substring(1))]),
    ),
    p.map(p.lit("."), () => node.fn("id", [])),
  ]),
);

export const parse = p.make(LEX_RE, p.sep(token.PIPE, parseFuncCall));
