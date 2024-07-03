import { Injectable } from '@tsed/di'

@Injectable()
export class GetCrudRepository {
	async list(): Promise<any> {
		return {
			id: 1,
			name: 'name',
		}
	}
}
