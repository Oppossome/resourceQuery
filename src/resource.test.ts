import { z } from "zod"
import { it, expect, describe } from "vitest"
import { Resource, uniqueId } from "./resource"

describe("Resource", () => {
	class User extends Resource.extend({
		name: uniqueId(z.string()),
	}) {}

	class Message extends User.extend({
		content: z.string(),
	}) {
		get message() {
			return `${this.name}: ${this.content}`
		}
	}

	it("should be possible to extend a resource", () => {
		const message = new Message({
			name: "John Doe",
			content: "Hello, world!",
		})

		expect(message.message).toBe("John Doe: Hello, world!")
	})

	it("should return an existing resource if the uniqueId is the same", () => {
		const firstMessage = new Message({
			name: "John Doe",
			content: "Hello, world!",
		})

		expect(firstMessage.message).toBe("John Doe: Hello, world!")

		const secondMessage = new Message({
			name: "John Doe",
			content: "Hello, foo!",
		})

		expect(firstMessage.message).toBe("John Doe: Hello, foo!")
		expect(firstMessage).toBe(secondMessage)
	})
})
