import { Resource, Query } from "@resourcequery/svelte"
import { z } from "zod"
import { wait } from "./helpers"

const uriString = z.string().transform((str, ctx) => {
	try {
		return decodeURI(str)
	} catch (e) {
		ctx.addIssue({ code: "custom", message: "Invalid URI" })
		return z.NEVER
	}
})

export class Answer extends Resource.resourceExtend({
	value: uriString,
	isCorrect: z.boolean(),
}) {
	static schema(isCorrect: boolean) {
		return uriString.transform((value) => new Answer({ value, isCorrect }))
	}
}

export class Question extends Resource.resourceExtend({
	category: uriString,
	type: z.enum(["multiple", "boolean"]),
	difficulty: z.enum(["easy", "medium", "hard"]),
	question: uriString,
	correct_answer: Answer.schema(true),
	incorrect_answers: z.array(Answer.schema(false)),
}) {
	get shuffledAnswers() {
		const possibleAnswers = [this.correct_answer, ...this.incorrect_answers]
		if (this.type === "multiple") return possibleAnswers.sort(() => 0.5 - Math.random())

		// If it's a true or false question, organize the answers consistently
		const isTrueCorrect = possibleAnswers[0].value === "True"
		return isTrueCorrect ? possibleAnswers : possibleAnswers.reverse()
	}

	static fetch() {
		return new Query({
			query: async () => {
				await wait(5000) // So we respect the rate limit
				const query = await fetch("https://opentdb.com/api.php?amount=10")

				return z
					.object({
						response_code: z.literal(0),
						results: z.array(Question.resourceSchema()),
					})
					.parse(await query.json())
			},
		})
	}
}
