import { cac } from "cac";
import { pipe } from "remeda";
import * as p from "./parser";
import { toNamespacedPath } from "path";

const name = "fjg";
const cli = cac(name);

enum NodeKind {
  Num,
  ID,
  FuncCall,
  Predicate,
}

const t = {
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
  NUM: p.map(p.num(), (val) => ({
    t: NodeKind.Num as const,
    val,
  })),
  ID: p.map(p.str(), (val) => ({
    t: NodeKind.ID as const,
    val,
  })),
} as const;

const predicate = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([
        funcCall,
        p.oneOf([t.LT, t.GT, t.LTE, t.GTE, t.EQ]),
        p.oneOf([funcCall, t.NUM, t.ID]),
      ]),
      ([lhs, op, rhs]) => ({
        t: NodeKind.Predicate as const,
        op,
        lhs,
        rhs,
      }),
    ),
    p.map(t.BANG_D, () => parse(". != null")),
  ]),
);

const funcArg = p.lazy(
  (): p.Parser<any> => p.oneOf([predicate, funcCall, t.NUM, t.ID]),
);

const funcCall = p.lazy(() =>
  p.oneOf([
    p.map(
      p.tuple([t.ID, t.PARAN_L, p.sep(t.COMMA, funcArg), t.PARAN_R]),
      ([name, _, args]) => ({
        t: NodeKind.FuncCall as const,
        name,
        args,
      }),
    ),
    p.map(p.regex(/^\.\w+$/), (val) => ({
      t: NodeKind.FuncCall as const,
      name: "pluck",
      args: [val.substring(1)],
    })),
    p.map(p.lit("."), () => ({
      t: NodeKind.FuncCall as const,
      name: "id",
      args: [],
    })),
  ]),
);

const parse = p.make(
  /<=|>=|==|!=|!!|[(),|<>]|\d+(:?.\d+)?|\.\w*|\w+/g,
  pipe(
    p.sep(t.PIPE, funcCall),
    p.map((val) => val),
  ),
);

cli
  .command("<query> [file]", "Run functional operations on input file or stdin")
  .example(`${name} "map(pick(foo, bar)) | filter(.foo > 2)" test.json`)
  .action((query: string, _file: string | undefined) => {
    const proc = parse(query);

    console.log(JSON.stringify(proc, null, 2));
  });

cli.help();
cli.version("0.0.1");

cli.parse();
