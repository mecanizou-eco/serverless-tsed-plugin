import { ListCrudRepository } from './list-crud-repository'
import { Inject, Injectable } from '@tsed/di'

@Injectable()
export class ListCrudService {
	@Inject()
	private listCrudRepository!: ListCrudRepository

	async execute(): Promise<any> {
		return await this.listCrudRepository.list()
	}
}
