import { z } from "zod"
import { v4 as uuid } from "uuid"

import { type ExtendClass } from "./types"
import { ResourceManager } from "./manager"

export interface ResourceMetadata {
	id: any
	updatedOn?: Date
}

export class Resource {
	constructor(...input: any[]) {
		this.resourceUpdate(input[0])
	}

	/**
	 * The method utilized to update a given resource, when it already exists.
	 * @param input
	 */
	resourceUpdate(input: any) {
		// The most simplistic implementation of this,
		Object.assign(this, input)
	}

	private _resourceMetadata: ResourceMetadata = { id: uuid() }

	toJSON() {
		// Destructure the _resourceMetadata from the rest of the object
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _resourceMetadata, ...rest } = this
		return rest
	}

	// === Static ===

	static resourceManager = new ResourceManager({})

	static resourceSchema<This extends typeof Resource>(this: This) {
		return this.resourceManager.resourceSchema(this)
	}

	static resourceExtend<This extends typeof Resource, NewShape extends z.ZodRawShape>(
		this: This,
		newShape: NewShape,
	) {
		// Manually type the manager class due to weirdness with the This type
		type Manager = ResourceManager<This["resourceManager"]["shape"] & NewShape>
		type ManagerOutput = z.infer<Manager["shapeSchema"]>

		// prettier-ignore
		return class extends this {
			static override resourceManager = super.resourceManager.shapeExtend(newShape)

		} as ExtendClass<This, {
			new (input: ManagerOutput): This["prototype"] & ManagerOutput 
			prototype: This["prototype"] & ManagerOutput
			resourceManager: Manager
		}>
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
export const uniqueID = Resource._resourceUniqueId.bind(Resource)

/**
 * Returns a schema that assigns the parsed output to the current {@link Resource._resourceUpdating}
 * @template {z.ZodType<any, any, Date>} Schema
 * @param {Schema} schemaOf
 * The schema to parse the input of, defaults to {@link z.date}
 */
export const updatedOn = Resource._resourceUpdatedOn.bind(Resource)
