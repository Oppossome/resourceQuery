import { z } from "zod"
import { v4 as uuid } from "uuid"
import { Metadata, Weak } from "./helpers"

let CURRENT_METADATA: ResourceMetadata | undefined

interface ResourceMetadata {
	uniqueId: string
}

interface StaticResourceMetadata {
	schema: z.ZodRawShape
	storage: Weak.ValueMap<string, Resource>
}

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
			storage: new Weak.ValueMap(),
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
				const lastMetadata = CURRENT_METADATA
				const currentMetadata = (CURRENT_METADATA = Metadata.get(this))

				// Write the parsed input to a temporary object until we know where to put it
				const parsedInput = {} as z.output<Object>
				for (const schemaKey in schema) {
					const parsedValue = schema[schemaKey].safeParse(input[schemaKey])

					// If the input is invalid, restore the last metadata and throw an error
					if (!parsedValue.success) {
						CURRENT_METADATA = lastMetadata
						throw new Error("Invalid Input - " + parsedValue.error.errors[0].message)
					}

					parsedInput[schemaKey] = parsedValue.data
				}

				// Restore the former metadata
				CURRENT_METADATA = lastMetadata

				// If the object already exists, update it with the parsed input and return it
				const targetObject = newMetadata.storage.get(currentMetadata.uniqueId) ?? this
				if (targetObject !== this) newMetadata.storage.set(currentMetadata.uniqueId, targetObject)
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

class Test extends Resource.extend({
	id: z.string(),
}) {
	test() {
		this.id
	}
}

class Extension extends Test.extend({
	name: z.string(),
}) {
	override test() {
		this.id
		this.name
	}
}

class Extension2 extends Extension.extend({
	name2: z.number().pipe(z.coerce.string()),
}) {
	override test() {
		this.id
		this.name
		this.name2
	}
}

new Extension2({
	id: "test",
	name: "test",
	name2: 123,
})

type Test2 = Metadata.Get<typeof Extension>["schema"]
//   ^?

type T = z.infer<z.ZodObject<Metadata.Get<typeof Extension>["schema"]>>
//   ^?
