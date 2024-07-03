import { Controller, Inject } from '@tsed/di'
import { Description, Get, In, Returns, Summary } from '@tsed/schema'
import HeadersResponseHelper from '../../../shared/helpers/headers-response.helper'
import {
	Context,
	PathParams,
	QueryParams,
	ServerlessContext,
} from '@tsed/platform-serverless'
import { GetCrudService } from './get-crud-service'

class Response {
	[key: string]: any;
}

@Controller('/crud')
export class GetCrudController {
	@Inject()
	service!: GetCrudService

	@Get('/:id')
	@Summary('Pega dados')
	@In('header')
		.Name('authorization')
		.Type(String)
		.Description('Bearer authorization')
	@Returns(200, Response)
	@Description('Description')
	async handler(
		@PathParams('id') id: number,
		@QueryParams('param') param: string,
		@QueryParams('param2') param2: number,
		@Context() $ctx: ServerlessContext
	): Promise<Response> {
		const response: Response = await this.service.execute()

		$ctx.response.setHeaders(
			HeadersResponseHelper.getInstance().getDefaultHeaders()
		)

		return response
	}
}
