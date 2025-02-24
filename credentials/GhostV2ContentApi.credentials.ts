import type {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

export class GhostV2ContentApi implements ICredentialType {
	name = 'ghostv2ContentApi';

	displayName = 'Ghost V2 Content API';

	documentationUrl = 'https://ghost.org/docs/content-api/';

	properties: INodeProperties[] = [
		{
			displayName: 'URL',
			name: 'url',
			type: 'string',
			default: '',
			placeholder: 'http://localhost:3001',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		requestOptions.qs = {
			...requestOptions.qs,
			key: credentials.apiKey,
		};
		return requestOptions;
	}

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.url}}',
			url: '/ghost/api/v3/content/settings/',
			method: 'GET',
		},
	};
}
