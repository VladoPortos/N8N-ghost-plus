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

import GhostAdminAPI from '@tryghost/admin-api';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

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

	if (!(this as IExecuteFunctions).getInputData) {
		throw new NodeApiError(this.getNode(), { message: 'getInputData is not available on this context. This function is likely called from a context that does not support it (e.g. ILoadOptionsFunctions without items).' } as JsonObject, { itemIndex: i });
	}

	const items = (this as IExecuteFunctions).getInputData();
	if (i >= items.length || !items[i]) {
		throw new NodeApiError(this.getNode(), { message: `No item found at index ${i}.` } as JsonObject, { itemIndex: i });
	}
	const item = items[i];

	if (!item.binary || !item.binary[binaryPropertyName]) {
		throw new NodeApiError(this.getNode(), { message: `No binary data found for property "${binaryPropertyName}" on item ${i}.` } as JsonObject, { itemIndex: i });
	}

	const binaryProperty = item.binary[binaryPropertyName];
	const originalFileName = additionalFormData.fileName as string || binaryProperty.fileName || 'uploaded_image';
	const extension = binaryProperty.mimeType ? `.${binaryProperty.mimeType.split('/')[1]}` : path.extname(originalFileName);
	const safeFileName = `${path.basename(originalFileName, path.extname(originalFileName))}${extension}`.replace(/[^a-zA-Z0-9_.-]/g, '_');

	const dataBuffer = Buffer.from(binaryProperty.data, 'base64');

	const api = new GhostAdminAPI({
		url: credentials.url as string,
		// Ensure your credential type 'ghostPlusAdminApi' has a field named 'apiKey' or adjust accordingly.
		key: credentials.apiKey as string, 
		version: 'v5.0', // Using a modern Ghost API version via the library
	});

	let tempFilePath: string | undefined;
	try {
		const tempDir = os.tmpdir();
		tempFilePath = path.join(tempDir, `n8n_ghost_upload_${Date.now()}_${safeFileName}`);

		await fs.writeFile(tempFilePath, dataBuffer);

		const uploadOptions: { ref?: string } = {};
		if (additionalFormData.ref) {
			uploadOptions.ref = additionalFormData.ref as string;
		}

		const result = await api.images.upload({
			file: tempFilePath,
			...uploadOptions,
		});
		return result;

	} catch (error: any) {
		const errorMessage = error.message || 'Unknown error during Ghost API image upload.';
		// Attempt to get more detailed error information if available from Ghost API client error structure
		let errorDetails = {};
		if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
			errorDetails = { ghostErrors: error.errors.map((err: any) => ({ message: err.message, context: err.context, type: err.type })) };
		} else if (error.response?.data) {
			errorDetails = { responseData: error.response.data };
		} else if (error.context) {
			errorDetails = { context: error.context };
		}
		throw new NodeApiError(this.getNode(), { message: errorMessage, ...errorDetails } as JsonObject, { itemIndex: i });
	} finally {
		if (tempFilePath) {
			try {
				await fs.unlink(tempFilePath);
			} catch (cleanupError) {
				if ((this as IExecuteFunctions).logger) {
					(this as IExecuteFunctions).logger.error(`Failed to delete temporary file ${tempFilePath}: ${(cleanupError as Error).message}`);
				}
			}
		}
	}
}

export async function ghostApiMediaUpload(
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
	const fileName = additionalFormData.fileName as string || binaryProperty.fileName || 'media';
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
	};
	
	// Handle thumbnail if provided
	if (additionalFormData.thumbnailBinaryProperty) {
		const thumbnailProp = additionalFormData.thumbnailBinaryProperty as string;
		delete additionalFormData.thumbnailBinaryProperty;
		
		if (item.binary && item.binary[thumbnailProp]) {
			const thumbProperty = item.binary[thumbnailProp];
			const thumbBuffer = Buffer.from(thumbProperty.data, 'base64');
			
			formData.thumbnail = {
				value: thumbBuffer,
				options: {
					filename: thumbProperty.fileName || 'thumbnail.jpg',
					contentType: thumbProperty.mimeType,
				},
			};
		}
	}
	
	// Add any remaining additionalFormData
	Object.assign(formData, additionalFormData);
	
	const options: OptionsWithUri = {
		method: 'POST',
		uri: `${credentials.url}/ghost/api/v2/admin/media/upload/`,
		formData,
		json: true,
	};
	
	try {
		return await this.helpers.requestWithAuthentication.call(this, 'ghostPlusAdminApi', options);
	} catch(error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}