import { Resource, Query } from "@resourcequery/svelte"
import { z } from "zod"

export class PaginatedQuery<
	Schema extends z.ZodSchema<{ next_page?: number }>,
> extends Query<Schema> {
	public get canLoadMore() {
		return !this.loading && this.result?.next_page !== undefined
	}

	public nextPage() {
		if (!this.result?.next_page) return // No next page or occupied
		this.invalidate()
	}
}

export default class Todo extends Resource.resourceExtend({
	id: Resource.uniqueId(z.string().uuid()),
	completed: z.boolean(),
	text: z.string(),
}) {
	public get summary() {
		return `${this.text} (${this.completed ? "Completed" : "Incomplete"})`
	}

	static fetch() {
		return new PaginatedQuery({
			schema: z.object({
				todos: z.array(Todo.resourceSchema()),
				next_page: z.number().optional(),
			}),
			query: async function (schema) {
				const response = await fetch(`/api/todos?pageOffset=${this.result?.next_page ?? 0}`)
				const result = schema.parse(await response.json())
				if (!this.result) return result

				return {
					...result,
					todos: [...this.result.todos, ...result.todos],
				}
			},
		})
	}
}
