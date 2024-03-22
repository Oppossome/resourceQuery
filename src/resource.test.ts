import { z } from "zod"
import { vi, it, expect, describe, beforeEach, afterEach } from "vitest"

import { Resource, uniqueId, type Input } from "./resource"
import { Metadata, Util } from "./helpers"

export function spyOnEvent<V>(input: Util.WeakEventBus<V>) {
	const spy = vi.fn()
	input.subscribe(spy)
	return spy
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.runAllTimers()
	vi.restoreAllMocks()
})

describe("Resource", () => {
	class User extends Resource.resourceExtend({
		name: uniqueId(),
	}) {}

	class Message extends User.resourceExtend({
		message: z.string(),
	}) {
		override get message() {
			return `${this.name}: ${super.message}`
		}

		override set message(value: string) {
			super.message = value
		}
	}

	it("should be possible to extend a resource", () => {
		const message = new Message({ name: "John Doe", message: "Hello, world!" })
		expect(message.message).toBe("John Doe: Hello, world!")
	})

	it("should return an existing resource if the uniqueId is the same", () => {
		const firstMessage = new Message({ name: "John Doe", message: "Hello, world!" })
		expect(firstMessage.message).toBe("John Doe: Hello, world!")

		const secondMessage = new Message({ name: "John Doe", message: "Hello, foo!" })
		expect(firstMessage.message).toBe("John Doe: Hello, foo!")
		expect(firstMessage).toBe(secondMessage)
	})

	it("should stringify without exposing any internal properties", () => {
		const message = new Message({ name: "John Doe", message: "Hello, world!" })
		expect(JSON.stringify(message)).toBe('{"name":"John Doe","message":"Hello, world!"}')
	})

	it("should throw an error if the input is invalid", () => {
		// @ts-expect-error - This is intentional
		expect(() => new Message({ name: "John Doe", message: 123 })).toThrow()

		// @ts-expect-error - This is intentional
		expect(() => new Message(true)).toThrow("Invalid Input - Expected object but got 'true'")
	})

	it("should dispatch onUpdate events", () => {
		const message = new Message({ name: "John Doe", message: "Hello, world!" })
		new Message({ name: "Jane Doe", message: "Hello, world!" }) // This should not fire an event

		const updateSpy = spyOnEvent(Metadata.get(message).onUpdate)

		vi.runAllTimers()
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(message)

		message.message = "Hello, foo!"
		message.message = "Hello, foo 2!" // Should debounce
		vi.runAllTimers()
		expect(updateSpy).toHaveBeenCalledTimes(2)
		expect(updateSpy).toHaveBeenCalledWith(message)
	})

	it("should dispatch onGet events", () => {
		const message = new Message({ name: "John Doe", message: "Hello, world!" })
		const getSpy = spyOnEvent(Metadata.get(message).onGet)

		vi.runAllTimers()
		expect(getSpy).toHaveBeenCalledTimes(0)

		const _get = message.message
		vi.runAllTimers()
		expect(getSpy).toHaveBeenCalledTimes(1)
		expect(getSpy).toHaveBeenCalledWith(message)
	})

	it("should forward its events to the static events", () => {
		const message = new Message({ name: "John Doe", message: "Hello, world!" })
		const updateSpy = spyOnEvent(Metadata.get(Message).onUpdate)

		vi.runAllTimers()
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(message)

		message.message = "Hello, foo!"
		vi.runAllTimers()
		expect(updateSpy).toHaveBeenCalledTimes(2)
		expect(updateSpy).toHaveBeenCalledWith(message)
	})

	it("shouldn't leak subresource methods to the parent", () => {
		const parentTestSpy = vi.fn()
		class ParentResource extends Resource.resourceExtend({
			key: uniqueId(),
		}) {
			test() {
				parentTestSpy()
			}
		}

		const subTestSpy = vi.fn()
		class SubResource extends ParentResource.resourceExtend({
			value: z.string(),
		}) {
			override test() {
				subTestSpy()
			}
		}

		new SubResource({ key: "123", value: "foo" })
		new ParentResource({ key: "123" }).test()

		expect(subTestSpy).toHaveBeenCalledTimes(0)
		expect(parentTestSpy).toHaveBeenCalledTimes(1)
	})
})

describe("Resource.withUpdates", () => {
	const updateSpy = vi.fn()

	class Message extends Resource.resourceExtend({
		userId: z.string(),
		message: z.string(),
	}) {
		//
	}

	class Roles extends Resource.resourceExtend({
		userId: uniqueId(),
		role: z.string(),
	}) {}

	class User extends Resource.resourceExtend({
		id: uniqueId(),
		role: z.optional(Roles.resourceSchema()),
		messages: z.array(Message.resourceSchema()),
	}) {
		constructor(input: Input<typeof User>) {
			super(input)

			this.withUpdates((method) => {
				this.role = method.queryOne(Roles, (role) => role.userId === this.id)
			})

			this.withUpdates((methods) => {
				this.messages = methods.queryMany(
					Message,
					(message) => {
						updateSpy()
						return message.userId === this.id
					},
					this.messages,
				)
			})
		}
	}

	afterEach(() => {
		vi.runAllTimers()
		updateSpy.mockClear()
	})

	it("should keep the user's list of messages up to date", () => {
		const user = new User({ id: "123", messages: [] })
		const message = new Message({ userId: "123", message: "Hello, world!" })

		vi.runAllTimers()
		expect(user.messages).toEqual([message])

		const message2 = new Message({ userId: "123", message: "Hello, world!" })

		vi.runAllTimers()
		expect(user.messages).toEqual([message, message2])
	})

	it("should keep the user's role up to date", () => {
		const user = new User({ id: "123", messages: [] })
		const role = new Roles({ userId: "123", role: "admin" })

		vi.runAllTimers()
		expect(user.role).toBe(role)
	})

	it("shouldn't excessively update if the user has been reinstantiated", () => {
		new User({ id: "123", messages: [] })
		new User({ id: "123", messages: [] })
		new Message({ userId: "123", message: "Hello, world!" })

		vi.runAllTimers()
		expect(updateSpy).toHaveBeenCalledTimes(1)
	})
})
