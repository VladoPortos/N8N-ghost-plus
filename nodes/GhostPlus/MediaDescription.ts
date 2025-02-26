import {
	INodeProperties,
} from 'n8n-workflow';

export const mediaOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				source: [
					'adminApi',
				],
				resource: [
					'media',
				],
			},
		},
		options: [
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload media (video/audio) to Ghost CMS',
				action: 'Upload media',
			},
		],
		default: 'upload',
	},
];

export const mediaFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                media:upload                                */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Binary Property',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: {
			show: {
				source: [
					'adminApi',
				],
				resource: [
					'media',
				],
				operation: [
					'upload',
				],
			},
		},
		description: 'The name of the binary property which contains the media to be uploaded',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		displayOptions: {
			show: {
				source: [
					'adminApi',
				],
				resource: [
					'media',
				],
				operation: [
					'upload',
				],
			},
		},
		default: {},
		options: [
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				description: 'Custom file name for the uploaded media',
			},
			{
				displayName: 'Reference',
				name: 'ref',
				type: 'string',
				default: '',
				description: 'Optional reference identifier for the media (e.g., original file path)',
			},
			{
				displayName: 'Thumbnail Binary Property',
				name: 'thumbnailBinaryProperty',
				type: 'string',
				default: '',
				description: 'The name of the binary property which contains the thumbnail image (required for videos)',
			},
		],
	},
];
