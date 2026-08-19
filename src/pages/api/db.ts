import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDbOperations, verifyAdminRequest } from '@/lib/firebase-admin';
import { DB_PATHS } from '@/lib/constants';

// Types for API responses
type ApiResponse = {
  success: boolean;
  data?: any;
  error?: string;
  stack?: string; // dev-only diagnostic, included when NODE_ENV === 'development'
};

// This is the ONLY server-side enforcement point for every page's data —
// the client-side AuthGuard (client-layout.tsx) is just a UI redirect and
// never stopped a direct call here. /builder is intentionally reachable
// without login (see PROJECT-STATUS.md), so its own writes (saving a team)
// stay open; every other write requires a verified Firebase ID token.
// Reads stay open across the board, matching the Realtime Database's own
// public-read rule (see the MOBILE_ARCHIVE comment in constants.ts).
const PUBLIC_WRITE_PATHS = new Set<string>([DB_PATHS.MANAGERS, '/timestamp']);

// Never reachable through this generic passthrough, regardless of auth —
// it has its own dedicated, gated route (see the comment on
// DB_PATHS.MOBILE_ARCHIVE in constants.ts for why it needs to be handled
// there instead of via a Realtime Database rule).
const BLOCKED_PATHS = new Set<string>([DB_PATHS.MOBILE_ARCHIVE]);

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

    if (BLOCKED_PATHS.has(path)) {
      console.log(`Blocked path requested via generic /api/db: ${path}`);
      return res.status(403).json({
        success: false,
        error: 'This path is not available through this endpoint.'
      });
    }

    // Auth gate: reads are public; writes are public ONLY for the paths the
    // unauthenticated /builder page itself needs to write (saving a team).
    // Everything else requires a valid Firebase ID token.
    const isPublicWrite = operation === 'set' && PUBLIC_WRITE_PATHS.has(path);
    if (operation !== 'get' && !isPublicWrite) {
      const authHeaderRaw = req.headers.authorization;
      const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
      const pseudoRequest = {
        headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authHeader ?? null : null) },
      } as unknown as Request;
      const admin = await verifyAdminRequest(pseudoRequest);
      if (!admin) {
        console.log(`Rejected unauthenticated ${operation} on ${path}`);
        return res.status(401).json({
          success: false,
          error: 'Login required for this operation.'
        });
      }
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
