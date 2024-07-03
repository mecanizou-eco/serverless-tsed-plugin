import 'reflect-metadata'
import { Controller, Inject } from '@tsed/di'
import {
	Default,
	Description,
	Format,
	In,
	Maximum,
	MaxLength,
	Minimum,
	MinLength,
	Pattern,
	Post,
	Required,
	Returns,
	Summary,
} from '@tsed/schema'
import HeadersResponseHelper from '../../../shared/helpers/headers-response.helper'
import {
	BodyParams,
	Context,
	ServerlessContext,
} from '@tsed/platform-serverless'
import { CreateCrudService } from './create-crud-service'

class Response1 {
	@MinLength(3)
	@MaxLength(50)
	indexed!: string
}

class Request {
	@Required()
	unique!: string

	@MinLength(3)
	@MaxLength(50)
	indexed!: string

	@Minimum(0)
	@Maximum(100)
	@Default(0)
	rate: number = 0

	@Pattern(/[a-z]/)
	pattern!: string

	@Format('date-time')
	@Default(Date.now)
	dateCreation: Date = new Date()
}

@Controller('/crud')
export class CreateCrudController {
	@Inject()
	private service!: CreateCrudService

	@Post('/')
	@Summary('Cria dados')
	@Description('Description de criação')
	@In('header')
		.Name('authorization')
		.Type(String)
		.Description('Bearer authorization')
	@Returns(200, Request)
	@Returns(404, Response1).Description('')
	async handler(
		@BodyParams() body: Request,
		@Context() $ctx: ServerlessContext
	): Promise<Request> {
		const response: Request = await this.service.execute(body)

		$ctx.response.setHeaders(
			HeadersResponseHelper.getInstance().getDefaultHeaders()
		)

		return response
	}
}
