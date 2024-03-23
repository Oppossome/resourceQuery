import { z } from "zod"
import { vi, it, expect, describe, beforeEach, afterEach } from "vitest"

import { ResourceUpdateManager } from "./updateManager"
import { Resource } from "./resource"

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.runAllTimers()
	vi.restoreAllMocks()
})

describe("ResourceUpdateManager", () => {
	class Message extends Resource.resourceExtend({
		name: z.string(),
		message: z.string(),
	}) {}

	it("should be possible to cancel the update manager", () => {
		const updateSpy = vi.fn()
		const updateManager = new ResourceUpdateManager(({ queryOne, queryMany }) => {
			queryMany(Message, (resource) => resource.name === "Jane Doe", [])
			queryOne(Message, (resource) => resource.name === "Jane Doe")
			updateSpy()
		})

		vi.runAllTimers()
		expect(updateSpy).toHaveBeenCalledTimes(1)
		new Message({ name: "Jane Doe", message: "Hello, world!" })

		// Ensure that it's updating as expected
		vi.runAllTimers()
		expect(updateSpy).toHaveBeenCalledTimes(2)

		// Cancel the update manager
		new Message({ name: "Jane Doe", message: "Hello, world!" })
		updateManager.cancel()
		vi.runAllTimers()

		expect(updateSpy).toHaveBeenCalledTimes(2)
	})

	it("queryOne should function as intended", () => {
		const updateSpy = vi.fn()
		const updateManager = new ResourceUpdateManager(({ queryOne }) => {
			updateSpy(queryOne(Message, (resource) => resource.name === "John Doe"))
		})

		const testResource = new Message({ name: "John Doe", message: "Hello, world!" })
		vi.runAllTimers()

		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(testResource)
		updateManager.cancel()
	})

	it("queryMany should function as intended", () => {
		const updateSpy = vi.fn()
		const updateManager = new ResourceUpdateManager(({ queryMany }) => {
			updateSpy(queryMany(Message, (resource) => resource.name === "Jane Doe", []))
		})

		const firstJaneMessage = new Message({ name: "Jane Doe", message: "Hello, world!" })
		const secondJaneMessage = new Message({ name: "Jane Doe", message: "Hello, world!" })

		vi.runAllTimers()
		expect(updateSpy).toHaveBeenCalledTimes(2)
		expect(updateSpy).toHaveBeenCalledWith([firstJaneMessage, secondJaneMessage])
		updateManager.cancel()
	})
})
