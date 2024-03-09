import { z } from "zod"
import { v4 as uuid } from "uuid"

import { Metadata, Weak } from "./helpers"

/**
 * The current {@link ResourceMetadata} that is being updated.
 * This is used to assign the uniqueId of the current resource.
 */
let UPDATING_METADATA: ResourceMetadata | undefined

interface ResourceMetadata {
	fields: Record<string, unknown>
	uniqueId: string
	onUpdate: Weak.EventBus<Resource>
}

interface StaticResourceMetadata {
	schema: z.ZodRawShape
	storage: Weak.ValueMap<string, Resource>
	onUpdate: Weak.EventBus<Resource>
}

export class Resource {
	constructor(..._params: any[]) {
		// Do absolutely nothing
	}

	[Metadata.key]: ResourceMetadata = {
		fields: {},
		uniqueId: uuid(),
		onUpdate: new Weak.EventBus(100),
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
		storage: new Weak.ValueMap(),
		onUpdate: new Weak.EventBus(),
	} satisfies StaticResourceMetadata

	static resourceExtend<This extends typeof Resource, Schema extends z.ZodRawShape>(
		this: This,
		schema: Schema,
	) {
		const newMetadata = {
			// For some reason, this is the only way to get the type to work correctly :/
			schema: { ...Metadata.get(this).schema, ...schema } as Metadata.Get<This>["schema"] & Schema,
			storage: new Weak.ValueMap<string, Resource>(),
			onUpdate: new Weak.EventBus(),
		} satisfies StaticResourceMetadata

		type Object = z.ZodObject<(typeof newMetadata)["schema"]>

		// @ts-expect-error - Typescript considers this to be a mixin but we're abusing it
		class Extension extends this {
			constructor(input: z.input<Object>) {
				super(input)

				if (input === null || typeof input !== "object") {
					throw new Error("Invalid Input - Expected an object but got something else")
				}

				// Temporarily store the current metadata and set the new metadata for the duration of the constructor
				const lastMetadata = UPDATING_METADATA
				const currentMetadata = (UPDATING_METADATA = Metadata.get(this))

				// Write the parsed input to a temporary object until we know where to put it
				const parsedInput = {} as z.output<Object>
				for (const schemaKey in schema) {
					const parsedValue = schema[schemaKey].safeParse(input[schemaKey])

					// If the input is invalid, restore the last metadata and throw the error
					if (!parsedValue.success) {
						UPDATING_METADATA = lastMetadata
						throw parsedValue.error
					}

					parsedInput[schemaKey] = parsedValue.data
				}

				// Now that we know the resourceId, see if it's cached already and assign the extracted data accordingly
				const targetObject = newMetadata.storage.get(currentMetadata.uniqueId)
				UPDATING_METADATA = lastMetadata

				// Only if it's the original object
				if (!targetObject) {
					newMetadata.storage.set(currentMetadata.uniqueId, this)
					this[Metadata.key].onUpdate.subscribe((value) => newMetadata.onUpdate.dispatch(value)) // Forward
				}

				// Assign the parsed input to whichever object we're working with
				const outputObject = targetObject ?? this
				// @ts-expect-error - It's alright, we're assigning known keys
				for (const key in parsedInput) outputObject[key] = parsedInput[key]
				return outputObject
			}

			/**
			 * Returns the JSON representation of the resource.
			 *  - Because we want to listen for assignment, we need to override the toJSON method.
			 */
			toJSON() {
				const output: Record<string, unknown> = super.toJSON()
				// @ts-expect-error - It's alright, we're assigning known keys
				for (const key in schema) output[key] = this[key]
				return output
			}

			static [Metadata.key] = newMetadata
		}

		// Assign getters and setters for each field in the schema.
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
