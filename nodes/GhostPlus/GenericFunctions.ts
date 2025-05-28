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

	this.logger?.debug(`[ghostApiImageUpload] Starting image upload for item index: ${i}, binary property: "${binaryPropertyName}"`);

	const credentials = await this.getCredentials('ghostPlusAdminApi');
	this.logger?.debug(`[ghostApiImageUpload] Using Ghost API URL: ${credentials.url}`);

	if (!(this as IExecuteFunctions).getInputData) {
		this.logger?.error('[ghostApiImageUpload] getInputData is not available on this context.');
		throw new NodeApiError(this.getNode(), { message: 'getInputData is not available on this context. This function is likely called from a context that does not support it (e.g. ILoadOptionsFunctions without items).' } as JsonObject, { itemIndex: i });
	}

	const items = (this as IExecuteFunctions).getInputData();
	if (i >= items.length || !items[i]) {
		this.logger?.error(`[ghostApiImageUpload] No item found at index ${i}.`);
		throw new NodeApiError(this.getNode(), { message: `No item found at index ${i}.` } as JsonObject, { itemIndex: i });
	}
	const item = items[i];

	if (!item.binary || !item.binary[binaryPropertyName]) {
		this.logger?.error(`[ghostApiImageUpload] No binary data found for property "${binaryPropertyName}" on item ${i}.`);
		throw new NodeApiError(this.getNode(), { message: `No binary data found for property "${binaryPropertyName}" on item ${i}.` } as JsonObject, { itemIndex: i });
	}

	const binaryProperty = item.binary[binaryPropertyName];
	this.logger?.debug(`[ghostApiImageUpload] Binary property details: fileName="${binaryProperty.fileName}", mimeType="${binaryProperty.mimeType}"`);
	// Use the n8n helper function to get the actual data buffer
	// This correctly handles direct base64 data or filesystem references like "filesystem-v2..."
	this.logger?.debug(`[ghostApiImageUpload] Attempting to get binary data buffer using n8n helper for item ${i}, property "${binaryPropertyName}"`);
	const dataBuffer = await (this as IExecuteFunctions).helpers.getBinaryDataBuffer(i, binaryPropertyName);
	this.logger?.debug(`[ghostApiImageUpload] dataBuffer obtained via helper - length: ${dataBuffer.length}`);
	// if (dataBuffer.length > 0 && dataBuffer.length < 200) { // Log content only for small/medium buffers to avoid flooding
	// 	this.logger?.debug(`[ghostApiImageUpload] dataBuffer obtained via helper - first 50 bytes (hex): ${dataBuffer.slice(0, 50).toString('hex')}`);
	// } else 
	if (dataBuffer.length === 0) {
		this.logger?.warn(`[ghostApiImageUpload] dataBuffer obtained via helper is EMPTY for item ${i}, property "${binaryPropertyName}"`);
	}

	// --- Improved file extension and name generation ---
	let determinedExtension = '';
	const providedFileName = additionalFormData.fileName as string || binaryProperty.fileName;
	const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.tiff'];

	if (providedFileName) {
		const extFromProvided = path.extname(providedFileName).toLowerCase();
		if (validImageExtensions.includes(extFromProvided)) {
			determinedExtension = extFromProvided;
		}
	}

	if (!determinedExtension && binaryProperty.mimeType) {
		const mimeTypeParts = binaryProperty.mimeType.split('/');
		if (mimeTypeParts[0] === 'image' && mimeTypeParts[1]) {
			let extFromMime = `.${mimeTypeParts[1].toLowerCase()}`;
			if (extFromMime === '.jpeg') extFromMime = '.jpg'; // Normalize
			if (validImageExtensions.includes(extFromMime)) {
				determinedExtension = extFromMime;
			}
		}
	}

	if (!determinedExtension) {
		// If still no valid extension, try to use the original extension if it exists, otherwise default.
		if (providedFileName && path.extname(providedFileName)){
			determinedExtension = path.extname(providedFileName).toLowerCase();
		} else {
			determinedExtension = '.jpg'; // Fallback to .jpg if no other info is available
			this.logger?.debug('[ghostApiImageUpload] No valid extension found, defaulting to .jpg');
		}
	}

	const baseName = providedFileName ? path.basename(providedFileName, path.extname(providedFileName)) : 'uploaded_image';
	let safeFileName = `${baseName}${determinedExtension}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
	if (!path.extname(safeFileName) && determinedExtension) {
	    safeFileName = `${path.basename(safeFileName, path.extname(safeFileName))}${determinedExtension}`;
	} else if (!path.extname(safeFileName)){
	    safeFileName = `${safeFileName}.jpg`;
	}
	this.logger?.debug(`[ghostApiImageUpload] Determined extension: "${determinedExtension}", Safe file name for temp: "${safeFileName}"`);
	// --- End of improved file name generation ---

	const api = new GhostAdminAPI({
		url: credentials.url as string,
		key: credentials.apiKey as string, 
		version: 'v5.0',
	});

	let tempFilePath: string | undefined;
	try {
		const tempDir = os.tmpdir();
		tempFilePath = path.join(tempDir, safeFileName);
		this.logger?.debug(`[ghostApiImageUpload] Creating temporary file at: "${tempFilePath}"`);

		await fs.writeFile(tempFilePath, dataBuffer);
		this.logger?.debug(`[ghostApiImageUpload] Temporary file written successfully.`);

		const apiRef = safeFileName; // Always use safeFileName (with extension) for the API call's ref
		this.logger?.debug(`[ghostApiImageUpload] Determined API ref (from safeFileName): "${apiRef}"`);

		// Log what the user provided as ref in additionalFields, if anything
		if (additionalFormData.ref) {
			this.logger?.debug(`[ghostApiImageUpload] User-provided ref (additionalFields.ref): "${additionalFormData.ref as string}"`);
		}

		this.logger?.debug(`[ghostApiImageUpload] Calling api.images.upload with file: "${tempFilePath}", using apiRef: "${apiRef}"`);
		const result = await api.images.upload({
			file: tempFilePath,
			//ref: apiRef, // Use the safeFileName (with extension) as the ref for the API
		});
		this.logger?.debug('[ghostApiImageUpload] Image upload successful. API Response:', result);
		return result;

	} catch (error: any) {
		const errorMessage = error.message || 'Unknown error during Ghost API image upload.';
		let errorDetails: IDataObject = {};
		if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
			errorDetails.ghostErrors = error.errors.map((err: any) => ({ 
				message: err.message, 
				context: err.context, 
				type: err.type,
				help: err.help,
				code: err.code,
				id: err.id,
			}));
		} else if (error.response?.data) {
			errorDetails.responseData = error.response.data;
		} else if (error.context) {
			errorDetails.context = error.context;
		} else {
			errorDetails.rawError = error.toString();
		}
		this.logger?.error(`[ghostApiImageUpload] Error during image upload: ${errorMessage}`, errorDetails);
		throw new NodeApiError(this.getNode(), { message: errorMessage, ...errorDetails } as JsonObject, { itemIndex: i });
	} finally {
		if (tempFilePath) {
			try {
				// await fs.unlink(tempFilePath); // Temporarily disabled for debugging
				this.logger?.debug(`[ghostApiImageUpload] Successfully deleted temporary file: "${tempFilePath}"`);
			} catch (cleanupError) {
				this.logger?.error(`[ghostApiImageUpload] Failed to delete temporary file "${tempFilePath}": ${(cleanupError as Error).message}`);
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

	if (!(this as IExecuteFunctions).getInputData) {
		throw new NodeApiError(this.getNode(), { message: 'Media upload is not supported for this node type (requires IExecuteFunctions)' } as JsonObject, { itemIndex: i });
	}

	const item = (this as IExecuteFunctions).getInputData(i)[0]; // Assuming one item at a time for simplicity, adjust if batching

	if (!item.binary || !item.binary[binaryPropertyName]) {
		throw new NodeApiError(this.getNode(), { message: `No binary data found for property "${binaryPropertyName}" in item ${i}.` } as JsonObject, { itemIndex: i });
	}

	const binaryProperty = item.binary[binaryPropertyName];
	this.logger?.debug(`[ghostApiMediaUpload] Processing media for item ${i}, binary property: "${binaryPropertyName}"`);
	this.logger?.debug(`[ghostApiMediaUpload] Binary details: fileName="${binaryProperty.fileName}", mimeType="${binaryProperty.mimeType}"`);

	// Get main media data buffer
	this.logger?.debug(`[ghostApiMediaUpload] Attempting to get main media data buffer using n8n helper for item ${i}, property "${binaryPropertyName}"`);
	const mainDataBuffer = await (this as IExecuteFunctions).helpers.getBinaryDataBuffer(i, binaryPropertyName);
	this.logger?.debug(`[ghostApiMediaUpload] Main media dataBuffer obtained - length: ${mainDataBuffer.length}`);
	if (mainDataBuffer.length === 0) {
		throw new NodeApiError(this.getNode(), { message: `Main media data buffer for "${binaryPropertyName}" is empty in item ${i}.` } as JsonObject, { itemIndex: i });
	}

	// Determine file extension and safe file name for the main media
	let mainFileName = additionalFormData.fileName as string || binaryProperty.fileName || 'uploaded_media';
	let mainFileExt = path.extname(mainFileName).toLowerCase();
	if (!mainFileExt && binaryProperty.mimeType) {
		const mimeExt = `.${binaryProperty.mimeType.split('/')[1]}`.toLowerCase();
		if (mimeExt) mainFileExt = mimeExt;
	}
	if (!mainFileExt) mainFileExt = '.bin'; // Fallback extension
	mainFileName = `${path.basename(mainFileName, path.extname(mainFileName))}${mainFileExt}`.replace(/[^a-zA-Z0-9_.-]/g, '_');

	let tempMainFilePath: string | undefined;
	let tempThumbnailFilePath: string | undefined;

	const api = new GhostAdminAPI({
		url: credentials.url as string,
		key: credentials.apiKey as string,
		version: 'v5.0',
	});

	try {
		// Create temporary file for main media
		const tempDir = os.tmpdir();
		tempMainFilePath = path.join(tempDir, `n8n_media_${Date.now()}_${mainFileName}`);
		await fs.writeFile(tempMainFilePath, mainDataBuffer);
		this.logger?.debug(`[ghostApiMediaUpload] Main media temporary file created at: "${tempMainFilePath}"`);

		const uploadOptions: { file: string; ref?: string; thumbnailFile?: string; } = {
			file: tempMainFilePath,
		};

		// Handle thumbnail if provided
		const thumbnailBinaryPropName = additionalFormData.thumbnailBinaryProperty as string;
		if (thumbnailBinaryPropName && item.binary && item.binary[thumbnailBinaryPropName]) {
			const thumbnailProperty = item.binary[thumbnailBinaryPropName];
			this.logger?.debug(`[ghostApiMediaUpload] Processing thumbnail for item ${i}, binary property: "${thumbnailBinaryPropName}"`);
			this.logger?.debug(`[ghostApiMediaUpload] Thumbnail details: fileName="${thumbnailProperty.fileName}", mimeType="${thumbnailProperty.mimeType}"`);

			const thumbnailDataBuffer = await (this as IExecuteFunctions).helpers.getBinaryDataBuffer(i, thumbnailBinaryPropName);
			this.logger?.debug(`[ghostApiMediaUpload] Thumbnail dataBuffer obtained - length: ${thumbnailDataBuffer.length}`);

			if (thumbnailDataBuffer.length > 0) {
				let thumbFileName = thumbnailProperty.fileName || 'uploaded_thumbnail';
				let thumbFileExt = path.extname(thumbFileName).toLowerCase();
				if (!thumbFileExt && thumbnailProperty.mimeType) {
					const mimeExt = `.${thumbnailProperty.mimeType.split('/')[1]}`.toLowerCase();
					if (mimeExt) thumbFileExt = mimeExt;
				}
				if (!thumbFileExt) thumbFileExt = '.jpg'; // Fallback extension for thumbnails
				thumbFileName = `${path.basename(thumbFileName, path.extname(thumbFileName))}${thumbFileExt}`.replace(/[^a-zA-Z0-9_.-]/g, '_');

				tempThumbnailFilePath = path.join(tempDir, `n8n_thumb_${Date.now()}_${thumbFileName}`);
				await fs.writeFile(tempThumbnailFilePath, thumbnailDataBuffer);
				this.logger?.debug(`[ghostApiMediaUpload] Thumbnail temporary file created at: "${tempThumbnailFilePath}"`);
				uploadOptions.thumbnailFile = tempThumbnailFilePath;
			} else {
				this.logger?.warn(`[ghostApiMediaUpload] Thumbnail data buffer for "${thumbnailBinaryPropName}" is empty in item ${i}. Skipping thumbnail.`);
			}
		}

		// Set 'ref' for the upload, defaults to the main file name if not provided
		uploadOptions.ref = (additionalFormData.ref as string) || mainFileName;
		this.logger?.debug(`[ghostApiMediaUpload] Calling api.media.upload with options: ${JSON.stringify({ ...uploadOptions, file: '...', thumbnailFile: uploadOptions.thumbnailFile ? '...' : undefined })}`);

		const result = await api.media.upload(uploadOptions);
		this.logger?.debug(`[ghostApiMediaUpload] Media upload successful. API Response: ${JSON.stringify(result)}`);
		return result;

	} catch (error: any) {
		let errorMessage = 'Unknown error during media upload';
		const errorDetails: IDataObject = {};
		if (error.message) {
			errorMessage = error.message;
		}
		if (error.response && error.response.body && error.response.body.errors) {
			errorDetails.ghostErrors = error.response.body.errors;
			errorMessage = error.response.body.errors.map((e: any) => e.message).join(', ');
		} else if (error.context) {
			errorDetails.context = error.context;
		} else {
			errorDetails.rawError = error.toString();
		}
		this.logger?.error(`[ghostApiMediaUpload] Error during media upload: ${errorMessage}`, errorDetails);
		throw new NodeApiError(this.getNode(), { message: errorMessage, ...errorDetails } as JsonObject, { itemIndex: i });
	} finally {
		// Clean up main media temporary file
		if (tempMainFilePath) {
			try {
				await fs.unlink(tempMainFilePath);
				this.logger?.debug(`[ghostApiMediaUpload] Successfully deleted main media temporary file: "${tempMainFilePath}"`);
			} catch (cleanupError) {
				this.logger?.error(`[ghostApiMediaUpload] Failed to delete main media temporary file "${tempMainFilePath}": ${(cleanupError as Error).message}`);
			}
		}
		// Clean up thumbnail temporary file
		if (tempThumbnailFilePath) {
			try {
				await fs.unlink(tempThumbnailFilePath);
				this.logger?.debug(`[ghostApiMediaUpload] Successfully deleted thumbnail temporary file: "${tempThumbnailFilePath}"`);
			} catch (cleanupError) {
				this.logger?.error(`[ghostApiMediaUpload] Failed to delete thumbnail temporary file "${tempThumbnailFilePath}": ${(cleanupError as Error).message}`);
			}
		}
	}
}