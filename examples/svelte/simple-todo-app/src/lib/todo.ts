import { Query, Resource, QueryManager, type QueryOptions } from "@resourcequery/svelte"
import { z } from "zod"

export class PaginatedQuery<
	Schema extends z.ZodSchema<{ next_page?: number }>,
	Args extends any[],
> extends Query<Schema, Args> {
	public get canLoadMore() {
		return !this.loading && this.result?.next_page !== undefined
	}

	public nextPage() {
		if (!this.result?.next_page) return // No next page or occupied
		this.invalidate()
	}

	static override define<Schema extends z.ZodSchema, Args extends any[]>(
		options: QueryOptions<Schema, Args>,
	) {
		return new QueryManager(options, (...args) => {
			return new PaginatedQuery(options, ...args)
		}).builder
	}
}

type PatchTodo = Partial<Resource.input<typeof Todo>> & { id: string }

export default class Todo extends Resource.resourceExtend({
	id: Resource.uniqueId(z.string()),
	completed: z.boolean(),
	text: z.string(),
}) {
	get summary() {
		return `${this.text} ${this.completed ? "✔" : "❌"}`
	}

	patch(input: Omit<PatchTodo, "id">) {
		return Todo.patch({ ...input, id: this.id })
	}

	static patch = PaginatedQuery.define({
		schema: z.object({ todo: Todo.resourceSchema() }),
		query: async function (schema, update: PatchTodo) {
			const response = await fetch(`/api/todos`, {
				body: JSON.stringify(update),
				method: "PATCH",
			})

			return schema.parse(await response.json())
		},
	})

	static fetch = PaginatedQuery.define({
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
