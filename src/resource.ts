import { z } from "zod"

export class Resource {
	public static extend<This extends typeof Resource, Schema extends z.ZodRawShape>(
		this: This,
		schema: Schema,
	) {
		//
	}
}
