import 'reflect-metadata'
import { Controller, Inject } from '@tsed/di'
import {
	Description,
	In,
	Post,
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
import { CreateCrudResponseDto, CreateCrudRequestDto } from "./create-crud-dto";

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
	@Returns(200, CreateCrudResponseDto)
	@Returns(404, CreateCrudRequestDto).Description('')
	async handler(
		@BodyParams() body: CreateCrudRequestDto,
		@Context() $ctx: ServerlessContext
	): Promise<CreateCrudRequestDto> {
		const response: CreateCrudRequestDto = await this.service.execute(body)

		$ctx.response.setHeaders(
			HeadersResponseHelper.getInstance().getDefaultHeaders()
		)

		return response
	}
}
