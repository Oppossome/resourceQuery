import type { C, O } from "ts-toolbelt"

// === Code

/**
 * Checks if the input is an object.
 * @param input The input to check.
 * @returns Whether or not the input is an object.
 */
export function isObject(input: unknown): input is Record<string, unknown> {
	return typeof input === "object" && input !== null
}

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

export type Entries<K extends string | symbol = string | symbol, V = any> = [K, V]

// prettier-ignore
export type FromEntries<T extends Entries[]> = {
	[K in T[number] as K[1] extends never ? never : K[0]]: 
		K[1] extends Entries[]
			? FromEntries<K[1]>
			: K[1]
} & {}

// prettier-ignore
export type Extend<Object extends O.Object, Extension extends O.Object> = 
	Simplify<Omit<Object, keyof Extension> & Extension>

// prettier-ignore
export type ExtendClass<Class extends C.Class, Object extends O.Object> = 
	Object extends C.Class<infer P, infer R> 
		? Extend<Class, Omit<Object, "new">> & C.Class<P, R>
		: Extend<Class, Object>
