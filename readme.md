# FP Json CLI

Simple cli inspired by [jq](https://jqlang.github.io/jq/) and built to be more familier to JavaScript and Typescript developers.

```
fq/0.1.0

Usage:
  $ fq <query> [file]

Commands:
  <query> [file]  Run functional operations on input file or stdin
  list            List all available ops

For more info, run any command with the `--help` flag:
  $ fq --help
  $ fq list --help

Options:
  -o, --out <path>  Write the result to a file
  --no-nl           Don't add a new line at the end (default: true)
  -h, --help        Display this message
  -v, --version     Display version number

Examples:
fq "map(union(pick(email, name), project(age, meta.age)) | filter(.age > 2)" users.json
```

## Operations

| Name              | Alias |
| :---------------- | :---- |
| add               |       |
| constant          | c     |
| count             | len   |
| divide            | div   |
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
| skip              |       |
| some              | or    |
| subract           | sub   |
| take              |       |
| union             | u     |
| unique            | uniq  |

## TODO

- [ ] Error reporting
- [ ] Type checking
- [ ] Reduce/fold operation
- [ ] Streaming parsing and serializing for large files
- [ ] Highlight output similar to `jq`
