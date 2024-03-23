import { z } from "zod"
import { v4 as uuid } from "uuid"

import { Metadata, Util } from "./helpers"
import { ResourceUpdateManager, type UpdateCallback } from "./updateManager"

/**
 * The current {@link ResourceMetadata} that is being updated.
 * This is used to assign the uniqueId of the current resource.
 */
let UPDATING_METADATA: ResourceMetadata | undefined

/**
 * Sets the current {@link UPDATING_METADATA} to the given metadata and calls the callback.
 * @param {ResourceMetadata} resource The resource metadata to set.
 */
function updateMetadata(resource: Resource, callback: () => void): ResourceMetadata {
	const lastMetadata = UPDATING_METADATA
	const currentMetadata = (UPDATING_METADATA = Metadata.get(resource))

	try {
		callback()
	} catch (error) {
		// If an error occurs, we want to reset the metadata to the last one.
		UPDATING_METADATA = lastMetadata
		throw error
	}

	UPDATING_METADATA = lastMetadata
	return currentMetadata
}

interface ResourceFieldStorage {
	onUpdate: Util.WeakEventBus<{ key: string }>
	fields: Record<string, unknown>
}

interface ResourceMetadata {
	uniqueId: string
	fieldStorage?: ResourceFieldStorage
	resetCallbacks: (() => void)[]
	events: {
		get: Util.WeakEventBus<{ key: string }>
		set: Util.WeakEventBus<{ key: string }>
	}
}

interface StaticResourceMetadata {
	schema: z.ZodRawShape
	storage: Util.WeakValueMap<string, Resource>
	events: {
		set: Util.WeakEventBus<{ resource: Resource; key: string }>
	}
}

const BULK_FIELD_STORAGE = new Util.WeakValueMap<string, ResourceFieldStorage>()

function getOrCreateFieldStorage(id: string) {
	let fieldStorage = BULK_FIELD_STORAGE.get(id)
	if (fieldStorage) return fieldStorage

	fieldStorage = {
		onUpdate: new Util.WeakEventBus(),
		fields: {},
	}

	BULK_FIELD_STORAGE.set(id, fieldStorage)
	return fieldStorage
}

export class Resource {
	constructor(_input: unknown) {
		// Do absolutely nothing, we just want to override the constructor
	}

	[Metadata.key]: ResourceMetadata = {
		uniqueId: uuid(),
		resetCallbacks: [],
		events: {
			get: new Util.WeakEventBus(),
			set: new Util.WeakEventBus(),
		},
	}

	withUpdates(updateCallback: UpdateCallback) {
		Metadata.get(this).resetCallbacks.push(new ResourceUpdateManager(updateCallback).cancel)
	}

	/**
	 * Because we want to listen for assignment, we need to override the toJSON method.
	 */
	toJSON() {
		return {}
	}

	// === Static Methods ===

	static [Metadata.key]: StaticResourceMetadata = {
		schema: {},
		storage: new Util.WeakValueMap(),
		events: { set: new Util.WeakEventBus() },
	}

	/**
	 * Returns a zod schema that parses the input into this resource.
	 * ```ts
	 * class User extends ResourceClass.resourceExtend({
	 * 	id: uniqueId(z.string()),
	 * 	discriminator: z.number(),
	 * 	name: z.string(),
	 * }) {
	 * 	// ...
	 * }
	 *
	 * const messageSchema = z.object({
	 * 	user: User.resourceSchema(),
	 * 	content: z.string(),
	 * })
	 *
	 * const message = messageSchema.parse({
	 * 	user: { id: "123", discriminator: 123, name: "Test" },
	 * 	content: "Hello, world!"
	 * })
	 * ```
	 */
	static resourceSchema<This extends typeof Resource>(this: This) {
		return z.unknown().transform((input) => new this(input) as InstanceType<This>)
	}

