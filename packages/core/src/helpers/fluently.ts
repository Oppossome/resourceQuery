import { O, L, C, N, F } from "ts-toolbelt"
import { type FromEntries } from "./types"

export function fluently<Parameters extends any[], Return extends O.Object>(
	baseClass: C.Class<Parameters, Return>,
) {
	const proxyConfig = {
		get(target: any, key: string | symbol, receiver: any) {
			const value = Reflect.get(target, key, receiver)
			if (typeof value !== "function") return value

			// Return a function that returns a new proxy if the result is an instance of the base class
			return (...args: unknown[]) => {
				const valueResult = value.call(target, ...args)
				return valueResult instanceof baseClass ? new Proxy(valueResult, proxyConfig) : valueResult
			}
		},
	}

	return (...args: Parameters) => new Proxy(new baseClass(...args), proxyConfig)
}
