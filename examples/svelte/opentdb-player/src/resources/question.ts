import { Resource, query } from "@resourcequery/svelte"
import { z } from "zod"

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
	get shuffledQuestions() {
		const possibleAnswers = [this.correct_answer, ...this.incorrect_answers]
		if (this.type === "multiple") return possibleAnswers.sort(() => 0.5 - Math.random())

		// If it's a true or false question, organize the answers consistently
		const isTrueCorrect = possibleAnswers[0].value === "True"
		return isTrueCorrect ? possibleAnswers : possibleAnswers.reverse()
	}

	static fetch() {
		return query(async () => {
			const schema = z.object({
				response_code: z.literal(0),
				results: z.array(Question.resourceSchema()),
			})

			const query = await fetch("https://opentdb.com/api.php?amount=10&encode=url3986")
			return schema.parse(await query.json()).results
		}).execute()
	}
}
