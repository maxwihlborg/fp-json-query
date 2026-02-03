# FP Json CLI

<!-- BEGIN BADGES -->

![version](https://img.shields.io/badge/version-0.1.5-blue.svg)
![tests](https://img.shields.io/badge/tests-passing-green.svg)
[![NPM Version](https://img.shields.io/npm/v/fp-json-cli)](https://www.npmjs.com/package/fp-json-cli)

<!-- END BADGES -->

`fq` is a command line tool that embodies the Unix philosophy of small, composable functions that can be piped together using the `|` operator. It simplifies the process of filtering and querying JSON data, drawing inspiration from popular tools like [jq](https://jqlang.github.io/jq/) et al., while aiming to provide a more familiar experience for JavaScript and Typescript developers.

<!-- BEGIN TOC -->

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
  - [Examples](#examples)
    - [List all Operators in Reverse Order](#list-all-operators-in-reverse-order)
    - [Remove Properties from API Data](#remove-properties-from-api-data)
  - [CLI](#cli)
  - [Operators](#operators)
- [TODO](#todo)

<!-- END TOC -->

## Installation

```shell
npm install --global fp-json-cli
```

```shell
yarn global add fp-json-cli
```

```shell
pnpm install --global fp-json-cli
```

## Usage

You can either read JSON data from `stdin` by using a command like `cat package.json | fq ".name"`, or provide the file name as the second argument, eg. `fq ".name" package.json`.

One of the more interesting use cases for `fq` is when you want to change the format of JSON data. By piping together multiple `fq` operators, you can transform JSON data from one format to another easily.

### Examples

#### List all Operators in Reverse Order

```console
fq list --json | fq "chain(.alias) | sort(.) | reverse(.)"
```

- `fq list --json`: Write all available operators in JSON format to stdout.
- `chain(.alias)`: Is a shorthand for `flatMap(get(alias))`, which concatenates the alias JSON arrays together.
- `sort(.)`: Sort the JSON array.
- `reverse(.)`: Reverse the sorted array.

#### Remove Properties from API Data

```console
curl -X GET https://jsonplaceholder.typicode.com/users > users.json # save response to a file
fq -o users-out.json "map(u(omit(company), p(address, .address|omit(geo)))) | filter(.id >= 4) | take(2)" users.json
```

- `map(u(omit(company), p(address, .address|omit(geo))))`: This operation maps each user object in the JSON data. It omits the `company` field from the user object and re-projects the `address` field without the `geo` field.
- `filter(.id >= 4)`: Filters the mapped user objects based on the condition that the `id` field is greater than or equal to 4.
- `take(2)`: Takes the first 2 filtered user objects.

The final result of these operations is written to the `users-out.json` file.

### CLI

<!-- BEGIN USAGE -->

```
fq/0.1.5

Usage:
  $ fq <query> [file]

Commands:
  <query> [file]  Run fp style operators on input file or stdin
  list            List available operators

For more info, run any command with the `--help` flag:
  $ fq --help
  $ fq list --help

Options:
  -o, --out <path>       Write the result to a file 
  -c, --commit           Update file in place when reading from a file (default: false)
  -n, --indent <number>  Indent level (default: 4)
  --color                Color output (default: true)
  --show-ast             Dump AST to stdout (default: false)
  --show-ir              Dump intermediate representation to stdout (default: false)
  -h, --help             Display this message 
  -v, --version          Display version number 

Examples:
fq "map(union(pick(email, name), project(age, meta.age)) | filter(.age > 2)" users.json
```

<!-- END USAGE -->

### Operators

<!-- BEGIN OPS -->

| Name              | Alias     |
| :---------------- | :-------- |
| add               |           |
| average           | avg, mean |
| constant          | c         |
| count             | len       |
| divide            | div       |
| entries           |           |
| equals            | eq        |
| every             | and       |
| filter            |           |
| first             | head, fst |
| flatMap           | chain     |
| flow              |           |
| get               | pluck     |
| greaterThan       | gt        |
| greaterThanEquals | gte       |
| identity          | id, i     |
| includes          | has       |
| last              | lst       |
| lessThan          | lt        |
| lessThanEquals    | lte       |
| map               |           |
| max               |           |
| median            |           |
| merge             |           |
| min               |           |
| multiply          | mul       |
| not               |           |
| notEquals         | neq       |
| omit              |           |
| pick              |           |
| project           | p         |
| range             |           |
| reverse           |           |
| skip              |           |
| some              | or        |
| sort              |           |
| subract           | sub       |
| sum               | total     |
| tail              |           |
| take              |           |
| union             | u         |
| unique            | uniq      |

<!-- END OPS -->

## TODO

- [ ] Error reporting
- [ ] Type checking
- [x] Reduce/fold operators
- [x] Streaming parsing and serializing for large files
- [x] Highlight output similar to `jq`
