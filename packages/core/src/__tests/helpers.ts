import { vi, expect } from "vitest"

/**
 * Waits for a given amount of time.
 */
export function wait(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

/**
 * Invokes the garbage collector. Requires the `--expose-gc` flag.
 */
export async function invokeGC() {
	const registrySpy = vi.fn()
	const fnReg = new FinalizationRegistry(registrySpy)
	// Spam the registry with objects, so that the GC is forced to run
	for (let i = 0; i < 100000; i++) fnReg.register({}, "test")

	// Allow time to cooldown
	await wait(100)

	// Invoke the GC, and ensure garbage collection has been run
	globalThis?.global?.gc?.()
	expect(registrySpy).toHaveBeenCalled()
}

/**
 * Expects the garbage collector to run on the provided input.
 * @param input The input to check.
 */
export async function expectGC(input: () => object) {
	// Create a weak reference to the input, and ensure it exists
	const weakRef = new WeakRef(input())
	expect(weakRef.deref()).toBeDefined()

	// Invoke the garbage collector, and ensure the input has been garbage collected
	await invokeGC()
	expect(weakRef.deref()).toBeUndefined()
}
