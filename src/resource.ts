import { z } from "zod"
import { v4 as uuid } from "uuid"
import { Metadata, Weak } from "./helpers"

interface ResourceMetadata {
	uniqueId: string
}

interface StaticResourceMetadata {
	schema: z.ZodRawShape
	storage: Weak.ValueMap<string, Resource>
}

let RESOURCE_UPDATING: ResourceMetadata | undefined

export class Resource {
	constructor(..._params: any[]) {
		// Do absolutely nothing
	}

	[Metadata.key] = {
		uniqueId: uuid(),
	} satisfies ResourceMetadata

	// === Static Methods ===

	static [Metadata.key] = {
		schema: {},
		storage: new Weak.ValueMap(),
	} satisfies StaticResourceMetadata

	static extend<This extends typeof Resource, Schema extends z.ZodRawShape>(
		this: This,
		schema: Schema,
	) {
		const newMetadata = {
			// For some reason, this is the only way to get the type to work correctly :/
			schema: { ...Metadata.get(this).schema, ...schema } as Metadata.Get<This>["schema"] & Schema,
			storage: new Weak.ValueMap<string, object>(),
		}

		type Object = z.ZodObject<(typeof newMetadata)["schema"]>

		// @ts-expect-error - Typescript considers this to be a mixin but we're abusing it
		return class extends this {
			constructor(input: z.input<Object>) {
				super(input)

				if (input === null || typeof input !== "object") {
					throw new Error("Invalid Input - Expected an object but got something else")
				}

				// Temporarily store the current metadata and set the new metadata for the duration of the constructor
				const lastMetadata = RESOURCE_UPDATING
				const currentMetadata = (RESOURCE_UPDATING = Metadata.get(this))

				// Write the parsed input to a temporary object until we know where to put it
				const parsedInput = {} as z.output<Object>
				for (const schemaKey in schema) {
					const parsedValue = schema[schemaKey].safeParse(input[schemaKey])

					// If the input is invalid, restore the last metadata and throw an error
					if (!parsedValue.success) {
						RESOURCE_UPDATING = lastMetadata
						throw new Error("Invalid Input - " + parsedValue.error.errors[0].message)
					}

					parsedInput[schemaKey] = parsedValue.data
				}

				RESOURCE_UPDATING = lastMetadata

				// Assign the parsed input to the correct object, and store it in the storage map if necessary
				const targetObject = newMetadata.storage.get(currentMetadata.uniqueId) ?? this
				if (targetObject === this) newMetadata.storage.set(currentMetadata.uniqueId, targetObject)
				Object.assign(targetObject, parsedInput)

				// @ts-expect-error - Resolve this at some point
				return targetObject
			}

			static [Metadata.key] = newMetadata
		} as Omit<This, "new"> & {
			new (input: z.input<Object>): This["prototype"] & z.output<Object>
			[Metadata.key]: typeof newMetadata
		}
	}
}

/**
 * Returns a schema that assigns the parsed output to the current {@link RESOURCE_UPDATING}.
 * @template {z.ZodTypeAny} Schema
 * @param {Schema | undefined} schemaOf
 * The schema to parse the input of, defaults to {@link z.string}.
 */
export function uniqueId<Schema extends z.ZodTypeAny>(schemaOf?: Schema) {
	return z.unknown().transform((input, ctx) => {
		if (!RESOURCE_UPDATING) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unexpected resourceUniqueId call" })
			return z.NEVER
		}

		// Parse the input of our schema
		const parseSchema = schemaOf ?? z.string()
		const parseResult = parseSchema.parse(input)

		// Assign the current resource's id to the parsed input's data
		RESOURCE_UPDATING.uniqueId = parseResult
		return parseResult as z.infer<Schema>
	})
}

// class Test extends Resource.extend({
// 	id: z.string(),
// }) {
// 	test() {
// 		this.id
// 	}
// }

// class Extension extends Test.extend({
// 	name: z.string(),
// }) {
// 	override test() {
// 		this.id
// 		this.name
// 	}
// }

// class Extension2 extends Extension.extend({
// 	name2: z.number().pipe(z.coerce.string()),
// }) {
// 	override test() {
// 		this.id
// 		this.name
// 		this.name2
// 	}
// }

// new Extension2({
// 	id: "test",
// 	name: "test",
// 	name2: 123,
// })

// type Test2 = Metadata.Get<typeof Extension>["schema"]
// //   ^?

// type T = z.infer<z.ZodObject<Metadata.Get<typeof Extension>["schema"]>>
// //   ^?
