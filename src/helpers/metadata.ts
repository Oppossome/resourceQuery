export const key = Symbol("metadata")

type Object<Value> = { [key]: Value }
export type Get<Value extends Object<any>> = Value[typeof key]

export function get<Input extends Object<unknown>>(input: Input): Get<Input> {
	return input[key]
}
