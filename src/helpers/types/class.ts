import { C, O } from "ts-toolbelt"

import { type Simplify } from "./object"

// prettier-ignore
type Extend<Object extends O.Object, Extension extends O.Object> = 
  Simplify<Omit<Object, keyof Extension> & Extension>

// prettier-ignore
export type ExtendClass<Class extends C.Class, Object extends O.Object> = 
  Object extends C.Class<infer P, infer R> 
    ? Extend<Class, Omit<Object, "new">> & C.Class<P, R>
    : Extend<Class, Object>
