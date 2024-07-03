import { PlatformServerless } from '@tsed/platform-serverless'
import { GetCrudController } from './get-crud-controller'

const platform = PlatformServerless.bootstrap({
	lambda: [GetCrudController],
}).callbacks()

export = platform;
