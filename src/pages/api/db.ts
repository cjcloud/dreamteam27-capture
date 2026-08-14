import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDbOperations } from '@/lib/firebase-admin';

// Types for API responses
type ApiResponse = {
  success: boolean;
  data?: any;
  error?: string;
  stack?: string; // dev-only diagnostic, included when NODE_ENV === 'development'
};

/**
 * API route for Firebase Admin SDK database operations
 * This allows secure database operations without exposing Firebase credentials to the client
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Set CORS headers manually
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    console.log(`Method ${req.method || 'unknown'} not allowed`);
    return res.status(405).json({ 
      success: false, 
      error: `Method ${req.method || 'unknown'} Not Allowed` 
    });
  }

  try {
    console.log('API route called: /api/db');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    
    // Get request body
    const { operation, path, data } = req.body;
    
    console.log('Request body:', { operation, path, data: data ? '[DATA]' : undefined });
    
    // Validate required fields
    if (!operation || !path) {
      console.log('Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: operation and path'
      });
    }
    
    // Perform the requested operation
    let result;
    try {
      switch (operation) {
        case 'get':
          console.log(`Performing GET operation on path: ${path}`);
          result = await adminDbOperations.get(path);
          break;
        case 'set':
          if (data === undefined) {
            console.log('Missing data for SET operation');
            return res.status(400).json({
              success: false,
              error: 'Missing required field: data'
            });
          }
          console.log(`Performing SET operation on path: ${path}`);
          result = await adminDbOperations.set(path, data);
          break;
        case 'update':
          if (data === undefined) {
            console.log('Missing data for UPDATE operation');
            return res.status(400).json({
              success: false,
              error: 'Missing required field: data'
            });
          }
          console.log(`Performing UPDATE operation on path: ${path}`);
          result = await adminDbOperations.update(path, data);
          break;
        case 'remove':
          console.log(`Performing REMOVE operation on path: ${path}`);
          result = await adminDbOperations.remove(path);
          break;
        default:
          console.log(`Invalid operation: ${operation}`);
          return res.status(400).json({
            success: false,
            error: `Invalid operation: ${operation}`
          });
      }
      
      console.log('Operation completed successfully');
      return res.status(200).json({ success: true, data: result });
    } catch (operationError) {
      console.error('Operation failed:', operationError);
      
      // Log more details about the error
      if (operationError instanceof Error) {
        console.error('Error message:', operationError.message);
        console.error('Error stack:', operationError.stack);
      }
      
      return res.status(500).json({
        success: false,
        error: operationError instanceof Error ? operationError.message : 'Unknown operation error',
        stack: process.env.NODE_ENV === 'development' && operationError instanceof Error ? operationError.stack : undefined
      });
    }
  } catch (error) {
    console.error('API error:', error);
    
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    });
  }
}
