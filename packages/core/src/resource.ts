import { z } from "zod"
import { v4 as uuid } from "uuid"

import { ResourceManager } from "./manager"
import { isObject, type ExtendClass } from "./helpers/types"

export interface ResourceMetadata {
	id: any
	updatedOn?: Date
}

export class Resource {
	constructor(..._params: any[]) {
		// Do absolutely nothing
	}

	private _resourceMetadata: ResourceMetadata = { id: uuid() }

	/**
	 * Utilized by derived classes to define properties on the resource. This gives us
	 * the ability to define getters and setters with custom functionality in derived classes.
	 */
	protected _resourceDefineProperties(shape: z.ZodRawShape) {
		const propValues: Record<string, unknown> = {}

		for (const key in shape) {
			/**
			 * Define a getter and setter for each key in the shape.
			 * The setter will parse the input and assign it to the propValues object.
			 *  - The exception should be caught by the request object, and it will error out the request.
			 */
			Object.defineProperty(this, key, {
				get: () => propValues[key],
				set: (value) => {
					// Because we're parsing the input
					const lastResourcesMetadata = Resource._resourceUpdating
					Resource._resourceUpdating = this._resourceMetadata

					// Safely parse the input so we can return _resourceUpdating to its original value
					const parsedValue = shape[key].safeParse(value)
					Resource._resourceUpdating = lastResourcesMetadata

					// If the input is invalid, throw the error, otherwise assign the parsed value to the propValues object
					if (!parsedValue.success) throw parsedValue.error
					propValues[key] = parsedValue.data
				},
			})
		}
	}

	toJSON(): Record<string, unknown> {
		// Destructure the _resourceMetadata from the rest of the object
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _resourceMetadata, ...rest } = this
		return rest
	}

	// === Static ===

	static resourceManager = new ResourceManager({})

	static resourceSchema<This extends typeof Resource>(this: This) {
		return z.record(z.unknown()).transform((input) => new this(input) as InstanceType<This>)
	}

	static resourceExtend<This extends typeof Resource, NewShape extends z.ZodRawShape>(
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
				this._resourceDefineProperties(newShape) // Define the properties on the resource

				// @ts-expect-error - We're assigning parsed values
				for (const key in newShape) this[key] = objectInput[key]

				const storedResources = Extension.resourceManager.resourceStorage
				const storedResource = storedResources.get(this._resourceMetadata.id)?.deref()

				// If the resource doesn't exist, store it and return
				if (!storedResource) {
					storedResources.set(this._resourceMetadata.id, new WeakRef(this))
					return
				}

				// @ts-expect-error - Assigning keys we know exist in the original resource.
				for (const key in newShape) storedResource[key] = this[key]
				return storedResource
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

	/**
	 * Utilized by {@link Resource}, {@link Resource._resourceUniqueId}, {@link Resource._resourceUpdatedOn}
	 * to keep track of the current resource being updated.
	 * @internal
	 */
	static _resourceUpdating: ResourceMetadata | undefined

	/**
	 * Implementation of {@link uniqueID} (Public API)
	 * @internal
	 */
	static _resourceUniqueId<Schema extends z.ZodTypeAny>(schemaOf?: Schema) {
		return z.unknown().transform((input, ctx) => {
			if (!this._resourceUpdating) {
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
			this._resourceUpdating.id = parsedInput.data
			return parsedInput.data
		})
	}

	/**
	 * Implementation of {@link updatedOn} (Public API)
	 * @internal
	 */
	static _resourceUpdatedOn<Schema extends z.ZodType<Date, any, any>>(schemaOf?: Schema) {
		return z.unknown().transform((input, ctx) => {
			if (!this._resourceUpdating) {
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
			this._resourceUpdating.updatedOn = parsedInput.data
			return parsedInput.data
		})
	}
}

/**
 * Returns a schema that assigns the parsed output to the current {@link Resource._resourceUpdating}.
 * @template {z.ZodTypeAny} Schema
 * @param {Schema | undefined} schemaOf
 * The schema to parse the input of, defaults to {@link z.string}.
 */
export const uniqueId = Resource._resourceUniqueId.bind(Resource)

/**
 * Returns a schema that assigns the parsed output to the current {@link Resource._resourceUpdating}
 * @template {z.ZodType<any, any, Date>} Schema
 * @param {Schema} schemaOf
 * The schema to parse the input of, defaults to {@link z.date}
 */
export const updatedOn = Resource._resourceUpdatedOn.bind(Resource)
