import { Injectable } from '@tsed/di'

@Injectable()
export class CreateCrudRepository {
	async create(body: any): Promise<any> {
		return body
	}
}
