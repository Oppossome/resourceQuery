import { z } from "zod"
import { vi, it, expect, describe, beforeEach, afterEach } from "vitest"

import { spyOnEvent } from "./resource.test"
import { Query, Manager, type QueryOptions } from "./query"
import { Metadata, Util } from "./helpers"
import { Resource } from "./resource"

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
			await Util.wait(100)

			this.withUpdates(({ queryOne }) => {
				queryOne(Resource, () => true)
			})

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

	it("should catch errors and set the error field", async () => {
		// @ts-expect-error - This is intentional
		let query = getTestQuery("123")

		const resolvePromise = query.resolved()
		await vi.runAllTimersAsync()

		query = await resolvePromise
		expect(query.error).not.toBeUndefined()
	})

	it("should reset the update managers when invalidate is called", async () => {
		const query = getTestQuery(123)
		const queryMetadata = Metadata.get(query)

		query.resolved()
		await vi.runAllTimersAsync()

		expect(queryMetadata.updateManagers.length).toBe(1)
		query.invalidate()

		expect(queryMetadata.updateManagers.length).toBe(0)
		await vi.runAllTimersAsync()

		expect(queryMetadata.updateManagers.length).toBe(1)
	})

	it("should be possible to extend the Query class", async () => {
		interface TestOptions<Schema extends z.ZodSchema<{ page: number }>, Props extends any[]>
			extends QueryOptions<Schema, Props> {
			test: 5
		}

		class TestQuery<
			Schema extends z.ZodSchema<{ page: number }>,
			Props extends any[],
		> extends Query<Schema, Props> {
			constructor(options: TestOptions<Schema, Props>, ...props: Props) {
				super(options, ...props)
			}

			static override defineQuery<
				Schema extends z.ZodSchema<{ page: number }>,
				Props extends any[],
			>(options: TestOptions<Schema, Props>) {
				return new Manager(
					options,
					(...props: Props) => new TestQuery(options, ...props),
				).callback()
			}
		}

		const myQuery = TestQuery.defineQuery({
			test: 5,
			schema: z.object({ page: z.number() }),
			query: async function (_, test: number) {
				return { page: test }
			},
		})

		const query = myQuery(12345)

		// @ts-expect-error - This is intentional to for testing
		expect(query.options.test).toBe(5)
		expect(query).toBeInstanceOf(TestQuery)

		const resolvePromise = query.resolved()
		vi.runAllTimersAsync()

		expect(await resolvePromise).toBe(query)
	})
})
