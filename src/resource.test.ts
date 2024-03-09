import { z } from "zod"
import { vi, it, expect, describe, beforeEach, afterEach } from "vitest"

import { Resource, uniqueId } from "./resource"
import { Metadata } from "./helpers"
import { EventBus } from "./helpers/weak"

function spyOnEvent<V>(input: EventBus<V>) {
	const spy = vi.fn()
	input.subscribe((input) => {
		console.log(input)
		spy(input)
	})
	return spy
}

describe("Resource", () => {
	class User extends Resource.resourceExtend({
		name: uniqueId(),
	}) {}

	class Message extends User.resourceExtend({
		content: z.string(),
	}) {
		get message() {
			return `${this.name}: ${this.content}`
		}
	}

	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should be possible to extend a resource", () => {
		const message = new Message({ name: "John Doe", content: "Hello, world!" })
		expect(message.message).toBe("John Doe: Hello, world!")
	})

	it("should return an existing resource if the uniqueId is the same", () => {
		const firstMessage = new Message({ name: "John Doe", content: "Hello, world!" })
		expect(firstMessage.message).toBe("John Doe: Hello, world!")

		const secondMessage = new Message({ name: "John Doe", content: "Hello, foo!" })
		expect(firstMessage.message).toBe("John Doe: Hello, foo!")
		expect(firstMessage).toBe(secondMessage)
	})

	it("should stringify without exposing any internal properties", () => {
		const message = new Message({ name: "John Doe", content: "Hello, world!" })
		expect(JSON.stringify(message)).toBe('{"name":"John Doe","content":"Hello, world!"}')
	})

	it("should throw an error if the input is invalid", () => {
		// @ts-expect-error - This is intentional
		expect(() => new Message({ name: "John Doe", content: 123 })).toThrow()
	})

	it("A resource should fire instance events", () => {
		const message = new Message({ name: "John Doe", content: "Hello, world!" })
		new Message({ name: "Jane Doe", content: "Hello, world!" }) // This should not fire an event

		const updateSpy = spyOnEvent(Metadata.get(message).onUpdate)

		vi.advanceTimersByTime(150)
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(message)

		message.content = "Hello, foo!"
		message.content = "Hello, foo 2!"
		vi.advanceTimersByTime(150)
		expect(updateSpy).toHaveBeenCalledTimes(2)
		expect(updateSpy).toHaveBeenCalledWith(message)
	})

	it("A resource should forward its events to the static events", () => {
		const message = new Message({ name: "John Doe", content: "Hello, world!" })
		const updateSpy = spyOnEvent(Metadata.get(Message).onUpdate)

		vi.advanceTimersByTime(150)
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(message)

		message.content = "Hello, foo!"
		vi.advanceTimersByTime(150)
		expect(updateSpy).toHaveBeenCalledTimes(2)
		expect(updateSpy).toHaveBeenCalledWith(message)
	})
})
