'use client'

import React, { useState } from 'react'

export default function RollbackPlayersPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const runRollback = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/rollback-player-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-red-600 mb-6">
          🔄 URGENT: Rollback Player Data Structure
        </h1>
        
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-medium mb-2">
            This will restore the original nested playerDetails structure as specified in the project requirements.
          </p>
          <p className="text-sm text-red-600 mb-2">
            <strong>Restoring to:</strong> <code>{`{playerDetails: {playerName: "M. Sels", ...}, playerId: 85633}`}</code>
          </p>
          <p className="text-sm text-red-600">
            <strong>From current:</strong> <code>{`{playerName: "M. Sels", playerId: 85633, ...}`}</code>
          </p>
        </div>
        
        <button
          onClick={runRollback}
          disabled={loading}
          className={`py-3 px-6 rounded-md font-medium ${
            loading
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {loading ? 'Rolling Back...' : 'ROLLBACK TO ORIGINAL STRUCTURE'}
        </button>

        {result && (
          <div className={`mt-6 p-4 rounded-md ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className={`text-lg font-medium ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? '✅ Rollback Completed' : '❌ Rollback Failed'}
            </h3>
            
            {result.success ? (
              <div className="mt-2 text-sm text-green-700">
                <p className="font-medium">{result.message}</p>
                <div className="mt-2 space-y-1">
                  <p>• Total managers processed: {result.totalProcessed}</p>
                  <p>• Rolled back to nested structure: {result.rolledBackCount}</p>
                  <p>• Already correct: {result.alreadyNestedCount}</p>
                  <p>• Skipped (null/no team): {result.skippedCount}</p>
                  <p>• Timestamp saved to db/2: {result.timestamp}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-red-700">
                Error: {result.error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
