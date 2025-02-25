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
} from './GenericFunctions';

import {
	postFields,
	postOperations,
} from './PostDescription';

import moment from 'moment-timezone';

export class GhostPlus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GhostPlus',
		name: 'ghostPlus',
		icon: 'file:ghostv2.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Enhanced Ghost CMS integration with V2 API support',
		defaults: {
			name: 'GhostPlus',
		},
		inputs: ['main'] as string[],
		outputs: ['main'] as string[],
		usableAsTool: true,
		codex: {
			categories: ['Content Management', 'Blogging'],
			alias: ['ghost-cms', 'blog', 'content'],
			subcategories: {
				'Content Management': ['Blog Posts', 'Content Creation'],
			},
		},
		credentials: [
			{
				name: 'ghostAdminApi',
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
				name: 'ghostContentApi',
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
				noDataExpression: true,
				options: [
					{
						name: 'Post',
						value: 'post',
					},
				],
				default: 'post',
				description: 'Resource to consume',
				hint: 'Select the Ghost CMS resource to interact with',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [
							'post',
						],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new blog post',
						action: 'Create a new blog post',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a blog post',
						action: 'Get a blog post',
					},
					{
						name: 'Get All',
						value: 'getAll',
						description: 'Get all blog posts',
						action: 'Get all blog posts',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a blog post',
						action: 'Update a blog post',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'create',
							'update',
						],
						resource: [
							'post',
						],
					},
				},
				description: 'Title of the blog post',
				hint: 'Can be provided directly or via AI agent input',
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'create',
							'update',
						],
						resource: [
							'post',
						],
					},
				},
				description: 'Content of the blog post in HTML format',
				hint: 'Can be provided directly or via AI agent input. Supports HTML formatting.',
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
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		try {
			const credentials = await this.getCredentials('ghostAdminApi');
			if (!credentials) {
				throw new NodeOperationError(this.getNode(), 'No credentials got returned!');
			}

			for (let i = 0; i < items.length; i++) {
				const item = items[i].json as IDataObject;

				try {
					if (resource === 'post') {
						if (operation === 'create' || operation === 'update') {
							// Enhanced input handling for AI compatibility
							let title = '';
							let content = '';
							
							if (item) {
								// Try various AI input fields for title
								if (typeof item.title === 'string') {
									title = item.title;
								} else if (typeof item.name === 'string') {
									title = item.name;
								} else {
									title = this.getNodeParameter('title', i) as string;
								}

								// Try various AI input fields for content
								if (typeof item.content === 'string') {
									content = item.content;
								} else if (typeof item.text === 'string') {
									content = item.text;
								} else if (typeof item.html === 'string') {
									content = item.html;
								} else {
									content = this.getNodeParameter('content', i) as string;
								}
							} else {
								title = this.getNodeParameter('title', i) as string;
								content = this.getNodeParameter('content', i) as string;
							}

							const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

							const body: IDataObject = {
								posts: [
									{
										title,
										html: content,
										...additionalFields,
									},
								],
							};

							let response;
							if (operation === 'create') {
								response = await ghostApiRequest.call(this, 'POST', '/posts/', body);
							} else {
								const postId = this.getNodeParameter('postId', i) as string;
								body.posts[0].id = postId;
								response = await ghostApiRequest.call(this, 'PUT', `/posts/${postId}/`, body);
							}

							// Format output for AI compatibility
							returnData.push({
								json: {
									success: true,
									operation,
									post: response.posts[0],
									metadata: {
										timestamp: new Date().toISOString(),
										operation,
										resource,
									},
								},
							});
						} else if (operation === 'get') {
							const postId = this.getNodeParameter('postId', i) as string;
							const response = await ghostApiRequest.call(this, 'GET', `/posts/${postId}/`);

							returnData.push({
								json: {
									success: true,
									operation,
									post: response.posts[0],
									metadata: {
										timestamp: new Date().toISOString(),
										operation,
										resource,
									},
								},
							});
						} else if (operation === 'getAll') {
							const response = await ghostApiRequest.call(this, 'GET', '/posts/');

							returnData.push({
								json: {
									success: true,
									operation,
									posts: response.posts,
									metadata: {
										timestamp: new Date().toISOString(),
										operation,
										resource,
										total: response.posts.length,
									},
								},
							});
						}
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								success: false,
								error: error.message,
								operation,
								resource,
								metadata: {
									timestamp: new Date().toISOString(),
									operation,
									resource,
								},
							},
						});
						continue;
					}
					throw error;
				}
			}

			return [returnData];
		} catch (error) {
			if (this.continueOnFail()) {
				return [returnData];
			}
			throw error;
		}
	}
}