import { describe, expect, it } from "vitest"
import { z } from "zod"

import { Resource, uniqueId } from "../resource"

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
		const firstUser = new User({ id: "1234", name: "Test" })
		const secondUser = new User({ id: "12345", name: "Test2" })
		const thirdUser = new User({ id: "1234", name: "Test3" })

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
		expect(test.toJSON(), "Private fields should be eliminated").toStrictEqual({
			content: "Hello world!",
			name: "Test",
			id: "123",
		})
	})
})
