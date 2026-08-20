import { ref, get, set, update as firebaseUpdate, remove } from 'firebase/database'
import { db } from './firebase'
import { dbService } from './db-service'
import type { Player, Manager } from './types'

export interface DatabaseData {
  managers: Manager[];
  players: Player[];
  lastUpdated: string;
}

export const PLAYER_DATA_PATH = '/1/playerData'
export const MANAGER_DATA_PATH = '/0'
export const LAST_UPDATED_PATH = '/2/0'

export const uploadPlayerData = async (players: Player[]): Promise<void> => {
  try {
    // Use API service for write operations. dbService.set() never throws on
    // its own -- it swallows the error, shows its own toast, and returns
    // {success:false}. Check that explicitly, or a rejected write (e.g. a
    // 401 from /api/db's auth gate) looks identical to a real one and this
    // function returns as if the upload succeeded when it silently did not.
    const result = await dbService.set(PLAYER_DATA_PATH, players)
    if (!result?.success) {
      throw new Error(result?.error || 'Player data write was rejected')
    }

    const managerSnapshot = await get(ref(db, MANAGER_DATA_PATH))
    if (!managerSnapshot.exists()) {
      const initialManagers = createInitialManagerData()
      const managersResult = await dbService.set(MANAGER_DATA_PATH, initialManagers)
      if (!managersResult?.success) {
        throw new Error(managersResult?.error || 'Initial manager data write was rejected')
      }
    }

    await updateLastUpdated(new Date())
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload player data: ${error.message}`)
    }
    throw new Error('Failed to upload player data')
  }
}

const createInitialManagerData = (): Manager[] => {
  const sampleManagers: Manager[] = [
    { 
      managerId: 23, 
      manager: 'Clive', 
      players: [], 
      totalPoints: 0, 
      gameWeekPoints: 0, 
      posNow: 1, 
      posLast: 1, 
      teamDetails: [] 
    },
    { 
      managerId: 24, 
      manager: 'John', 
      players: [], 
      totalPoints: 0, 
      gameWeekPoints: 0, 
      posNow: 2, 
      posLast: 2, 
      teamDetails: [] 
    },
    { 
      managerId: 25, 
      manager: 'Sarah', 
      players: [], 
      totalPoints: 0, 
      gameWeekPoints: 0, 
      posNow: 3, 
      posLast: 3, 
      teamDetails: [] 
    }
  ]
  return sampleManagers
}

export const updateLastUpdated = async (date: Date): Promise<void> => {
  try {
    // Use API service for write operations
    const result = await dbService.set(LAST_UPDATED_PATH, date.toISOString())
    if (!result?.success) {
      throw new Error(result?.error || 'Last-updated timestamp write was rejected')
    }
    console.log('Last updated timestamp saved:', date.toISOString())
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update last updated timestamp: ${error.message}`)
    }
    throw new Error('Failed to update last updated timestamp')
  }
}

export const updateManagerPoints = async (managers: Manager[]): Promise<void> => {
  try {
    const updates: Record<string, Manager> = {}
    managers.forEach(manager => {
      updates[`${MANAGER_DATA_PATH}/${manager.managerId}`] = manager
    })
    // Use API service for write operations
    const result = await dbService.update('', updates)
    if (!result?.success) {
      throw new Error(result?.error || 'Manager points write was rejected')
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update manager points: ${error.message}`)
    }
    throw new Error('Failed to update manager points')
  }
}

export const checkPlayersExist = async (): Promise<boolean> => {
  try {
    // Read operations can use regular db
    const playersRef = ref(db, PLAYER_DATA_PATH)
    const snapshot = await get(playersRef)
    return snapshot.exists()
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to check player data existence: ${error.message}`)
    }
    throw new Error('Failed to check player data existence')
  }
}

export const getPlayers = async (): Promise<Player[]> => {
  try {
    // Read operations can use regular db
    const playersRef = ref(db, PLAYER_DATA_PATH)
    const snapshot = await get(playersRef)
    if (!snapshot.exists()) {
      return []
    }
    return snapshot.val() as Player[]
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch player data: ${error.message}`)
    }
    throw new Error('Failed to fetch player data')
  }
}

export const deletePlayers = async (): Promise<void> => {
  try {
    // Use API service for write operations
    const result = await dbService.set(PLAYER_DATA_PATH, null)
    if (!result?.success) {
      throw new Error(result?.error || 'Player data delete was rejected')
    }
    return
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete player data: ${error.message}`)
    }
    throw new Error('Failed to delete player data')
  }
}

