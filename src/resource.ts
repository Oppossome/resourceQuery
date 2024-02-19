import { z } from "zod"

/**
 * A symbol used to store metadata on a given resource class.
 */
export const METADATA_KEY = Symbol("resource_metadata_key")

/**
 * A type that returns the metadata of a given resource class.
 */
export type MetadataOf<T extends { [METADATA_KEY]?: any }> = T[typeof METADATA_KEY]

export class Resource {
	public static extend<This extends typeof Resource, Schema extends z.ZodRawShape>(
		this: This,
		schema: Schema,
	) {
		//
	}
}
