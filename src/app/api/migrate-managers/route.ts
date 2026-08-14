import { NextRequest, NextResponse } from 'next/server'
import { DB_PATHS } from '@/lib/constants'

// Simple fetch-based database operations to avoid Firebase Admin SDK issues
async function fetchFromDb(path: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'get', path })
  })
  const result = await response.json()
  return result.success ? result.data : null
}

async function updateDb(path: string, data: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'set', path, data })
  })
  const result = await response.json()
  return result.success
}

interface ManagerWithPlayers {
  managerId: string
  manager: string
  teamValue: number
  players: any[]
  timestamp: string
}

interface ManagerWithTeamDetails {
  managerId: string
  manager: string
  teamValue: number
  teamDetails: any[]
  timestamp: string
}

type Manager = ManagerWithPlayers | ManagerWithTeamDetails

function hasPlayersField(manager: Manager): manager is ManagerWithPlayers {
  return 'players' in manager && !('teamDetails' in manager)
}

function hasTeamDetailsField(manager: Manager): manager is ManagerWithTeamDetails {
  return 'teamDetails' in manager
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting manager data structure migration...')
    
    // Read all managers from db/0
    const managersData = await fetchFromDb(DB_PATHS.MANAGERS)
    
    if (!managersData || typeof managersData !== 'object') {
      return NextResponse.json({ 
        success: false, 
        message: 'No managers data found or invalid format' 
      })
    }

    const managers = Object.values(managersData) as Manager[]
    console.log(`📊 Found ${managers.length} managers in database`)

    let migratedCount = 0
    let alreadyCorrectCount = 0
    const updatedManagers: { [key: string]: ManagerWithTeamDetails } = {}

    // Process each manager
    for (const manager of managers) {
      if (hasTeamDetailsField(manager)) {
        // Manager already has correct structure
        console.log(`✅ Manager "${manager.manager}" already has teamDetails field`)
        updatedManagers[manager.managerId] = manager
        alreadyCorrectCount++
      } else if (hasPlayersField(manager)) {
        // Manager needs migration from 'players' to 'teamDetails'
        console.log(`🔧 Migrating manager "${manager.manager}" from players to teamDetails`)
        
        const migratedManager: ManagerWithTeamDetails = {
          managerId: manager.managerId,
          manager: manager.manager,
          teamValue: manager.teamValue,
          teamDetails: manager.players, // Rename players to teamDetails
          timestamp: manager.timestamp
        }
        
        updatedManagers[manager.managerId] = migratedManager
        migratedCount++
      } else {
        // Neither guard matched — narrowed to never; cast for logging only.
        const unknownManager = manager as { manager?: string }
        console.warn(`⚠️ Manager "${unknownManager.manager}" has unexpected structure:`, Object.keys(manager as object))
      }
    }

    // Update the database with migrated data
    if (migratedCount > 0) {
      console.log(`💾 Updating database with ${migratedCount} migrated managers...`)
      const updateSuccess = await updateDb(DB_PATHS.MANAGERS, updatedManagers)
      if (updateSuccess) {
        console.log('✅ Database updated successfully')
      } else {
        throw new Error('Failed to update database')
      }
    }

    // Return summary
    return NextResponse.json({
      success: true,
      summary: {
        totalManagers: managers.length,
        alreadyCorrect: alreadyCorrectCount,
        migrated: migratedCount,
        status: migratedCount > 0 ? 'COMPLETED' : 'NO ACTION NEEDED'
      }
    })

  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
