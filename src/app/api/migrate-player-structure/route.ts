import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting player structure migration...')

    // Fetch all managers from the database
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/db`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'get',
        path: '/0'
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch managers: ${response.statusText}`)
    }

    const managers = await response.json()
    
    if (!managers.success || !managers.data) {
      throw new Error('No manager data found')
    }

    const managersArray = managers.data
    console.log(`📊 Found ${managersArray.length} total entries (including nulls)`)

    let migratedCount = 0
    let alreadyFlatCount = 0
    let skippedCount = 0

    // Process each manager
    for (let i = 0; i < managersArray.length; i++) {
      const manager = managersArray[i]
      
      if (!manager || !manager.teamDetails) {
        skippedCount++
        continue
      }

      console.log(`🔍 Processing manager: ${manager.manager} (Index: ${i})`)
      
      let needsMigration = false
      const migratedTeamDetails = manager.teamDetails.map((player: any) => {
        // Check if player has nested playerDetails structure
        if (player.playerDetails) {
          needsMigration = true
          // Flatten the structure
          return {
            gameweekPoints: player.playerDetails.gwpts || 0,
            playerClub: player.playerDetails.playerClub,
            playerId: player.playerId,
            playerName: player.playerDetails.playerName,
            position: player.playerDetails.playerPosition,
            price: player.playerDetails.playerValue,
            totalPoints: player.playerDetails.gwtotalPts || 0
          }
        } else {
          // Already flat structure
          return player
        }
      })

      if (needsMigration) {
        console.log(`🔧 Migrating ${manager.manager} from nested to flat structure`)
        
        // Update the manager with flattened player structure
        const updatedManager = {
          ...manager,
          teamDetails: migratedTeamDetails
        }

        // Save back to database
        const updateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/db`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'set',
            path: `/0/${i}`,
            data: updatedManager
          })
        })

        if (!updateResponse.ok) {
          console.error(`❌ Failed to update manager ${manager.manager}:`, updateResponse.statusText)
          continue
        }

        migratedCount++
      } else {
        console.log(`✅ Manager ${manager.manager} already has flat structure`)
        alreadyFlatCount++
      }
    }

    const summary = {
      totalProcessed: managersArray.filter((m: any) => m !== null).length,
      migratedCount,
      alreadyFlatCount,
      skippedCount,
      message: `Migration completed! ${migratedCount} managers migrated to flat player structure, ${alreadyFlatCount} already correct, ${skippedCount} skipped.`
    }

    console.log('🎉 Migration summary:', summary)
    return NextResponse.json({ success: true, ...summary })

  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
