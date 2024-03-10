import { z } from "zod"
import { v4 as uuid } from "uuid"

import { Metadata, Util } from "./helpers"
import { ResourceUpdateManager, UpdateCallback } from "./resourceUpdateManager"

/**
 * The current {@link ResourceMetadata} that is being updated.
 * This is used to assign the uniqueId of the current resource.
 */
let UPDATING_METADATA: ResourceMetadata | undefined

export type Input<This extends typeof Resource> = z.input<z.ZodObject<Metadata.Get<This>["schema"]>>

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

interface ResourceMetadata {
	fields: Record<string, unknown>
	uniqueId: string
	onUpdate: Util.WeakEventBus<Resource>
	updateManagers: ResourceUpdateManager[]
}

interface StaticResourceMetadata {
	schema: z.ZodRawShape
	storage: Util.WeakValueMap<string, Resource>
	onUpdate: Util.WeakEventBus<Resource>
}

export class Resource {
	constructor(..._params: any[]) {
		// Do absolutely nothing
	}

	[Metadata.key]: ResourceMetadata = {
		fields: {},
		uniqueId: uuid(),
		onUpdate: new Util.WeakEventBus(100),
		updateManagers: [],
	}

	withUpdates(updateCallback: UpdateCallback) {
		Metadata.get(this).updateManagers.push(new ResourceUpdateManager(updateCallback))
	}

	/**
	 * Because we want to listen for assignment, we need to override the toJSON method.
	 */
	toJSON() {
		return {}
	}

	// === Static Methods ===

	static [Metadata.key] = {
		schema: {},
		storage: new Util.WeakValueMap(),
		onUpdate: new Util.WeakEventBus(),
	} satisfies StaticResourceMetadata

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
		return z.record(z.unknown()).transform((input) => new this(input) as InstanceType<This>)
	}

	static resourceExtend<This extends typeof Resource, Schema extends z.ZodRawShape>(
		this: This,
		schema: Schema,
	) {
		const newMetadata = {
			// For some reason, this is the only way to get the type to work correctly :/
			schema: { ...Metadata.get(this).schema, ...schema } as Metadata.Get<This>["schema"] & Schema,
			storage: new Util.WeakValueMap<string, Resource>(),
			onUpdate: new Util.WeakEventBus(),
		} satisfies StaticResourceMetadata

		type Object = z.ZodObject<(typeof newMetadata)["schema"]>

		// @ts-expect-error - Typescript considers this to be a mixin but we're abusing it
		class Extension extends this {
			constructor(input: z.input<Object>) {
				super(input)

				if (input === null || typeof input !== "object") {
					throw new Error(`Invalid Input - Expected object but got '${input}'`)
				}

				// Parse the input to an intermediate object until we know the resourceId
				const parsedInput = {} as z.output<Object>
				const metadata = updateMetadata(this, () => {
					for (const schemaKey in schema) {
						const parsedValue = schema[schemaKey].parse(input[schemaKey])
						parsedInput[schemaKey] = parsedValue
					}
				})

				const cachedObject = newMetadata.storage.get(metadata.uniqueId)
				const outputObject = cachedObject ?? this

				// If we have a cached object, we want to cancel its update managers so we don't register duplicate events
				if (cachedObject && cachedObject !== this) {
					const currentMetadata = Metadata.get(cachedObject)
					currentMetadata.updateManagers.forEach((manager) => manager.cancel())
					currentMetadata.updateManagers = []
				}

				// @ts-expect-error - It's alright, we're assigning known keys
				for (const key in parsedInput) outputObject[key] = parsedInput[key]
				if (cachedObject) return cachedObject

				// Do some one-time things for uncached objects
				newMetadata.storage.set(metadata.uniqueId, this)
				this[Metadata.key].onUpdate.subscribe(newMetadata.onUpdate.dispatch) // Forward
			}

			// Because our properties are getters and setters, we need to override the toJSON method to include them.
			toJSON() {
				const metadataObject = Metadata.get(this)
				const output: Record<string, unknown> = super.toJSON()
				for (const key in schema) output[key] = metadataObject.fields[key]
				return output
			}

			static [Metadata.key] = newMetadata
		}

		/**
		 * Assign getters and setters for each field in the schema.
		 * Upsides:
		 * - This is done to allow us to listen for changes to the fields.
		 *
		 * Downsides:
		 * - Has the side effect of making the fields non-enumerable.
		 * - Requires us to override the toJSON method to include the fields.
		 */
		for (const key in schema) {
			Object.defineProperty(Extension.prototype, key, {
				get() {
					return this[Metadata.key].fields[key]
				},
				set(value) {
					this[Metadata.key].fields[key] = value
					this[Metadata.key].onUpdate.dispatch(this)
				},
			})
		}

		// Inject the new properties into the class
		return Extension as Omit<typeof Extension, "new"> & {
			new (input: z.input<Object>): This["prototype"] & z.output<Object>
			[Metadata.key]: typeof newMetadata
		}
	}
}

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
