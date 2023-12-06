import { z } from "zod"
import { vi, it, expect, describe, type Mock, beforeEach, afterEach } from "vitest"

import { Resource } from ".."

class TestResource extends Resource.resourceExtend({
	value: z.number(),
}) {}

vi.mock("svelte/store", async (importOriginal) => ({
	...(await importOriginal<object>()),
	writable: (initial: unknown) => {
		const setSpy = vi.fn()
		setSpy(initial)

		return { set: setSpy }
	},
}))

describe("helpers", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe("applySvelteMixin", () => {
		it("should debounce updates to the store", async () => {
			const resource = new TestResource({ value: 123 })

			// @ts-expect-error - Accessing a protected property
			const storeSpy = resource._resourceStore.set as Mock
			expect(storeSpy).toHaveBeenCalledTimes(1)

			// It should update the internal store shortly after instantiation
			vi.advanceTimersByTime(500)
			expect(storeSpy).toHaveBeenCalledTimes(2)

			// If we set the value multiple times, it should only update the store once
			for (let i = 0; i < 10; i++) resource.value = i
			vi.advanceTimersByTime(500)
			expect(storeSpy).toHaveBeenCalledTimes(3)
		})
	})
})
