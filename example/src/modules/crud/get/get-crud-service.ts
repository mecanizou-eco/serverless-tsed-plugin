import { GetCrudRepository } from './get-crud-repository'
import { Inject, Injectable } from '@tsed/di'

@Injectable()
export class GetCrudService {
	@Inject()
	private listCrudRepository!: GetCrudRepository

	async execute(): Promise<any> {
		return await this.listCrudRepository.list()
	}
}
