import { cac } from "cac";
import * as query from "./query";

const name = "fjg";
const cli = cac(name);

cli
  .command("<query> [file]", "Run functional operations on input file or stdin")
  .example(`${name} "map(pick(foo, bar)) | filter(.foo > 2)" test.json`)
  .action((q: string, _file: string | undefined) => {
    const prog = query.parse(q);
    console.log(prog.map(query.show).join("\n"));
  });

cli.help();
cli.version("0.0.1");

cli.parse();
