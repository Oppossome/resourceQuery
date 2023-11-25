import { describe, expect, it } from "vitest"
import { z } from "zod"

import { Resource } from "../resource"

describe("Resource", () => {
	it("Should strip _resourceMetadata", () => {
		class SerializationTest extends Resource.resourceExtend({
			id: z.coerce.number(),
			name: z.string(),
		}) {}

		const resource = new SerializationTest({ id: 1, name: "test" })
		expect(JSON.stringify(resource)).toBe('{"id":1,"name":"test"}')
		expect(resource.toJSON()).toStrictEqual({ id: 1, name: "test" })
	})

	describe("resourceExtend", () => {
		class IdResource extends Resource.resourceExtend({ id: z.coerce.number() }) {
			get fancyName() {
				return `id: ${this.id}`
			}
		}

		class IdNameResource extends IdResource.resourceExtend({ name: z.string() }) {
			override get fancyName() {
				return `name: ${this.name}, ${super.fancyName}`
			}
		}

		it("should be possible to access ancestor methods", () => {
			// Ensures that the parsing works as expected
			const resource = IdNameResource.resourceSchema().parse({ id: 1, name: "test" })
			expect(resource.fancyName).toBe("name: test, id: 1")
		})
	})
})
