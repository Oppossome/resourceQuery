import { z } from "zod"

export class ResourceManager<Shape extends z.ZodRawShape> {
	public constructor(public shape: Shape) {
		//
	}

	public get schema() {
		return z.object(this.shape)
	}

	public extend<NewShape extends z.ZodRawShape>(newShape: NewShape) {
		return new ResourceManager({ ...this.shape, ...newShape })
	}
}
