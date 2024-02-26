# FP Json CLI

<!-- BEGIN BADGES -->

![version](https://img.shields.io/badge/version-0.1.1-blue.svg)
![tests](https://img.shields.io/badge/tests-passing-green.svg)
[![NPM Version](https://img.shields.io/npm/v/fp-json-cli)](https://www.npmjs.com/package/fp-json-cli)

<!-- END BADGES -->

> Simple cli inspired by [jq](https://jqlang.github.io/jq/) and built to be more familier to JavaScript and Typescript developers.

<!-- BEGIN TOC -->

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
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

### CLI

<!-- BEGIN USAGE -->

```
fq/0.1.0

Usage:
  $ fq <query> [file]

Commands:
  <query> [file]  Run fp style operators on input file or stdin
  list            List available operators

For more info, run any command with the `--help` flag:
  $ fq --help
  $ fq list --help

Options:
  -o, --out <path>  Write the result to a file 
  --no-nl           Control new line at the end output (default: true)
  --show-ast        Dump AST to stdout 
  --show-ir         Dump intermediate representation to stdout 
  -h, --help        Display this message 
  -v, --version     Display version number 

Examples:
fq "map(union(pick(email, name), project(age, meta.age)) | filter(.age > 2)" users.json
```

<!-- END USAGE -->

### Operators

<!-- BEGIN OPS -->

| Name              | Alias |
| :---------------- | :---- |
| add               |       |
| constant          | c     |
| count             | len   |
| divide            | div   |
| entries           |       |
| equals            | eq    |
| every             | and   |
| filter            |       |
| flatMap           | chain |
| flow              |       |
| get               | pluck |
| greaterThan       | gt    |
| greaterThanEquals | gte   |
| identity          | id, i |
| includes          | has   |
| lessThan          | lt    |
| lessThanEquals    | lte   |
| map               |       |
| multiply          | mul   |
| not               |       |
| notEquals         | neq   |
| omit              |       |
| pick              |       |
| project           | p     |
| range             |       |
| reverse           |       |
| skip              |       |
| some              | or    |
| sort              |       |
| subract           | sub   |
| take              |       |
| union             | u     |
| unique            | uniq  |

<!-- END OPS -->

## TODO

- [ ] Error reporting
- [ ] Type checking
- [ ] Reduce/fold operator
- [ ] Streaming parsing and serializing for large files
- [ ] Highlight output similar to `jq`
