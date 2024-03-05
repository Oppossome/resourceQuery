import type { C, O } from "ts-toolbelt"

type SimplifyFlat<T extends O.Object> = {
	[K in keyof T]: T[K]
} & {}

type SimplifyDeep<T extends O.Object> = {
	[K in keyof T]: T[K] extends O.Object ? SimplifyDeep<T> : T[K]
} & {}

export type Simplify<T extends O.Object, D extends "flat" | "deep" = "flat"> = {
	flat: SimplifyFlat<T>
	deep: SimplifyDeep<T>
}[D]

// prettier-ignore
type Extend<Object extends O.Object, Extension extends O.Object> = 
	Simplify<Omit<Object, keyof Extension> & Extension>

// prettier-ignore
export type ExtendClass<Class extends C.Class, Object extends O.Object> = 
	Object extends C.Class<infer P, infer R> 
		? Extend<Class, Omit<Object, "new">> & C.Class<P, R>
		: Extend<Class, Object>
