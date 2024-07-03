import { CreateCrudRepository } from './create-crud-repository'
import { Inject, Injectable } from '@tsed/di'

@Injectable()
export class CreateCrudService {
	@Inject()
	private createCrudRepository!: CreateCrudRepository

	async execute(body: any): Promise<any> {
		return await this.createCrudRepository.create(body)
	}
}
