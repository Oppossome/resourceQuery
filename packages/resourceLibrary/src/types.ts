import { O, C } from "ts-toolbelt"

// === Helpers

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
export type Extend<Object extends O.Object, Extension extends O.Object> = 
	Simplify<Omit<Object, keyof Extension> & Extension>

// prettier-ignore
export type ExtendClass<C extends C.Class, Object extends O.Object> = 
	Object extends C.Class<infer P, infer R> 
		? Extend<C, Omit<Object, "new">> & C.Class<P, R>
		: Extend<C, Object>
