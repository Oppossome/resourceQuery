import { z } from "zod"
import { vi, it, expect, describe, beforeEach, afterEach } from "vitest"

import { Resource, uniqueId } from "./resource"
import { Metadata } from "./helpers"
import { EventBus } from "./helpers/weak"

function spyOnEvent<V>(input: EventBus<V>) {
	const spy = vi.fn()
	input.subscribe(spy)
	return spy
}

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

	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

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
	})

	it("A resource should fire instance events", () => {
		const message = new Message({ name: "John Doe", message: "Hello, world!" })
		new Message({ name: "Jane Doe", message: "Hello, world!" }) // This should not fire an event

		const updateSpy = spyOnEvent(Metadata.get(message).onUpdate)

		vi.advanceTimersByTime(150)
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(message)

		message.message = "Hello, foo!"
		message.message = "Hello, foo 2!"
		vi.advanceTimersByTime(150)
		expect(updateSpy).toHaveBeenCalledTimes(2)
		expect(updateSpy).toHaveBeenCalledWith(message)
	})

	it("A resource should forward its events to the static events", () => {
		const message = new Message({ name: "John Doe", message: "Hello, world!" })
		const updateSpy = spyOnEvent(Metadata.get(Message).onUpdate)

		vi.advanceTimersByTime(150)
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(message)

		message.message = "Hello, foo!"
		vi.advanceTimersByTime(150)
		expect(updateSpy).toHaveBeenCalledTimes(2)
		expect(updateSpy).toHaveBeenCalledWith(message)
	})
})
