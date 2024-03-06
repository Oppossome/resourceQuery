import { z } from "zod"
import { Metadata, Weak } from "./helpers"

interface ResourceMetadata {
	schema: z.ZodRawShape
	storage: Weak.ValueMap<string, Resource>
}

export class Resource {
	static [Metadata.key] = {
		schema: {},
		storage: new Weak.ValueMap(),
	} satisfies ResourceMetadata

	static extend<This extends typeof Resource, Schema extends z.ZodRawShape>(
		this: This,
		schema: Schema,
	) {
		const newMetadata = {
			schema: { ...Metadata.get(this).schema, ...schema },
			storage: new Weak.ValueMap(),
		} satisfies ResourceMetadata

		return class extends this {
			static [Metadata.key] = newMetadata
		}
	}
}

const Base = Resource.extend({
	id: z.string(),
})

const Ext = Base.extend({
	name: z.string(),
})

type T = z.infer<z.ZodObject<Metadata.Get<typeof Ext>["schema"]>>
//   ^?
