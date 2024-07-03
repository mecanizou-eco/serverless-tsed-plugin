import { PlatformServerless } from '@tsed/platform-serverless'
import { ListCrudController } from './list-crud-controller'

const platform = PlatformServerless.bootstrap({
	lambda: [ListCrudController],
}).callbacks()

export = platform;
