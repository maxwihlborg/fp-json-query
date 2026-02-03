export enum Type {
  Itererable, // Iterable (arrays, generators)
  Value, // Non-iterable (scalars: number, string, object, etc.)
  Unknown, // Union of Iter | Val
}

export enum NodeType {
  Num,
  ID,
  BinaryOp,
  FuncCall,
}

export enum OperatorType {
  BiProducer,
  BiReducer,
  Function,
  Generator,
  Producer,
  Reducer,
  Unknown,
}

export namespace Operator {
  export type Kernel = Record<string, Operator.Any>;

  export type Unit = (...args: any) => any;

  export interface Meta {
    alias: string[];
    symbol?: string;
  }

  export type Mapper = {
    readonly "~type": { input: Type.Itererable; output: Type.Itererable };
    t: OperatorType.Generator;
    fn(...as: Unit[]): (it: Iterable<unknown>) => Iterable<any>;
    meta: Meta;
  };

  export type Producer = {
    readonly "~type": { input: Type.Value; output: Type.Itererable };
    t: OperatorType.Producer;
    fn(...as: Unit[]): (x: any) => Iterable<any>;
    meta: Meta;
  };

  export type Reducer = {
    readonly "~type": { input: Type.Itererable; output: Type.Value };
    t: OperatorType.Reducer;
    fn(...as: Unit[]): (it: Iterable<unknown>) => any;
    meta: Meta;
  };

  export type Fn = {
    readonly "~type": { input: Type.Value; output: Type.Value };
    t: OperatorType.Function;
    fn(...as: Unit[]): (x: any) => any;
    meta: Meta;
  };

  export type Unknown = {
    readonly "~type": { input: Type.Unknown; output: Type.Unknown };
    t: OperatorType.Unknown;
    fn(...as: Unit[]): (x: any) => any;
    meta: Meta;
  };

  export type BiReducer = {
    readonly "~type": { input: Type.Unknown; output: Type.Value };
    t: OperatorType.BiReducer;
    fn(...as: Unit[]): (it: any) => any;
    meta: Meta;
  };

  export type BiProducer = {
    readonly "~type": { input: Type.Unknown; output: Type.Itererable };
    t: OperatorType.BiProducer;
    fn(...as: Unit[]): (it: any) => Iterable<any>;
    meta: Meta;
  };

  export type Any =
    | Mapper
    | Producer
    | Reducer
    | Fn
    | Unknown
    | BiProducer
    | BiReducer;
}

function makeOp<T extends Operator.Any>(
  t: T["t"],
  input: T["~type"]["input"],
  output: T["~type"]["output"],
) {
  return (fn: T["fn"], meta?: Partial<Operator.Meta>): T =>
    ({
      "~type": { input, output },
      t,
      fn,
      meta: { alias: meta?.alias ?? [], symbol: meta?.symbol },
    }) as T;
}

export const mapperOp = makeOp<Operator.Mapper>(
  OperatorType.Generator,
  Type.Itererable,
  Type.Itererable,
);

export const producerOp = makeOp<Operator.Producer>(
  OperatorType.Producer,
  Type.Value,
  Type.Itererable,
);

export const reducerOp = makeOp<Operator.Reducer>(
  OperatorType.Reducer,
  Type.Itererable,
  Type.Value,
);

export const fnOp = makeOp<Operator.Fn>(
  OperatorType.Function,
  Type.Value,
  Type.Value,
);

export const biReducerOp = makeOp<Operator.BiReducer>(
  OperatorType.BiReducer,
  Type.Unknown,
  Type.Value,
);

export const biProducerOp = makeOp<Operator.BiProducer>(
  OperatorType.BiProducer,
  Type.Unknown,
  Type.Itererable,
);

export const unknownOp = makeOp<Operator.Unknown>(
  OperatorType.Unknown,
  Type.Unknown,
  Type.Unknown,
);
