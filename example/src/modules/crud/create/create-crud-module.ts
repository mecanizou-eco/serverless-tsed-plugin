import { PlatformServerless } from '@tsed/platform-serverless'
import { CreateCrudController } from './create-crud-controller'

export = PlatformServerless.bootstrap({
	lambda: [CreateCrudController],
}).callbacks();
