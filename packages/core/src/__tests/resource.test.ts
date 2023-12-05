import { describe, expect, it } from "vitest"
import { v4 as uuid } from "uuid"
import { z } from "zod"

import { Resource, uniqueId } from "../resource"
import { expectGC } from "./helpers"

class User extends Resource.resourceExtend({
	id: uniqueId(z.string()),
	name: z.string(),
}) {
	get mentionStr() {
		return `<@${this.id}>(${this.name})`
	}
}

describe("Resource", () => {
	it("should when possible, return an updated cached resource", () => {
		const firstUser = new User({ id: "duplicate", name: "Test" })
		const secondUser = new User({ id: uuid(), name: "Test2" })
		const thirdUser = new User({ id: "duplicate", name: "Test3" })

		expect(firstUser).toBe(thirdUser)
		expect(firstUser.name).toBe("Test3")
		expect(secondUser.name).toBe("Test2")
	})

	it("should have access to the base class's properties in derived classes", () => {
		class Test extends User.resourceExtend({ content: z.string() }) {
			get message() {
				return `${this.mentionStr}: ${this.content}`
			}
		}

		const test = Test.resourceSchema().parse({ id: "123", name: "Test", content: "Hello world!" })
		expect(test.message).toBe("<@123>(Test): Hello world!")
		expect(test.toJSON()).toStrictEqual({
			content: "Hello world!",
			name: "Test",
			id: "123",
		})
	})

	it("should throw an error when a property is set to an invalid value", () => {
		const testObj = new User({ id: uuid(), name: "Test" })

		// @ts-expect-error - This should throw an error
		expect(() => (testObj.name = 123)).toThrowError()

		// @ts-expect-error - This should throw an error
		expect(() => new User({ id: 123, name: 123 })).toThrowError()

		// @ts-expect-error - This should throw an error
		expect(() => new User(123)).toThrowError()
	})

	it("should garbagecollect without issue", async () => {
		await expectGC(() => new User({ id: "GC-Test", name: "Test" }))
	})
})
