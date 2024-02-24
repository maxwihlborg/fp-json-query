import { cac } from "cac";
import * as query from "./query";

const name = "fq";
const cli = cac(name);

cli
  .command("<query> [file]", "Run functional operations on input file or stdin")
  .example(`${name} "map(pick(foo, bar)) | filter(.foo > 2)" test.json`)
  .action(async (q: string, _file: string | undefined) => {
    try {
      /* const ast = query.parse(q);
      const ir = query.reduce(ast);
      const pipe = query.build(ir);

      console.log(query.show(ast));
      console.log(query.show(ir));
      console.log(pipe.toString()); */

      const program = query.compile(q);

      console.log(
        Array.from(
          program(
            Array.from({ length: 20 }, (_, id) => ({
              id,
              name: `Test ${id}`,
              age: 4,
              profile: {
                friends: [1, 2, 3],
                email: `user-${id}@${["gmail", "hotmail"][id % 2]}.com`,
              },
            })),
          ),
        ),
      );
    } catch (e) {
      console.log(e);
      if (e instanceof Error) {
        console.log(e.message);
      }
    }
  });

cli.help();
cli.version("0.0.1");

cli.parse();
