import neo4jService from './neo4jService.js';
import { v4 as uuid } from 'uuid';
import logger from '../config/logger.js';

class DocumentService {
  /**
   * Create a document type
   */
  async createDocument(documentData) {
    const {
      name,
      code,
      description,
      is_mandatory = true,
    } = documentData;

    const documentId = uuid();

    const query = `
      CREATE (d:Document {
        document_id: $documentId,
        name: $name,
        code: $code,
        description: $description,
        is_mandatory: $isMandatory,
        created_at: timestamp()
      })
      RETURN d
    `;

    const params = {
      documentId,
      name,
      code,
      description,
      isMandatory: is_mandatory,
    };

    try {
      const result = await neo4jService.executeQuery(query, params, 'WRITE');
      const document = neo4jService.recordToObject(result.records[0], ['d']);
      logger.info(`Created document: ${documentId} (${name})`);
      return document.d.properties;
    } catch (error) {
      logger.error('Failed to create document:', error);
      throw error;
    }
  }

  /**
   * Get all documents
   */
  async getAllDocuments() {
    const query = `
      MATCH (d:Document)
      RETURN d
      ORDER BY d.name
    `;

    try {
      const result = await neo4jService.executeQuery(query, {});
      return neo4jService.recordsToArray(result.records, ['d']).map(r => r.d.properties);
    } catch (error) {
      logger.error('Failed to get documents:', error);
      throw error;
    }
  }
}

export default new DocumentService();
