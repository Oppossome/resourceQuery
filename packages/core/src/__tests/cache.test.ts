import { it, vi, expect, describe } from "vitest"
import { z } from "zod"

import { beforeEach } from "node:test"
import { Cache } from "../cache"
import { Query } from "../query"
import * as Resource from "../resource"

class Test extends Resource.resourceExtend({
	id: z.string(),
	value: z.string(),
}) {
	static classSpy = vi.fn()

	@Cache
	static fetch(input: Resource.input<typeof Test>) {
		return new Query({
			schema: Test.resourceSchema(),
			query: async function (schema) {
				Test.classSpy(input)
				return schema.parse(input)
			},
		})
	}
}

describe("Cache", () => {
	beforeEach(() => {
		Test.classSpy.mockReset()
	})

	it("Should cache the result of a query", async () => {
		for (let i = 0; i < 3; i++) Test.fetch({ id: i.toString(), value: "Test" })
		expect(Test.classSpy).toBeCalledTimes(3)

		for (let i = 0; i < 3; i++) Test.fetch({ id: i.toString(), value: "Test" })
		expect(Test.classSpy).toBeCalledTimes(3)
	})
})
