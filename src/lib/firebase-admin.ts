import * as admin from 'firebase-admin';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Initialize Firebase Admin SDK
// This should only run on the server side
let adminApp: admin.app.App;

// Function to format private key correctly
const formatPrivateKey = (key: string) => {
  // If the key already contains newlines, it's probably already formatted correctly
  if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('\n')) {
    return key;
  }
  
  // Remove any quotes that might be wrapping the key
  let formattedKey = key.replace(/"/g, '');
  
  // Replace escaped newlines with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  
  // If the key doesn't have the proper PEM format, add it
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----\n`;
  }
  
  return formattedKey;
};

// Check if we're not in a browser environment (server-side only)
if (typeof window === 'undefined') {
  try {
    // Check if the app has already been initialized
    if (!admin.apps.length) {
      // For production, use environment variables
      if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
        console.log('Initializing Firebase Admin SDK with environment variables');
        
        const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
        
        // Log the first few characters of the private key for debugging
        console.log('Private key format check:', {
          length: privateKey.length,
          startsWithHeader: privateKey.startsWith('-----BEGIN PRIVATE KEY-----'),
          containsNewlines: privateKey.includes('\n'),
          // Show just the beginning of the key for debugging
          preview: privateKey.substring(0, 40) + '...'
        });
        
        adminApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
          databaseURL: 'https://footieteamz27-default-rtdb.europe-west1.firebasedatabase.app',
        });
      } 
      // Fallback for development - using service account file
      else {
        console.log('Initializing Firebase Admin SDK with service account file');
        try {
          // Use an absolute path to the service account file
          const serviceAccountPath = path.join(process.cwd(), 'src', 'lib', 'serviceAccountKey.json');
          console.log('Loading service account from:', serviceAccountPath);
          
          // Check if file exists
          if (!fs.existsSync(serviceAccountPath)) {
            throw new Error(`Service account file not found at ${serviceAccountPath}`);
          }
          
          // Load the service account file
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
          
          adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://footieteamz27-default-rtdb.europe-west1.firebasedatabase.app',
          });
        } catch (fileError) {
          console.error('Error loading service account file:', fileError);
          throw fileError;
        }
      }
    } else {
      adminApp = admin.app();
    }
    
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error; // Re-throw to make sure the error is visible
  }
}

// Export the admin database instance
export const adminDb = typeof window === 'undefined' ? admin.database() : null;

// Helper functions for database operations
export const adminDbOperations = {
  // Read operation
  get: async (path: string) => {
    if (typeof window !== 'undefined') {
      throw new Error('Admin SDK operations can only be performed on the server side');
    }
    
    try {
      const snapshot = await adminDb!.ref(path).once('value');
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error(`Error reading from ${path}:`, error);
      throw error;
    }
  },
  
  // Write operation
  set: async (path: string, data: any) => {
    if (typeof window !== 'undefined') {
      throw new Error('Admin SDK operations can only be performed on the server side');
    }
    
    try {
      await adminDb!.ref(path).set(data);
      return { success: true };
    } catch (error) {
      console.error(`Error writing to ${path}:`, error);
      throw error;
    }
  },
  
  // Update operation
  update: async (path: string, data: any) => {
    if (typeof window !== 'undefined') {
      throw new Error('Admin SDK operations can only be performed on the server side');
    }
    
    try {
      await adminDb!.ref(path).update(data);
      return { success: true };
    } catch (error) {
      console.error(`Error updating ${path}:`, error);
      throw error;
    }
  },
  
  // Delete operation
  remove: async (path: string) => {
    if (typeof window !== 'undefined') {
      throw new Error('Admin SDK operations can only be performed on the server side');
    }
    
    try {
      console.log(`[firebase-admin] Attempting to remove data at path: ${path}`);
      
      // First check if the data exists
      const snapshot = await adminDb!.ref(path).once('value');
      if (!snapshot.exists()) {
        console.log(`[firebase-admin] No data exists at path: ${path}`);
        return { success: true, message: 'No data to remove' };
      }
      
      // Log the data being removed for debugging
      console.log(`[firebase-admin] Data to be removed:`, snapshot.val());
      
      // Perform the removal
      await adminDb!.ref(path).remove();
      
      // Verify the removal was successful
      const verifySnapshot = await adminDb!.ref(path).once('value');
      if (verifySnapshot.exists()) {
        console.warn(`[firebase-admin] Data still exists at path after removal: ${path}`);
        
        // Try an alternative approach - set to null
        console.log(`[firebase-admin] Attempting alternative removal by setting to null`);
        await adminDb!.ref(path).set(null);
        
        // Verify again
        const finalVerify = await adminDb!.ref(path).once('value');
        if (finalVerify.exists()) {
          console.error(`[firebase-admin] Failed to remove data at path: ${path}`);
          return { success: false, error: 'Failed to remove data' };
        }
      }
      
      console.log(`[firebase-admin] Successfully removed data at path: ${path}`);
      return { success: true };
    } catch (error) {
      console.error(`[firebase-admin] Error removing ${path}:`, error);
      throw error;
    }
  }
};
