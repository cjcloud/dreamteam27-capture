'use client'

import React, { useState, useEffect } from 'react'
import { dbService } from '@/lib/db-service'
import { DB_PATHS } from '@/lib/constants'

export default function DebugManagersPage() {
  const [managers, setManagers] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchManagers = async () => {
    setLoading(true)
    try {
      const data = await dbService.get(DB_PATHS.MANAGERS)
      setManagers(data)
      console.log('Raw managers data:', data)
    } catch (error) {
      console.error('Error fetching managers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchManagers()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Debug Manager Data Structure
        </h1>
        
        <button
          onClick={fetchManagers}
          disabled={loading}
          className={`mb-6 py-2 px-4 rounded-md font-medium ${
            loading
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>

        {managers && (
          <div className="space-y-6">
            <div className="text-sm text-gray-600">
              Found {Array.isArray(managers) ? managers.filter(m => m !== null).length : Object.keys(managers).length} managers
            </div>
            
            {Array.isArray(managers) ? 
              managers.map((manager: any, index: number) => {
                if (!manager) return null;
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">
                      {manager.manager} (Index: {index})
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Manager ID:</strong> {manager.managerId || 'N/A'}
                      </div>
                      <div>
                        <strong>Team Value:</strong> {manager.teamValue}
                      </div>
                      <div>
                        <strong>Timestamp:</strong> {manager.timestamp}
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <strong>Data Structure:</strong>
                      <div className="text-xs text-gray-600 mb-2">
                        Fields: {Object.keys(manager).join(', ')}
                      </div>
                      
                      {manager.teamDetails && (
                        <div className="mt-2">
                          <strong>Team Details ({manager.teamDetails.length} players):</strong>
                          <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
                            {manager.teamDetails.slice(0, 3).map((player: any, playerIndex: number) => (
                              <div key={playerIndex} className="mb-2 p-2 bg-white rounded">
                                <div><strong>Player {playerIndex + 1}:</strong></div>
                                <pre className="text-xs">{JSON.stringify(player, null, 2)}</pre>
                              </div>
                            ))}
                            {manager.teamDetails.length > 3 && (
                              <div className="text-gray-500">... and {manager.teamDetails.length - 3} more players</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {manager.players && (
                        <div className="mt-2">
                          <strong>Players ({manager.players.length} players):</strong>
                          <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
                            {manager.players.slice(0, 3).map((player: any, playerIndex: number) => (
                              <div key={playerIndex} className="mb-2 p-2 bg-white rounded">
                                <div><strong>Player {playerIndex + 1}:</strong></div>
                                <pre className="text-xs">{JSON.stringify(player, null, 2)}</pre>
                              </div>
                            ))}
                            {manager.players.length > 3 && (
                              <div className="text-gray-500">... and {manager.players.length - 3} more players</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }).filter(Boolean)
            :
              Object.entries(managers).map(([managerId, manager]: [string, any]) => (
              <div key={managerId} className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">
                  {manager.manager} (ID: {managerId})
                </h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Team Value:</strong> {manager.teamValue}
                  </div>
                  <div>
                    <strong>Timestamp:</strong> {manager.timestamp}
                  </div>
                </div>
                
                <div className="mt-4">
                  <strong>Data Structure:</strong>
                  <div className="text-xs text-gray-600 mb-2">
                    Fields: {Object.keys(manager).join(', ')}
                  </div>
                  
                  {manager.teamDetails && (
                    <div className="mt-2">
                      <strong>Team Details ({manager.teamDetails.length} players):</strong>
                      <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
                        {manager.teamDetails.slice(0, 3).map((player: any, index: number) => (
                          <div key={index} className="mb-2 p-2 bg-white rounded">
                            <div><strong>Player {index + 1}:</strong></div>
                            <pre className="text-xs">{JSON.stringify(player, null, 2)}</pre>
                          </div>
                        ))}
                        {manager.teamDetails.length > 3 && (
                          <div className="text-gray-500">... and {manager.teamDetails.length - 3} more players</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {manager.players && (
                    <div className="mt-2">
                      <strong>Players ({manager.players.length} players):</strong>
                      <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
                        {manager.players.slice(0, 3).map((player: any, index: number) => (
                          <div key={index} className="mb-2 p-2 bg-white rounded">
                            <div><strong>Player {index + 1}:</strong></div>
                            <pre className="text-xs">{JSON.stringify(player, null, 2)}</pre>
                          </div>
                        ))}
                        {manager.players.length > 3 && (
                          <div className="text-gray-500">... and {manager.players.length - 3} more players</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
