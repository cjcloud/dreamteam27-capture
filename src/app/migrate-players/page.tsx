'use client'

import React, { useState } from 'react'

export default function MigratePlayersPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const runMigration = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/migrate-player-structure', {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Migrate Player Data Structure
        </h1>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            This migration will standardize all player objects in manager teams to use a flat structure instead of nested playerDetails.
          </p>
          <p className="text-sm text-gray-500">
            <strong>Before:</strong> <code>{`{playerDetails: {playerName: "M. Sels"}, playerId: 85633}`}</code>
          </p>
          <p className="text-sm text-gray-500 mb-4">
            <strong>After:</strong> <code>{`{playerName: "M. Sels", playerId: 85633, ...}`}</code>
          </p>
        </div>
        
        <button
          onClick={runMigration}
          disabled={loading}
          className={`py-2 px-4 rounded-md font-medium ${
            loading
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? 'Running Migration...' : 'Run Player Structure Migration'}
        </button>

        {result && (
          <div className={`mt-6 p-4 rounded-md ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className={`text-lg font-medium ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? '✅ Migration Completed' : '❌ Migration Failed'}
            </h3>
            
            {result.success ? (
              <div className="mt-2 text-sm text-green-700">
                <p className="font-medium">{result.message}</p>
                <div className="mt-2 space-y-1">
                  <p>• Total managers processed: {result.totalProcessed}</p>
                  <p>• Migrated to flat structure: {result.migratedCount}</p>
                  <p>• Already correct: {result.alreadyFlatCount}</p>
                  <p>• Skipped (null/no team): {result.skippedCount}</p>
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
