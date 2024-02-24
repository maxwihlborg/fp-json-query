import { cac } from "cac";
import * as query from "./query";

const name = "fq";
const cli = cac(name);

cli
  .command("<query> [file]", "Run functional operations on input file or stdin")
  .option("-o, --out <path>", "Write the result to a file")
  .example(
    `${name} "map(union(pick(email, name), project(age, meta.age)) | filter(.age > 2)" users.json`,
  )
  .action(
    async (
      q: string,
      _file: string | undefined,
      options: {
        out?: string;
      },
    ) => {
      try {
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
    },
  );

cli.help();
cli.version("0.0.1");

cli.parse();
