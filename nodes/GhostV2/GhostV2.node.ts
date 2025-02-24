import {
	IExecuteFunctions,
} from 'n8n-core';

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
} from './GenericFunctions';

import {
	postFields,
	postOperations,
} from './PostDescription';

import moment from 'moment-timezone';

export class Ghostv2 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ghost V2',
		name: 'ghostV2',
		icon: 'file:ghostv2.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Ghost API',
		defaults: {
			name: 'Ghost V2',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'ghostv2AdminApi',
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
				name: 'ghostv2ContentApi',
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
						name: 'Post',
						value: 'post',
					},
				],
				noDataExpression: true,
				default: 'post',
			},
			...postOperations,
			...postFields,
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

						if (operation === 'uploadImage') {
							const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
							const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
							const formData: IDataObject = {};
							
							if (!items[i].binary) {
								throw new NodeOperationError(this.getNode(), 'No binary data exists on item!');
							}

							const binaryData = items[i].binary![binaryPropertyName];
							if (!binaryData) {
								throw new NodeOperationError(this.getNode(), `No binary data property "${binaryPropertyName}" exists on item!`);
							}

							const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
							formData['file'] = {
								value: binaryDataBuffer,
								options: {
									filename: binaryData.fileName,
									contentType: binaryData.mimeType,
								},
							};
							if (additionalFields.purpose) formData['purpose'] = additionalFields.purpose;
							if (additionalFields.ref) formData['ref'] = additionalFields.ref;
							responseData = await ghostApiRequest.call(this, 'POST', '/images/upload/', formData, {
								headers: { 'Content-Type': 'multipart/form-data' },
							});
							returnData.push.apply(returnData, responseData.images);
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