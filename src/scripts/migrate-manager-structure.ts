/**
 * Database Migration Script: Fix Manager Data Structure
 * 
 * Problem: Some managers have 'players' field, others have 'teamDetails' field
 * Solution: Standardize all managers to use 'teamDetails' field
 */

import { dbService } from '../lib/db-service'
import { DB_PATHS } from '../lib/constants'

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

export async function migrateManagerStructure(): Promise<void> {
  console.log('🔄 Starting manager data structure migration...')
  
  try {
    // Read all managers from db/0
    console.log('📖 Reading managers from database...')
    const managersData = await dbService.get(DB_PATHS.MANAGERS)
    
    if (!managersData || typeof managersData !== 'object') {
      console.log('❌ No managers data found or invalid format')
      return
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
        const unknownManager = manager as Manager
        console.warn(`⚠️ Manager "${unknownManager.manager}" has unexpected structure:`, Object.keys(unknownManager))
      }
    }

    // Update the database with migrated data
    if (migratedCount > 0) {
      console.log(`💾 Updating database with ${migratedCount} migrated managers...`)
      await dbService.set(DB_PATHS.MANAGERS, updatedManagers)
      console.log('✅ Database updated successfully')
    }

    // Summary
    console.log('\n📋 Migration Summary:')
    console.log(`   • Total managers: ${managers.length}`)
    console.log(`   • Already correct: ${alreadyCorrectCount}`)
    console.log(`   • Migrated: ${migratedCount}`)
    console.log(`   • Status: ${migratedCount > 0 ? 'COMPLETED' : 'NO ACTION NEEDED'}`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateManagerStructure()
    .then(() => {
      console.log('🎉 Migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error)
      process.exit(1)
    })
}
