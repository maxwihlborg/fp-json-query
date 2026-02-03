import { bold, cyan, green, magenta } from "colorette";
import type { Ast } from "./query";
import { Type, type Operator, NodeType } from "./types";

export interface TypeError {
  message: string;
  node: Ast.IR;
}

export function inferType(ir: Ast.IR, kernel: Operator.Kernel): Type {
  switch (ir.t) {
    case NodeType.Num:
    case NodeType.ID:
      return Type.Value;
    case NodeType.FuncCall: {
      const op = kernel[ir.name];
      if (!op) {
        return Type.Unknown;
      }

      // Special case: flow returns the type of its last argument
      if (ir.name === "flow" && ir.args.length > 0) {
        return inferType(ir.args[ir.args.length - 1], kernel);
      }

      return op["~type"].output;
    }
    default:
      return Type.Unknown;
  }
}

export const showType = (t: Type): string => {
  switch (t) {
    case Type.Itererable:
      return cyan("iterable");
    case Type.Value:
      return magenta("value");
    case Type.Unknown:
      return "unknown";
  }
};

export function getInputType(op: Operator.Any): Type {
  return op["~type"].input;
}

function compatible(actual: Type, expected: Type): boolean {
  if (expected === Type.Unknown || actual === Type.Unknown) {
    return true;
  }
  return actual === expected;
}

export function typecheck(ir: Ast.IR, kernel: Operator.Kernel): TypeError[] {
  const errors: TypeError[] = [];

  function check(node: Ast.IR, inputType?: Type): void {
    if (node.t !== NodeType.FuncCall) {
      return;
    }

    const op = kernel[node.name];
    if (!op) {
      errors.push({
        message: `Unknown operator: ${node.name}`,
        node,
      });
      return;
    }

    const opInputType = getInputType(op);

    // Check if the input type to this operator matches what it expects
    if (inputType !== undefined && !compatible(inputType, opInputType)) {
      errors.push({
        message: `${bold(green(node.name))} expects ${showType(opInputType)}, but receives ${showType(inputType)}`,
        node,
      });
    }

    // Special case: flow - check the chain
    if (node.name === "flow") {
      let currentType = inputType ?? Type.Unknown;
      for (const arg of node.args) {
        check(arg, currentType);
        currentType = inferType(arg, kernel);
      }
      return;
    }

    // Recursively check arguments (they receive Val by default)
    for (const arg of node.args) {
      check(arg);
    }
  }

  check(ir);
  return errors;
}

export function showError(err: TypeError): string {
  return err.message;
}
