class HeadersResponseHelper {
	private static instance: HeadersResponseHelper

	public static getInstance(): HeadersResponseHelper {
		if (!HeadersResponseHelper.instance) {
			HeadersResponseHelper.instance = new HeadersResponseHelper()
		}
		return HeadersResponseHelper.instance
	}

	getDefaultHeaders(): any {
		return {
			'Access-Control-Allow-Origin': process.env.ACCESS_CONTROL_ALLOW_ORIGIN,
		}
	}
}

export default HeadersResponseHelper
