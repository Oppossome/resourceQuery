export type Simplify<T> = { [K in keyof T]: T[K] } & {}

export type Combine<T, E> = Simplify<Omit<T, keyof E> & E>

// prettier-ignore
export type PrototypeCombine<T extends { prototype: any }, E> =
  T extends { prototype: infer P }
    ? Combine<P, E>
    : never
