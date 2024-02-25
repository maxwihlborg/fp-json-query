import { cac } from "cac";
import fs from "node:fs";
import * as ins from "./instructions";
import * as query from "./query";
import type { Writable, Readable } from "node:stream";

const name = "fq";
const cli = cac(name);

cli.command("list", "List all available ops").action(() => {
  const arr = Object.entries(ins)
    .map(([name, i]) => ({
      name,
      alias: i.meta.alias,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const max = arr.reduce((a, b) => Math.max(a, b.name.length), 0);

  console.log(`  ${"Name".padEnd(max)} Alias\n`);
  for (const { name, alias } of arr) {
    console.log(`  ${name.padEnd(max)} ${alias.join(", ")}`);
  }
});

function isIterator(arg: unknown): arg is IterableIterator<any> {
  return Boolean(
    arg &&
      typeof (arg as any)[Symbol.iterator] === "function" &&
      typeof (arg as any).next === "function",
  );
}

cli
  .command("<query> [file]", "Run functional operations on input file or stdin")
  .option("-o, --out <path>", "Write the result to a file")
  .option("--no-nl", "Don't add a new line at the end")
  .example(
    `${name} "map(union(pick(email, name), project(age, meta.age)) | filter(.age > 2)" users.json`,
  )
  .action(
    async (
      q: string,
      file: string | undefined,
      options: {
        out?: string;
        nl?: boolean;
      },
    ) => {
      try {
        const program = query.compile(q);

        const inputStream: Readable = file
          ? fs.createReadStream(file)
          : process.stdin;

        let buffer = Buffer.from("", "utf8");
        for await (const chunk of inputStream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        const out = program(JSON.parse(buffer.toString()));

        const outputStream: Writable = options.out
          ? fs.createWriteStream(options.out)
          : process.stdout;

        if (isIterator(out)) {
          outputStream.write(JSON.stringify(Array.from(out), null, 2));
        } else if (typeof out === "object") {
          outputStream.write(JSON.stringify(out, null, 2));
        } else {
          outputStream.write(String(out));
        }
        if (options["nl"]) {
          outputStream.write("\n");
        }
      } catch (e) {
        console.log(e);
        if (e instanceof Error) {
          console.log(e.message);
        }
      }
    },
  );

cli.help();
cli.version("0.0.1");

cli.parse();
