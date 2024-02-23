import { cac } from "cac";
import * as query from "./query";

const name = "fq";
const cli = cac(name);

cli
  .command("<query> [file]", "Run functional operations on input file or stdin")
  .example(`${name} "map(pick(foo, bar)) | filter(.foo > 2)" test.json`)
  .action(async (q: string, _file: string | undefined) => {
    try {
      const prog = query.parse(q);

      console.log(query.show(prog));
      console.log(query.show(query.compile(prog)));
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message);
      }
    }
  });

cli.help();
cli.version("0.0.1");

cli.parse();
