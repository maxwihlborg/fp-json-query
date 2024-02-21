import { cac } from "cac";
import * as query from "./query";

const name = "fjg";
const cli = cac(name);

cli
  .command("<query> [file]", "Run functional operations on input file or stdin")
  .example(`${name} "map(pick(foo, bar)) | filter(.foo > 2)" test.json`)
  .action((q: string, _file: string | undefined) => {
    const proc = query.parse(q);

    console.log(JSON.stringify(proc, null, 2));
  });

cli.help();
cli.version("0.0.1");

cli.parse();
