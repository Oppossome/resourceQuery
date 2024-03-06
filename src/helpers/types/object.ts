import { O } from "ts-toolbelt"

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
