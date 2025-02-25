import {
	INodeProperties,
} from 'n8n-workflow';

export const imageOperations: INodeProperties[] = [
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
					'image',
				],
			},
		},
		options: [
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload an image to Ghost CMS',
				action: 'Upload an image',
			},
		],
		default: 'upload',
	},
];

export const imageFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                image:upload                                */
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
					'image',
				],
				operation: [
					'upload',
				],
			},
		},
		description: 'The name of the binary property which contains the image to be uploaded',
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
					'image',
				],
				operation: [
					'upload',
				],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Purpose',
				name: 'purpose',
				type: 'options',
				options: [
					{
						name: 'Image',
						value: 'image',
						description: 'General image upload',
					},
					{
						name: 'Profile Image',
						value: 'profile_image',
						description: 'Profile image (must be square)',
					},
					{
						name: 'Icon',
						value: 'icon',
						description: 'Icon (must be square)',
					},
				],
				default: 'image',
				description: 'The intended use of the image',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				description: 'Custom file name for the uploaded image',
			},
			{
				displayName: 'Reference',
				name: 'ref',
				type: 'string',
				default: '',
				description: 'Optional reference identifier for the image (e.g., original file path)',
			},
		],
	},
];
