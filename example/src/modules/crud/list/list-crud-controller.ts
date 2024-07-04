import { Controller, Inject } from '@tsed/di'
import { Description, Get, In, Returns, Summary } from '@tsed/schema'
import HeadersResponseHelper from '../../../shared/helpers/headers-response.helper'
import {
	Context,
	PathParams,
	ServerlessContext,
} from '@tsed/platform-serverless'
import { ListCrudService } from './list-crud-service'
import {ListCrudResponseDto} from "./list-crud-dto";

@Controller('/cruds')
export class ListCrudController {
	@Inject()
	service!: ListCrudService

	@Get('/')
	@Summary('Cria dados')
	@In('header')
		.Name('authorization')
		.Type(String)
		.Description('Bearer authorization')
	@Returns(200, ListCrudResponseDto)
	@Description('Description')
	async handler(
		@PathParams('type') type: string,
		@Context() $ctx: ServerlessContext
	): Promise<ListCrudResponseDto> {
		const response: ListCrudResponseDto = await this.service.execute()

		$ctx.response.setHeaders(
			HeadersResponseHelper.getInstance().getDefaultHeaders()
		)

		return response
	}
}
