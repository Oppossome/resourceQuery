import { Resource } from "resourcelibrary"
import { z } from "zod"

const uriString = z.string().transform((str, ctx) => {
	try {
		return decodeURI(str)
	} catch (e) {
		ctx.addIssue({ code: "custom", message: "Invalid URI" })
		return z.NEVER
	}
})

class Question extends Resource.resourceExtend({
	category: uriString,
	type: z.enum(["multiple", "boolean"]),
	difficulty: z.enum(["easy", "medium", "hard"]),
	question: uriString,
	correct_answer: uriString,
	incorrect_answers: z.array(uriString),
}) {
	//
}
