import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting player structure rollback to nested playerDetails format...')

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

    let rolledBackCount = 0
    let alreadyNestedCount = 0
    let skippedCount = 0

    // Process each manager
    for (let i = 0; i < managersArray.length; i++) {
      const manager = managersArray[i]
      
      if (!manager || !manager.teamDetails) {
        skippedCount++
        continue
      }

      console.log(`🔍 Processing manager: ${manager.manager} (Index: ${i})`)
      
      let needsRollback = false
      const restoredTeamDetails = manager.teamDetails.map((player: any) => {
        // Check if player has flat structure (needs to be converted back to nested)
        if (!player.playerDetails && player.playerName) {
          needsRollback = true
          // Convert back to nested structure
          return {
            playerDetails: {
              gwpts: player.gameweekPoints || 0,
              gwtotalPts: player.totalPoints || 0,
              playerClub: player.playerClub,
              playerDNP: false,
              playerName: player.playerName,
              playerPosition: player.position,
              playerSuspended: false,
              playerValue: player.price,
              playereliminated: false,
              playerinjured: false
            },
            playerId: player.playerId
          }
        } else {
          // Already nested structure
          return player
        }
      })

      if (needsRollback) {
        console.log(`🔄 Rolling back ${manager.manager} to nested playerDetails structure`)
        
        // Update the manager with nested player structure
        const updatedManager = {
          ...manager,
          teamDetails: restoredTeamDetails
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

        rolledBackCount++
      } else {
        console.log(`✅ Manager ${manager.manager} already has nested playerDetails structure`)
        alreadyNestedCount++
      }
    }

    // Update timestamp in db/2
    const timestamp = Date.now()
    console.log(`📅 Updating timestamp in db/2: ${timestamp}`)
    
    const timestampResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/db`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'set',
        path: '/2',
        data: timestamp
      })
    })

    if (!timestampResponse.ok) {
      console.error('❌ Failed to update timestamp in db/2:', timestampResponse.statusText)
    } else {
      console.log('✅ Timestamp updated successfully in db/2')
    }

    const summary = {
      totalProcessed: managersArray.filter((m: any) => m !== null).length,
      rolledBackCount,
      alreadyNestedCount,
      skippedCount,
      timestamp,
      message: `Rollback completed! ${rolledBackCount} managers restored to nested playerDetails structure, ${alreadyNestedCount} already correct, ${skippedCount} skipped. Timestamp ${timestamp} saved to db/2.`
    }

    console.log('🎉 Rollback summary:', summary)
    return NextResponse.json({ success: true, ...summary })

  } catch (error) {
    console.error('❌ Rollback failed:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
