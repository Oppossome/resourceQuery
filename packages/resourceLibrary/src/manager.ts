import { z } from "zod"
import { v4 as uuid } from "uuid"

import { Resource } from "./resource"

interface ResourceMetadata {
	id: string
	updatedOn?: Date
}

interface ResourceStorage {
	instance: WeakRef<Resource>
	metadata: ResourceMetadata
}

export class ResourceManager<Shape extends z.ZodRawShape> {
	constructor(public shape: Shape) {}

	shapeExtend<NewShape extends z.ZodRawShape>(newShape: NewShape) {
		return new ResourceManager({ ...this.shape, ...newShape })
	}

	// === Storage ===

	resourceStorage = new Map<string, ResourceStorage>()

	updateOrCreateResource<Input extends typeof Resource>(
		resource: Input,
		resourceMetadata: ResourceMetadata,
		resourceData: any,
	) {
		const resourceInfo = this.resourceStorage.get(resourceMetadata.id)
		let resourceInstance = resourceInfo?.instance.deref()

		if (!resourceInstance) {
			// If the resourceInstance is no longer around or doesn't exist, create the resource and update the metadata
			resourceInstance = new resource(resourceData)
			this.resourceStorage.set(resourceMetadata.id, {
				instance: new WeakRef(resourceInstance),
				metadata: resourceMetadata,
			})
		} else {
			// If it exists, simply update the associated resourceInstance
			resourceInstance.resourceUpdate(resourceData)
		}

		// Because we reassign resourceInstance if it doesn't exist, the non-null assertion is safe
		return resourceInstance!
	}

	// === Schema ===

	shapeSchema = z.object(this.shape)

	/**
	 * Given a input resource, it returns a schema that results in an instance of the caller.
	 * This is utilized by {@link Resource.resourceSchema}.
	 */
	resourceSchema<InputResource extends typeof Resource>(resource: InputResource) {
		return z.unknown().transform((schemaInput, ctx) => {
			const lastMetadata = ResourceManager.#currentResource // Just in case we're interrupting a parse, put this back afterwards
			const parseMetadata: ResourceMetadata = { id: uuid() } // Provide an id by default to make storing it easier
			ResourceManager.#currentResource = parseMetadata

			// Parse the input of the schema and put back the last resource's metadata
			const parseResult = this.shapeSchema.safeParse(schemaInput)
			ResourceManager.#currentResource = lastMetadata

			// If parsing fails for whatever reason, add its issues to the list
			if (!parseResult.success) {
				parseResult.error.issues.forEach(ctx.addIssue)
				return z.NEVER
			}

			// Create an instance of the caller's resource, and type it accordingly
			return this.updateOrCreateResource(
				resource,
				parseMetadata,
				parseResult.data,
			) as InstanceType<InputResource>
		})
	}

	// === Static ===

	static #currentResource: ResourceMetadata | undefined
}
