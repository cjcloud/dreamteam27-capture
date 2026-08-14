// NOTE: Legacy/unused. This client-side service-account path has been superseded
// by the Admin-SDK route (db-service.ts → /api/db → firebase-admin.ts). Kept for
// reference only; nothing imports it. Safe to delete in a future cleanup.
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, connectDatabaseEmulator, type Database } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, type Auth } from 'firebase/auth';

// Service account configuration
// This uses a dedicated service account with limited permissions
const serviceConfig = {
  apiKey: process.env.NEXT_PUBLIC_SERVICE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_SERVICE_AUTH_DOMAIN,
  databaseURL: 'https://footieteamz27-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: process.env.NEXT_PUBLIC_SERVICE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_SERVICE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_SERVICE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_SERVICE_APP_ID
};

// Check if we're running on the client side
const isBrowser = typeof window !== 'undefined';

// Initialize service app only on the client side
let serviceApp;
let serviceAuth: Auth | undefined;
let serviceDatabase: Database | undefined;
let isServiceAuthenticated = false;

if (isBrowser) {
  try {
    serviceApp = initializeApp(serviceConfig, 'service');
    serviceAuth = getAuth(serviceApp);
    serviceDatabase = getDatabase(serviceApp, 'https://footieteamz27-default-rtdb.europe-west1.firebasedatabase.app');
  } catch (error) {
    console.error('Error initializing service Firebase app:', error);
  }
}

// Authenticate the service account
const authenticateServiceAccount = async () => {
  if (!isBrowser || isServiceAuthenticated) return;
  
  try {
    const email = process.env.NEXT_PUBLIC_SERVICE_EMAIL;
    const password = process.env.NEXT_PUBLIC_SERVICE_PASSWORD;
    
    if (!email || !password) {
      console.error('Service account credentials not found in environment variables');
      return;
    }
    
    await signInWithEmailAndPassword(serviceAuth!, email, password);
    isServiceAuthenticated = true;
    console.log('Service account authenticated successfully');
  } catch (error) {
    console.error('Service account authentication failed:', error);
    throw new Error('Service authentication failed');
  }
};

// Database operations using the service account
export const serviceDb = {
  // Read operation - doesn't require authentication
  get: async (path: string) => {
    if (!isBrowser) return null;
    
    try {
      const snapshot = await get(ref(serviceDatabase!, path));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error(`Error reading from ${path}:`, error);
      throw error;
    }
  },
  
  // Write operations - require service authentication
  set: async (path: string, data: any) => {
    if (!isBrowser) return;
    
    try {
      await authenticateServiceAccount();
      await set(ref(serviceDatabase!, path), data);
    } catch (error) {
      console.error(`Error writing to ${path}:`, error);
      throw error;
    }
  },
  
  update: async (path: string, data: any) => {
    if (!isBrowser) return;
    
    try {
      await authenticateServiceAccount();
      await update(ref(serviceDatabase!, path), data);
    } catch (error) {
      console.error(`Error updating ${path}:`, error);
      throw error;
    }
  },
  
  remove: async (path: string) => {
    if (!isBrowser) return;
    
    try {
      await authenticateServiceAccount();
      await remove(ref(serviceDatabase!, path));
    } catch (error) {
      console.error(`Error removing ${path}:`, error);
      throw error;
    }
  }
};

// Export the service database reference for direct use if needed
export { serviceDb as serviceDbRef };
