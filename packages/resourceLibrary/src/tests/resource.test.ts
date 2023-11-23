import { test, describe, expect } from "vitest"
import { z } from "zod"

import { Resource } from "../resource"

describe("Resource", () => {
	describe("resourceExtend", () => {
		class IdResource extends Resource.resourceExtend({ id: z.string() }) {
			get fancyName() {
				return `id: ${this.id}`
			}
		}

		class IdNameResource extends IdResource.resourceExtend({ name: z.string() }) {
			override get fancyName() {
				return `name: ${this.name}, ${super.fancyName}`
			}
		}

		test("Methods should be available on the extended class", () => {
			const resource = new IdNameResource({ id: "1", name: "test" })
			expect(resource.fancyName).toBe("name: test, id: 1")
		})
	})
})
