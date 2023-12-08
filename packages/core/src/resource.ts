import { z } from "zod"
import { v4 as uuid } from "uuid"

import { ResourceManager } from "./manager"
import { isObject, type ExtendClass } from "./helpers/types"

export interface ResourceMetadata {
	id: any
	updatedOn?: Date
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
	protected _resourceMetadata: ResourceMetadata = { id: uuid() }

	/**
	 * Utilized by derived classes to define properties on the resource. This gives us
	 * the ability to define getters and setters with custom functionality in derived classes.
	 * @internal
	 */
	protected _resourceDefineProperty(
		key: string,
		schema: z.ZodTypeAny,
		set?: (value: unknown) => void,
	) {
		let propValue: unknown

		Object.defineProperty(this, key, {
			get: () => propValue,
			set: (value: unknown) => {
				// Because we're parsing the input
				const lastResourcesMetadata = resourceUpdating
				resourceUpdating = this._resourceMetadata

				// Safely parse the input so we can return resourceUpdating to its original value
				const parsedValue = schema.safeParse(value)
				resourceUpdating = lastResourcesMetadata

				// If the input is invalid, throw the error, otherwise assign the parsed value to the propValues object
				if (!parsedValue.success) throw parsedValue.error
				propValue = parsedValue.data
				set?.(propValue)
			},
		})
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

		return class Extension extends this {
			public constructor(...input: any[]) {
				super(...input)

				const objectInput: unknown = input[0] // Grab first parameter, ensure it's an object
				if (!isObject(objectInput)) throw new Error("Expected input to be an object")
				for (const key in newShape) this._resourceDefineProperty(key, newShape[key]) // Define properties

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
		} as ExtendClass<
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
		const parsedInput = parseSchema.safeParse(input)

		// If the input is invalid, add the issues and return z.NEVER
		if (!parsedInput.success) {
			parsedInput.error.addIssues(parsedInput.error.issues)
			return z.NEVER
		}

		// Assign the current resource's id to the parsed input's data
		resourceUpdating.id = parsedInput.data
		return parsedInput.data as z.infer<Schema>
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
		const parsedInput = parseSchema.safeParse(input)

		// If the input is invalid, add the issues and return z.NEVER
		if (!parsedInput.success) {
			parsedInput.error.addIssues(parsedInput.error.issues)
			return z.NEVER
		}

		// Assign the current resource's updatedOn to the parsed input's data
		resourceUpdating.updatedOn = parsedInput.data
		return parsedInput.data
	})
}

export const Resource = {
	resourceExtend: <NewShape extends z.ZodRawShape>(shape: NewShape) =>
		ResourceClass.resourceExtend(shape),
	updatedOn,
	uniqueId,
}