export const fetchManagerData = async (): Promise<Manager[]> => {
  try {
    // Read operations can use regular db
    const snapshot = await get(ref(db, MANAGER_DATA_PATH))
    if (!snapshot.exists()) return []
    
    const managers = Object.values(snapshot.val()) as Manager[]
    return managers.map(manager => ({
      ...manager,
      teamDetails: manager.teamDetails || []
    }))
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch manager data: ${error.message}`)
    }
    throw new Error('Failed to fetch manager data')
  }
}

export const deleteManagerData = async (): Promise<void> => {
  try {
    // Use API service for write operations
    const result = await dbService.set(MANAGER_DATA_PATH, null)
    if (!result?.success) {
      throw new Error(result?.error || 'Manager data delete was rejected')
    }
    console.log('Manager data deleted successfully')
    return
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete manager data: ${error.message}`)
    }
    throw new Error('Failed to delete manager data')
  }
}

export const fetchData = async (): Promise<DatabaseData> => {
  try {
    // Read operations can use regular db
    const [managerSnapshot, playerSnapshot, lastUpdatedSnapshot] = await Promise.all([
      get(ref(db, MANAGER_DATA_PATH)),
      get(ref(db, PLAYER_DATA_PATH)),
      get(ref(db, LAST_UPDATED_PATH))
    ])

    const managers = managerSnapshot.exists()
      ? (Object.values(managerSnapshot.val()) as Manager[])
        .map(manager => ({
          ...manager,
          teamDetails: manager.teamDetails || []
        }))
      : []

    const players = playerSnapshot.exists()
      ? playerSnapshot.val() as Player[]
      : []

    const lastUpdated = lastUpdatedSnapshot.exists()
      ? lastUpdatedSnapshot.val() as string
      : 'No updates yet'

    return { managers, players, lastUpdated }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch data: ${error.message}`)
    }
    throw new Error('Failed to fetch data')
  }
}

export const deleteData = async (path: string): Promise<any> => {
  try {
    console.group(`[db.ts] Delete Operation for path: ${path}`)
    
    // Ensure path is correctly formatted
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
    
    // Log the actual path being used
    console.log(`[db.ts] Formatted path for deletion: ${path}`)
    
    // First, check if the data exists
    console.log(`[db.ts] Checking if data exists at path: ${path}`)
    try {
      const checkData = await dbService.get(path)
      if (!checkData) {
        console.log(`[db.ts] No data found at path: ${path}`)
      } else {
        console.log(`[db.ts] Data found at path: ${path}`, checkData)
      }
    } catch (checkError) {
      console.warn(`[db.ts] Error checking data existence:`, checkError)
    }
    
    // Use API service for write operations
    console.log(`[db.ts] Calling dbService.remove with path: ${path}`)
    const result = await dbService.remove(path)
    console.log(`[db.ts] Delete operation result:`, result)
    
    // Verify deletion was successful
    console.log(`[db.ts] Verifying deletion at path: ${path}`)
    try {
      const verifyData = await dbService.get(path)
      if (!verifyData) {
        console.log(`[db.ts] Verification successful - data no longer exists at path: ${path}`)
      } else {
        console.warn(`[db.ts] Verification failed - data still exists at path: ${path}`, verifyData)
      }
    } catch (verifyError) {
      console.warn(`[db.ts] Error during verification:`, verifyError)
    }
    
    if (!result || !result.success) {
      console.error(`[db.ts] Delete operation failed:`, result)
      throw new Error(result?.error || 'Delete operation failed')
    }
    
    console.groupEnd()
    return result
  } catch (error) {
    console.error(`[db.ts] Failed to delete data at ${path}:`, error)
    console.groupEnd()
    if (error instanceof Error) {
      throw new Error(`Failed to delete data: ${error.message}`)
    }
    throw new Error('Failed to delete data')
  }
}

export const checkDataExists = async (path: string): Promise<boolean> => {
  try {
    // Read operations can use regular db
    const snapshot = await get(ref(db, path))
    return snapshot.exists()
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to check data existence: ${error.message}`)
    }
    throw new Error('Failed to check data existence')
  }
}

export const uploadJsonData = async (path: string, data: Record<string, unknown> | any[]): Promise<void> => {
  try {
    // Use API service for write operations. See uploadPlayerData() above for
    // why the success flag has to be checked explicitly -- dbService.set()
    // does not throw on a rejected write (e.g. a 401 from /api/db because
    // the caller wasn't actually logged in), so without this check a failed
    // upload reports "Data uploaded successfully" while writing nothing.
    const result = await dbService.set(path, data)
    if (!result?.success) {
      throw new Error(result?.error || `Write to ${path} was rejected`)
    }
    console.log('Data uploaded successfully')
    return
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload data: ${error.message}`)
    }
    throw new Error('Failed to upload data')
  }
}
