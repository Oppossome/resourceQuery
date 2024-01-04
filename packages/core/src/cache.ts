import { Query } from "./query"

export function Cache<This, Args extends any[], Return extends Query<any>>(
	target: (this: This, ...args: Args) => Return,
	context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
	console.log(target, context)

	return function (this: This, ...args: Args) {
		const result = target.call(this, ...args)
		return result
	}
}
