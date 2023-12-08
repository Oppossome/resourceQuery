import { Resource, Query, uniqueId } from "@resourcequery/svelte"
import { z } from "zod"

export class PaginatedQuery<
	CacheKey,
	Schema extends z.ZodSchema<{ next_page?: number }>,
> extends Query<CacheKey, Schema> {
	public nextPage() {
		if (!this.result?.next_page) return // No next page or occupied
		this.invalidate()
	}
}

export default class Todo extends Resource.resourceExtend({
	id: uniqueId(z.string().uuid()),
	text: z.string(),
	completed: z.boolean(),
}) {
	static fetch() {
		return new PaginatedQuery({
			schema: z.object({
				todos: z.array(Todo.resourceSchema()),
				next_page: z.number().optional(),
			}),
			query: async function (schema) {
				const response = await fetch(`/api/todos?pageOffset=${this.result?.next_page ?? 0}`)
				const result = schema.parse(await response.json())
				if (!this.result?.todos) return result

				return {
					...result,
					todos: [...this.result.todos, ...result.todos],
				}
			},
		})
	}
}
