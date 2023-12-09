import { z } from "zod"
import { v4 as uuid } from "uuid"

import { ResourceManager } from "./manager"
import { isObject, type ExtendClass } from "./helpers/types"

export interface ResourceMetadata {
	id: any
	updatedOn?: Date
	fields: Record<string, unknown>
	events: {
		get: (key: string) => unknown
		set: (key: string, value: unknown) => void
	}
}

function defineProperties<Resource extends typeof ResourceClass, Shape extends z.ZodRawShape>(
	resource: Resource,
	shape: Shape,
) {
	for (const key in shape) {
		Object.defineProperty(resource.prototype, key, {
			get() {
				return this._resourceMetadata.events.get(key)
			},
			set(value) {
				// Get the last resource metadata, then set the current resource metadata to the one we're updating
				const lastResourcesMetadata = resourceUpdating
				resourceUpdating = this._resourceMetadata

				// Parse the value of the input safely so we can set resourceUpdating back to the last resource metadata
				const parsedValue = shape[key].safeParse(value)
				resourceUpdating = lastResourcesMetadata

				// If the input is invalid, throw the error, otherwise assign the parsed value to the propValues object
				if (!parsedValue.success) throw parsedValue.error
				this._resourceMetadata.events.set(key, parsedValue.data)
			},
		})
	}
}

// prettier-ignore
export type InferResource<T extends typeof ResourceClass> = 
	T extends { new (input: infer P): any }
		? P
		: never

let resourceUpdating: ResourceMetadata | undefined

export class ResourceClass {
	constructor(..._params: any[]) {
		// Do absolutely nothing
	}

	/**
	 * Metadata about the resource.
	 * @internal
	 */
	protected _resourceMetadata: ResourceMetadata = {
		id: uuid(),
		fields: {},
		events: {
			get: (key) => {
				return this._resourceMetadata.fields[key]
			},
			set: (key, value) => {
				this._resourceMetadata.fields[key] = value
			},
		},
	}

	toJSON(): Record<string, unknown> {
		// Destructure the _resourceMetadata from the rest of the object
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _resourceMetadata, ...rest } = this
		return rest
	}

	// === Static ===

	static resourceManager = new ResourceManager({})

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
	static resourceSchema<This extends typeof ResourceClass>(this: This) {
		return z.record(z.unknown()).transform((input) => new this(input) as InstanceType<This>)
	}

	/**
	 * Extends the current resource with the provided shape.
	 * @example
	 * ```ts
	 * class User extends ResourceClass.resourceExtend({
	 * 	id: uniqueId(z.string()),
	 * 	discriminator: z.number(),
	 * 	name: z.string(),
	 * }) {
	 * 	public get displayName() {
	 * 		return `${this.name}#${this.discriminator}`
	 * 	}
	 * }
	 *
	 * class Admin extends User.resourceExtend({
	 * 	permissions: z.array(z.string()),
	 * }) {
	 * 	public get adminDisplayName() {
	 *		return `${this.displayName} (${this.permissions.length} permissions)`
	 * 	}
	 * }
	 * ```
	 */
	static resourceExtend<This extends typeof ResourceClass, NewShape extends z.ZodRawShape>(
		this: This,
		newShape: NewShape,
	) {
		// Manually type the manager class due to weirdness with the This type
		type Manager = ResourceManager<This["resourceManager"]["shape"] & NewShape>
		type ManagerOutput = z.infer<Manager["shapeSchema"]>

		class Extension extends this {
			public constructor(...input: any[]) {
				super(...input)

				const objectInput: unknown = input[0] // Grab first parameter, ensure it's an object
				if (!isObject(objectInput)) throw new Error("Expected input to be an object")

				// @ts-expect-error - We're assigning parsed values
				for (const key in newShape) this[key] = objectInput[key]

				const storedResources = Extension.resourceManager.resourceStorage
				const storedResource = storedResources.get(this._resourceMetadata.id)?.deref()

				// If the resource already exists, update the values and return it
				if (storedResource) {
					// @ts-expect-error - Assigning keys we know exist in the original resource.
					for (const key in newShape) storedResource[key] = objectInput[key]
					return storedResource
				}

				storedResources.set(this._resourceMetadata.id, new WeakRef(this))
			}

			static override resourceManager = super.resourceManager.shapeExtend(newShape)

			public override toJSON() {
				const json = super.toJSON()
				// @ts-expect-error - Assigning keys we know exist in the resource.
				for (const key in newShape) json[key] = this[key]
				return json
			}
		}

		// Define the properties on the prototype, and return the extended class
		defineProperties(Extension, newShape)
		return Extension as ExtendClass<
			This,
			{
				new (input: ManagerOutput): This["prototype"] & ManagerOutput
				prototype: This["prototype"] & ManagerOutput
				resourceManager: Manager
			}
		>
	}
}

/**
 * Returns a schema that assigns the parsed output to the current {@link resourceUpdating}.
 * @template {z.ZodTypeAny} Schema
 * @param {Schema | undefined} schemaOf
 * The schema to parse the input of, defaults to {@link z.string}.
 */
function uniqueId<Schema extends z.ZodTypeAny>(schemaOf?: Schema) {
	return z.unknown().transform((input, ctx) => {
		if (!resourceUpdating) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unexpected resourceUniqueId call" })
			return z.NEVER
		}

		// Parse the input of our schema
		const parseSchema = schemaOf ?? z.string()
		const parseResult = parseSchema.parse(input)

		// Assign the current resource's id to the parsed input's data
		resourceUpdating.id = parseResult
		return parseResult as z.infer<Schema>
	})
}

/**
 * Returns a schema that assigns the parsed output to the current {@link resourceUpdating}
 * @template {z.ZodType<any, any, Date>} Schema
 * @param {Schema} schemaOf
 * The schema to parse the input of, defaults to {@link z.date}
 */
function updatedOn<Schema extends z.ZodType<Date, any, any>>(schemaOf?: Schema) {
	return z.unknown().transform((input, ctx) => {
		if (!resourceUpdating) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unexpected resourceUpdatedOn call" })
			return z.NEVER
		}

		// Parse the input of our schema
		const parseSchema = schemaOf ?? z.coerce.date()
		const parseResult = parseSchema.parse(input)

		// Assign the current resource's updatedOn to the parsed input's data
		resourceUpdating.updatedOn = parseResult
		return parseResult
	})
}

export const Resource = {
	resourceExtend: <NewShape extends z.ZodRawShape>(shape: NewShape) =>
		ResourceClass.resourceExtend(shape),
	updatedOn,
	uniqueId,
}
