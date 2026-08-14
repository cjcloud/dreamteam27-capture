import { initializeApp, getApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  type Auth,
} from 'firebase/auth'

// Auth app configuration
const authConfig = {
  apiKey: process.env.NEXT_PUBLIC_AUTH_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AUTH_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_AUTH_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_AUTH_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_AUTH_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_AUTH_APP_ID
}

// Database app configuration
const dbConfig = {
  apiKey: process.env.NEXT_PUBLIC_DB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_DB_AUTH_DOMAIN,
  databaseURL: 'https://footieteamz27-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: process.env.NEXT_PUBLIC_DB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_DB_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_DB_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_DB_APP_ID
}

// Check if we're running on the client side
const isBrowser = typeof window !== 'undefined'

// Initialize Firebase apps only on the client side
let authApp;
let dbApp;
let auth: Auth;
let db: Database;

if (isBrowser) {
  try {
    authApp = getApp('auth');
  } catch {
    authApp = initializeApp(authConfig, 'auth');
  }

  try {
    dbApp = getApp('database');
  } catch {
    dbApp = initializeApp(dbConfig, 'database');
  }

  // Export auth and database instances
  auth = getAuth(authApp);
  db = getDatabase(dbApp, 'https://footieteamz27-default-rtdb.europe-west1.firebasedatabase.app');
} else {
  // Provide mock implementations for server-side rendering
  auth = {} as any;
  db = {} as any;
}

export { auth, db };

// Auth helpers
export const signIn = async (email: string, password: string) => {
  if (!isBrowser) {
    console.error('Auth functions can only be used on the client side');
    throw new Error('Auth functions can only be used on the client side');
  }
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return result
  } catch (error) {
    console.error('Sign in error:', error)
    throw error
  }
}

export const signUp = async (email: string, password: string) => {
  if (!isBrowser) {
    console.error('Auth functions can only be used on the client side');
    throw new Error('Auth functions can only be used on the client side');
  }
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    return result
  } catch (error) {
    console.error('Sign up error:', error)
    throw error
  }
}

export const signOut = async () => {
  if (!isBrowser) {
    console.error('Auth functions can only be used on the client side');
    throw new Error('Auth functions can only be used on the client side');
  }
  
  return fbSignOut(auth)
}