	static resourceExtend<This extends typeof Resource, Schema extends z.ZodRawShape>(
		this: This,
		schema: Schema,
	) {
		const staticMetadata = {
			schema: { ...Metadata.get(this).schema, ...schema } as Metadata.Get<This>["schema"] & Schema,
			storage: new Util.WeakValueMap(),
			events: { set: new Util.WeakEventBus() },
		} satisfies StaticResourceMetadata

		type Object = z.ZodObject<(typeof staticMetadata)["schema"]>

		// @ts-expect-error - Typescript considers this to be a mixin but we're abusing it
		class Extension extends this {
			constructor(input: z.input<Object>) {
				super(input)

				if (input === null || typeof input !== "object") {
					throw new Error(`Invalid Input - Expected object but got '${input}'`)
				}

				// https://stackoverflow.com/a/19470653 - How to get static properties of a class
				// @ts-expect-error - We're abusing the constructor
				if (staticMetadata !== Metadata.get(this.constructor)) return this

				// If we're the last in the chain, we want to do some one-time things
				// Parse the input to an intermediate object until we know the resourceId
				const parsedInput = {} as Record<string, unknown>
				const metadata = updateMetadata(this, () => {
					for (const schemaKey in staticMetadata.schema) {
						const parsedValue = staticMetadata.schema[schemaKey].parse(input[schemaKey])
						parsedInput[schemaKey] = parsedValue
					}
				})

				const cachedObject = staticMetadata.storage.get(metadata.uniqueId)
				if (cachedObject) {
					for (const key in parsedInput) {
						// @ts-expect-error - It's alright, we're assigning known keys
						cachedObject[key] = parsedInput[key]
					}
					return cachedObject
				}

				const fieldStorage = getOrCreateFieldStorage(metadata.uniqueId)
				metadata.fieldStorage = fieldStorage

				// Do some one-time things for uncached objects
				staticMetadata.storage.set(metadata.uniqueId, this)

				fieldStorage.onUpdate.subscribe(metadata.events.set.dispatch)

				metadata.events.set.subscribe((detail) =>
					staticMetadata.events.set.dispatch({ resource: this, ...detail }),
				)

				// @ts-expect-error - It's alright, we're assigning known keys
				for (const key in parsedInput) this[key] = parsedInput[key]
			}

			// Because our properties are getters and setters, we need to override the toJSON method to include them.
			toJSON() {
				const metadataObject = Metadata.get(this)
				const output: Record<string, unknown> = super.toJSON()
				for (const key in schema) output[key] = metadataObject.fieldStorage?.fields[key]
				return output
			}

			// === Static Methods ===

			static [Metadata.key] = staticMetadata
		}

		/**
		 * Assign getters and setters for each field in the schema.
		 * Upsides:
		 * - This is done to allow us to listen for changes to the fields.
		 * - Lets us
		 *
		 * Downsides:
		 * - Has the side effect of making the fields non-enumerable.
		 * - Requires us to override the toJSON method to include the fields.
		 */
		for (const key in schema) {
			Object.defineProperty(Extension.prototype, key, {
				get() {
					const metadata: ResourceMetadata = Metadata.get(this)
					if (!metadata.fieldStorage) throw new Error("fieldStorage is missing")
					metadata.events.get.dispatch({ key })
					return metadata.fieldStorage.fields[key]
				},
				set(value) {
					const fieldStorage: ResourceFieldStorage | undefined = Metadata.get(this).fieldStorage
					if (!fieldStorage) throw new Error("fieldStorage is missing")
					if (!Util.safeNotEquals(fieldStorage.fields[key], value)) return
					fieldStorage.onUpdate.dispatch({ key })
					fieldStorage.fields[key] = value
				},
			})
		}

		// Inject the new properties into the class
		return Extension as Omit<typeof Extension, "new"> & {
			new (input: z.input<Object>): This["prototype"] & z.output<Object>
			[Metadata.key]: typeof staticMetadata
		}
	}
}

/**
 * The input type for a resource.
 * @example
 * class User extends Resource.resourceExtend({
 * 	id: uniqueId(z.string()),
 * 	name: z.string(),
 * }) {
 * 	constructor(input: Input<typeof User>) {
 * 		super(input)
 * 	}
 * }
 */
export type Input<This extends typeof Resource> = z.input<z.ZodObject<Metadata.Get<This>["schema"]>>

/**
 * Returns a schema that assigns the parsed output to the current {@link UPDATING_METADATA}.
 * @template {z.ZodSchema<string, any, any>} Schema
 * @param {Schema | undefined} schemaOf
 * The schema to parse the input of, defaults to {@link z.string}.
 */
export function uniqueId<Schema extends z.ZodSchema<string, any, any>>(schemaOf?: Schema) {
	return z.unknown().transform((input, ctx) => {
		if (!UPDATING_METADATA) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unexpected uniqueId call" })
			return z.NEVER
		}

		// Parse the input of our schema
		const parseSchema = schemaOf ?? z.string()
		const parseResult = parseSchema.parse(input)

		// Assign the current resource's id to the parsed input's data
		UPDATING_METADATA.uniqueId = parseResult
		return parseResult as string
	}) as unknown as Schema
}
