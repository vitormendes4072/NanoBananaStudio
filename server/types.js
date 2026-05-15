// @ts-check
// Shared JSDoc type definitions for the backend.
// Import in any file with: import {} from './types.js'

/**
 * @typedef {'queued' | 'processing' | 'done' | 'failed' | 'cancelled'} JobStatus
 */

/**
 * @typedef {Object} Job
 * @property {number} id
 * @property {number} batchId
 * @property {JobStatus} status
 * @property {string} model
 * @property {string} prompt
 * @property {string} [promptBase]
 * @property {Record<string, string>} [promptOptions]
 * @property {string} [targetFolder]
 * @property {ReferenceImage[]} [referenceImages]
 * @property {string} createdAt - ISO 8601
 * @property {string} [finishedAt] - ISO 8601
 * @property {string} [filename]
 * @property {string} [imageUrl]
 * @property {number} [estimatedCost]
 * @property {string} [error]
 * @property {string} [errorType]
 */

/**
 * @typedef {Object} ReferenceImage
 * @property {string} data - base64 encoded image
 * @property {string} mimeType
 * @property {string} [filename]
 */

/**
 * @typedef {Object} Cutout
 * @property {string} id
 * @property {string} filename
 * @property {string} [folder]
 * @property {string} [sourceJobId]
 * @property {string} createdAt - ISO 8601
 */

/**
 * @typedef {Object} Crop
 * @property {string} id
 * @property {string} filename
 * @property {string} [folder]
 * @property {string} [sourceJobId]
 * @property {string} createdAt - ISO 8601
 */

/**
 * @typedef {Object} ProductModel
 * @property {string} alias
 * @property {string} name
 * @property {string} [notes]
 * @property {ReferenceImage[]} [referenceImages]
 * @property {string} createdAt - ISO 8601
 * @property {string} updatedAt - ISO 8601
 */

/**
 * @typedef {Object} ImageTemplate
 * @property {string} alias
 * @property {string} name
 * @property {string} [notes]
 * @property {Record<string, string>} [promptOptions]
 * @property {ReferenceImage[]} [referenceImages]
 * @property {string} createdAt - ISO 8601
 * @property {string} updatedAt - ISO 8601
 */

/**
 * @typedef {Object} QueueState
 * @property {number} lastJobId
 * @property {number} lastBatchId
 */

export {};
