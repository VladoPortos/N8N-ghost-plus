import type {
	OptionsWithUri,
} from 'request';

import {
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';

export async function ghostApiRequest(this: IHookFunctions | IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions, method: string, endpoint: string, body: any = {}, query: IDataObject = {}, uri?: string): Promise<any> { // tslint:disable-line:no-any

	const source = this.getNodeParameter('source', 0) as string;

	let credentials;
	let version;
	let credentialType;

	if (source === 'contentApi') {
		//https://ghost.org/faq/api-versioning/
		version = 'v3';
		credentialType = 'ghostPlusContentApi';
	} else {
		version = 'v2';
		credentialType = 'ghostPlusAdminApi';
	}

	credentials = await this.getCredentials(credentialType);

	const options: OptionsWithUri = {
		method,
		qs: query,
		uri: uri || `${credentials.url}/ghost/api/${version}${endpoint}`,
		body,
		json: true,
	};

	try {
		return await this.helpers.requestWithAuthentication.call(this, credentialType, options);
	} catch(error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function ghostApiRequestAllItems(this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions, propertyName: string, method: string, endpoint: string, body: any = {}, query: IDataObject = {}): Promise<any> { // tslint:disable-line:no-any

	const returnData: IDataObject[] = [];

	let responseData;

	query.limit = 50;
	query.page = 1;

	do {
		responseData = await ghostApiRequest.call(this, method, endpoint, body, query);
		query.page = responseData.meta.pagination.next;
		returnData.push.apply(returnData, responseData[propertyName]);
	} while (
		query.page !== null
	);
	return returnData;
}

export function validateJSON(json: string | undefined): any { // tslint:disable-line:no-any
	let result;
	try {
		result = JSON.parse(json!);
	} catch (exception) {
		result = undefined;
	}
	return result;
}

export async function ghostApiImageUpload(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	binaryPropertyName: string,
	i: number,
	additionalFormData: IDataObject = {},
): Promise<any> { // tslint:disable-line:no-any
	
	const credentials = await this.getCredentials('ghostPlusAdminApi');
	
	// ILoadOptionsFunctions doesn't have getInputData
	if (!(this as any).getInputData) {
		throw new NodeApiError(this.getNode(), { message: 'Not supported for this node type' } as JsonObject);
	}
	
	// This is a workaround to get the binary data
	const items = (this as IExecuteFunctions).getInputData();
	const item = items[i];
	
	if (!item.binary || !item.binary[binaryPropertyName]) {
		throw new NodeApiError(this.getNode(), { message: `No binary data property "${binaryPropertyName}" exists!` } as JsonObject);
	}
	
	const binaryProperty = item.binary[binaryPropertyName];
	const contentType = binaryProperty.mimeType;
	const fileName = additionalFormData.fileName as string || binaryProperty.fileName || 'image';
	const dataBuffer = Buffer.from(binaryProperty.data, 'base64');
	
	// Remove fileName from additionalFormData as it's handled separately
	if (additionalFormData.fileName !== undefined) {
		delete additionalFormData.fileName;
	}
	
	const formData: IDataObject = {
		file: {
			value: dataBuffer,
			options: {
				filename: fileName,
				contentType,
			},
		},
		...additionalFormData,
	};
	
	const options: OptionsWithUri = {
		method: 'POST',
		uri: `${credentials.url}/ghost/api/v2/admin/images/upload/`,
		formData,
		json: true,
	};
	
	try {
		return await this.helpers.requestWithAuthentication.call(this, 'ghostPlusAdminApi', options);
	} catch(error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}