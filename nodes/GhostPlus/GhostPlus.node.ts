import {
	IExecuteFunctions,
} from 'n8n-workflow';

import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import {
	ghostApiRequest,
	ghostApiRequestAllItems,
	validateJSON,
	ghostApiImageUpload,
	ghostApiMediaUpload,
} from './GenericFunctions';

import {
	postFields,
	postOperations,
} from './PostDescription';

import {
	imageFields,
	imageOperations,
} from './ImageDescription';

import {
	mediaFields,
	mediaOperations,
} from './MediaDescription';

import moment from 'moment-timezone';

export class GhostPlus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ghost Plus',
		name: 'ghostPlus',
		icon: 'file:ghostplus.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Ghost API V2 with enhanced features',
		defaults: {
			name: 'Ghost Plus',
		},
		inputs: ['main'] as string[],
		outputs: ['main'] as string[],
		credentials: [
			{
				name: 'ghostPlusAdminApi',
				required: true,
				displayOptions: {
					show: {
						source: [
							'adminApi',
						],
					},
				},
			},
			{
				name: 'ghostPlusContentApi',
				required: true,
				displayOptions: {
					show: {
						source: [
							'contentApi',
						],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Source',
				name: 'source',
				type: 'options',
				description: 'Pick where your data comes from, Content or Admin API',
				options: [
					{
						name: 'Admin API',
						value: 'adminApi',
					},
					{
						name: 'Content API',
						value: 'contentApi',
					},
				],
				default: 'contentApi',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Image',
						value: 'image',
						description: 'Upload images to Ghost CMS',
						displayOptions: {
							show: {
								source: [
									'adminApi',
								],
							},
						},
					},
					{
						name: 'Media',
						value: 'media',
						description: 'Upload media (video/audio) to Ghost CMS',
						displayOptions: {
							show: {
								source: [
									'adminApi',
								],
							},
						},
					},
					{
						name: 'Post',
						value: 'post',
						description: 'Work with Ghost blog posts',
					},
				],
				noDataExpression: true,
				default: 'post',
				description: 'Choose the resource type',
			},
			...postOperations,
			...postFields,
			...imageOperations,
			...imageFields,
			...mediaOperations,
			...mediaFields,
		],
	};


	methods = {
		loadOptions: {
			// Get all the authors to display them to user so that he can
			// select them easily
			async getAuthors(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const users = await ghostApiRequestAllItems.call(
					this,
					'users',
					'GET',
					`/admin/users`,
				);
				for (const user of users) {
					returnData.push({
						name: user.name,
						value: user.id,
					});
				}
				return returnData;
			},
			// Get all the tags to display them to user so that he can
			// select them easily
			async getTags(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const tags = await ghostApiRequestAllItems.call(
					this,
					'tags',
					'GET',
					`/admin/tags`,
				);
				for (const tag of tags) {
					returnData.push({
						name: tag.name,
						value: tag.name,
					});
				}
				return returnData;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = items.length;
		const timezone = this.getTimezone();
		const qs: IDataObject = {};
		let responseData;
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const source = this.getNodeParameter('source', 0) as string;
		for (let i = 0; i < length; i++) {
			try {
				if (source === 'contentApi') {
					if (resource === 'post') {
						if (operation === 'get') {

							const by = this.getNodeParameter('by', i) as string;

							const identifier = this.getNodeParameter('identifier', i) as string;

							const options = this.getNodeParameter('options', i) as IDataObject;

							Object.assign(qs, options);

							let endpoint;

							if (by === 'slug') {
								endpoint = `/content/posts/slug/${identifier}`;
							} else {
								endpoint = `/content/posts/${identifier}`;
							}
							responseData = await ghostApiRequest.call(this, 'GET', endpoint, {}, qs);

							returnData.push.apply(returnData, responseData.posts);

						}

						if (operation === 'getAll') {

							const returnAll = this.getNodeParameter('returnAll', 0) as boolean;

							const options = this.getNodeParameter('options', i) as IDataObject;

							Object.assign(qs, options);

							if (returnAll) {
								responseData = await ghostApiRequestAllItems.call(this, 'posts', 'GET', '/content/posts', {} ,qs);
							} else {
								qs.limit = this.getNodeParameter('limit', 0);
								responseData = await ghostApiRequest.call(this, 'GET', '/content/posts', {}, qs);
								responseData = responseData.posts;
							}

							returnData.push.apply(returnData, responseData);

						}
					}
				}

				if (source === 'adminApi') {
					if (resource === 'post') {
						if (operation === 'create') {

							const title = this.getNodeParameter('title', i) as string;

							const contentFormat = this.getNodeParameter('contentFormat', i) as string;

							const content = this.getNodeParameter('content', i) as string;

							const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

							const post: IDataObject = {
								title,
							};

							if (contentFormat === 'html') {
								post.html = content;
								qs.source = 'html';
							} else {
								const mobileDoc = validateJSON(content);
								if (mobileDoc === undefined) {
									throw new NodeOperationError(this.getNode(), 'Content must be a valid JSON');
								}
								post.mobiledoc = content;
							}

							delete post.content;

							Object.assign(post, additionalFields);

							if (post.published_at) {
								post.published_at = moment.tz(post.published_at, timezone).utc().format();
							}

							if (post.status === 'scheduled' && post.published_at === undefined) {
								throw new NodeOperationError(this.getNode(), 'Published at must be define when status is scheduled');
							}

							responseData = await ghostApiRequest.call(this, 'POST', '/admin/posts', { posts: [post] }, qs);

							returnData.push.apply(returnData, responseData.posts);

						}

						if (operation === 'delete') {

							const postId = this.getNodeParameter('postId', i) as string;

							responseData = await ghostApiRequest.call(this, 'DELETE', `/admin/posts/${postId}`);

							returnData.push({ success: true });

						}

						if (operation === 'get') {

							const by = this.getNodeParameter('by', i) as string;

							const identifier = this.getNodeParameter('identifier', i) as string;

							const options = this.getNodeParameter('options', i) as IDataObject;

							Object.assign(qs, options);

							let endpoint;

							if (by === 'slug') {
								endpoint = `/admin/posts/slug/${identifier}`;
							} else {
								endpoint = `/admin/posts/${identifier}`;
							}
							responseData = await ghostApiRequest.call(this, 'GET', endpoint, {}, qs);

							returnData.push.apply(returnData, responseData.posts);

						}

						if (operation === 'getAll') {


							const returnAll = this.getNodeParameter('returnAll', 0) as boolean;

							const options = this.getNodeParameter('options', i) as IDataObject;

							Object.assign(qs, options);

							if (returnAll) {
								responseData = await ghostApiRequestAllItems.call(this, 'posts', 'GET', '/admin/posts', {} ,qs);
							} else {
								qs.limit = this.getNodeParameter('limit', 0);
								responseData = await ghostApiRequest.call(this, 'GET', '/admin/posts', {}, qs);
								responseData = responseData.posts;
							}

							returnData.push.apply(returnData, responseData);

						}

						if (operation === 'update') {

							const postId = this.getNodeParameter('postId', i) as string;

							const contentFormat = this.getNodeParameter('contentFormat', i) as string;

							const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

							const post: IDataObject = {};

							if (contentFormat === 'html') {
								post.html = updateFields.content || '';
								qs.source = 'html';
								delete updateFields.content;
							} else {
								const mobileDoc = validateJSON(updateFields.contentJson as string || undefined);
								if (mobileDoc === undefined) {
									throw new NodeOperationError(this.getNode(), 'Content must be a valid JSON');
								}
								post.mobiledoc = updateFields.contentJson;
								delete updateFields.contentJson;
							}

							Object.assign(post, updateFields);

							const { posts } = await ghostApiRequest.call(this, 'GET', `/admin/posts/${postId}`, {}, { fields: 'id, updated_at' });

							if (post.published_at) {
								post.published_at = moment.tz(post.published_at, timezone).utc().format();
							}

							if (post.status === 'scheduled' && post.published_at === undefined) {
								throw new NodeOperationError(this.getNode(), 'Published at must be define when status is scheduled');
							}

							post.updated_at = posts[0].updated_at;

							responseData = await ghostApiRequest.call(this, 'PUT', `/admin/posts/${postId}`, { posts: [post] }, qs);

							returnData.push.apply(returnData, responseData.posts);

						}
					}

					if (resource === 'image') {
						if (operation === 'upload') {

							const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

							const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

							this.logger.debug(`[GhostPlus.node.ts] Attempting image upload for item index: ${i}. Binary property: "${binaryPropertyName}"`);
							const currentItem = items[i];
							if (currentItem && currentItem.binary && currentItem.binary[binaryPropertyName]) {
								this.logger.debug(`[GhostPlus.node.ts] currentItem.binary["${binaryPropertyName}"] exists. Keys in currentItem.binary: ${Object.keys(currentItem.binary).join(', ')}`);
							} else {
								let reason = 'currentItem, currentItem.binary, or currentItem.binary[binaryPropertyName] is null/undefined.';
								if (currentItem && currentItem.binary) {
									reason = `Key "${binaryPropertyName}" not found in currentItem.binary. Existing keys: ${Object.keys(currentItem.binary).join(', ')}`;
								} else if (currentItem) {
									reason = 'currentItem.binary is null/undefined.';
								} else {
									reason = 'currentItem is null/undefined.';
								}
								this.logger.debug(`[GhostPlus.node.ts] currentItem.binary["${binaryPropertyName}"] DOES NOT exist or is not accessible. Reason: ${reason}`);
							}

							// Pass to the ghostApiImageUpload function which has proper error handling
							const responseData = await ghostApiImageUpload.call(this, binaryPropertyName, i, additionalFields);

							returnData.push({ json: responseData });

						}
					}

					if (resource === 'media') {
						if (operation === 'upload') {

							const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

							const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

							// Pass to the ghostApiMediaUpload function which has proper error handling
							const responseData = await ghostApiMediaUpload.call(this, binaryPropertyName, i, additionalFields);

							returnData.push({ json: responseData });

						}
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: error.message });
					continue;
				}
				throw error;
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}