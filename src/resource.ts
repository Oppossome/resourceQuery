import { z } from "zod"

export class Resource {
	static extend<This extends typeof Resource, Schema extends z.ZodRawShape>(
		this: This,
		schema: Schema,
	) {
		//
	}
}
