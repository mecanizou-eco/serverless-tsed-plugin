import {
	APIGatewayAuthorizerHandler,
	APIGatewayAuthorizerResult,
} from 'aws-lambda'

export const handler: APIGatewayAuthorizerHandler = async (
	event: any,
	_context
): Promise<APIGatewayAuthorizerResult> => {
	try {
		return generatePolicy('user', 'Allow', event.methodArn, {})
	} catch (error) {
		throw new Error('Unauthorized')
	}
}

function generatePolicy(
	principalId: string,
	effect: string,
	resource: string,
	data?: any
) {
	const authResponse: any = {}

	authResponse.principalId = principalId
	if (effect && resource) {
		const policyDocument = {
			Version: '2012-10-17',
			Statement: [
				{
					Action: 'execute-api:Invoke',
					Effect: effect,
					Resource: resource,
				},
			],
		}

		authResponse.policyDocument = policyDocument
	}

	if (data?.dataValues) {
		authResponse.context = clearContextValues(data.dataValues)
	}

	return authResponse
}

function clearContextValues(data: any) {
	const res: any = {}
	for (const key of Object.keys(data)) {
		if (['string', 'number', 'boolean'].includes(typeof data[key])) {
			res[key] = data[key]
		}
	}
	return res
}
