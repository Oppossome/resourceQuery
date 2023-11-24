import { describe, expect, it } from "vitest"
import { fluently } from "../../helpers/fluently"

class FluentStringBuilder<const Value extends string> {
	constructor(public value: Value) {
		//
	}

	append<Value extends string, const NewValue extends string>(
		this: FluentStringBuilder<Value>,
		value: NewValue,
	) {
		return new FluentStringBuilder(`${this.value}${value}`)
	}

	congratulate(this: FluentStringBuilder<"">) {
		return new FluentStringBuilder("Congratulations")
	}

	jeff(this: FluentStringBuilder<"Congratulations">) {
		return new FluentStringBuilder(`${this.value}, Jeff!`)
	}

	finish(this: FluentStringBuilder<string>) {
		return this.value
	}
}

describe("fluently", () => {
	const stringBuilder = fluently(FluentStringBuilder)

	it("should work", () => {
		const result = stringBuilder("").append("Hello").append(", world!").finish()

		expect(result).toBe("Hello, world!")
	})
})
