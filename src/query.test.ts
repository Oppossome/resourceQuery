import { z } from "zod"
import { vi, it, expect, describe, beforeEach, afterEach } from "vitest"

import { spyOnEvent } from "./resource.test"
import { Query } from "./query"
import { Metadata } from "./helpers"

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.runAllTimers()
	vi.restoreAllMocks()
})

describe("Query", () => {
	const querySpy = vi.fn()
	const getTestQuery = Query.defineQuery({
		schema: z.object({ page: z.number() }),
		query: async function (schema, page: number = Math.random() * Number.MAX_SAFE_INTEGER) {
			querySpy(page)
			return schema.parse({ page })
		},
	})

	it("should return the same query if the input is the same", () => {
		const query = getTestQuery(5)
		const sameQuery = getTestQuery(5)
		expect(query).toBe(sameQuery)
	})

	it("should call invalidate when resource props are accessed", () => {
		const query = getTestQuery()

		vi.runAllTimers()
		expect(querySpy).toHaveBeenCalledTimes(0)

		let _ = query.result
		vi.runAllTimers()
		expect(querySpy).toHaveBeenCalledTimes(1)

		_ = query.result
		vi.runAllTimers()
		expect(querySpy).toHaveBeenCalledTimes(1)
	})

	it("should call invalidate when resource props are accessed", async () => {
		const query = getTestQuery(123)
		const updateSpy = spyOnEvent(Metadata.get(query).onUpdate)

		expect(querySpy).toHaveBeenCalledTimes(0)
		expect(updateSpy).toHaveBeenCalledTimes(0)
		await vi.runAllTimersAsync()

		const resolvePromise = query.resolved()

		expect(querySpy).toHaveBeenCalledTimes(1)
		expect(querySpy).toHaveBeenCalledWith(123)
		expect(updateSpy).toHaveBeenCalledTimes(1)

		await vi.runAllTimersAsync()
		expect(await resolvePromise).toBe(query)
	})
})
