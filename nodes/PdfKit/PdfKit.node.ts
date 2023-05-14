import { IExecuteFunctions } from 'n8n-core';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

const PDFDocument = require('pdfkit');
var sizeOf = require('image-size');

export class PdfKit implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'PdfKit',
		name: 'pdfKit',
		group: ['transform'],
		version: 1,
		description: 'PDFKit Node',
		defaults: {
			name: 'PDFKit',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'imagesToPDF',
				required: true,
				options:[
					{
						name:'Covert Images To PDF',
						value:'imagesToPDF'
					}
				],
			},
			{
				displayName: 'Destination Key',
				name: 'outputKey',
				type: 'string',
				default: 'data',
				required: true,
				description: 'The name the binary key to copy data to',
			},
			{
				displayName: 'PDF Name',
				name: 'pdfName',
				type: 'string',
				default: '',
				required: true,
				description: 'The name of the output PDF',
			},
			{
				displayName: 'Keep Images',
				name: 'keepImages',
				type: 'boolean',
				default: false,
				description: 'Whether to keep images that were used in the PDF',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		const keepImages = this.getNodeParameter('keepImages', 0, false) as boolean;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const outputName = this.getNodeParameter('pdfName', itemIndex, '') as string;
				const outputKey = this.getNodeParameter('outputKey', itemIndex, '') as string;
				item = items[itemIndex];

				if (item.binary === undefined) {
					throw new NodeOperationError(this.getNode(), 'No binary data exists on item!');
				}

				let doc;
				for (var [index,key] of Object.keys(item.binary).entries()){
					const binary = Object.assign({},item.binary[key]);
					if(binary.fileType==='image'){
						const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, key);
						const dimensions = sizeOf(binaryDataBuffer);
						const size =[dimensions.width,dimensions.height];
						if(index !== 0){
							doc.addPage({size:size});
						}
						else{
							doc = new PDFDocument({margin:0, size:size});
						}
						doc.image(binaryDataBuffer, 0, 0, { fit: size, align: 'center', valign: 'center' })
						if(!keepImages){
							delete item.binary[key];
						}
					}
				}
				doc.end();
				item.binary![outputKey] = await this.helpers.prepareBinaryData(doc, `${outputName}.pdf`);

			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return this.prepareOutputData(items);
	}
}
