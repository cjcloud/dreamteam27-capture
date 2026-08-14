'use client'

import React, { useState } from 'react'

interface MigrationResult {
  success: boolean
  summary?: {
    totalManagers: number
    alreadyCorrect: number
    migrated: number
    status: string
  }
  error?: string
}

export default function MigratePage() {
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const runMigration = async () => {
    setIsRunning(true)
    setResult(null)

    try {
      const response = await fetch('/api/migrate-managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Manager Data Migration
        </h1>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            This will fix the database inconsistency where some managers have 
            <code className="bg-gray-100 px-1 rounded">manager.players</code> and others have 
            <code className="bg-gray-100 px-1 rounded">manager.teamDetails</code>.
          </p>
          <p className="text-gray-600">
            All managers will be standardized to use <code className="bg-gray-100 px-1 rounded">manager.teamDetails</code>.
          </p>
        </div>

        <button
          onClick={runMigration}
          disabled={isRunning}
          className={`w-full py-2 px-4 rounded-md font-medium ${
            isRunning
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isRunning ? 'Running Migration...' : 'Run Migration'}
        </button>

        {result && (
          <div className={`mt-6 p-4 rounded-md ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <div>
                <h3 className="text-green-800 font-medium mb-2">Migration Complete!</h3>
                {result.summary && (
                  <div className="text-green-700 text-sm space-y-1">
                    <p>Total managers: {result.summary.totalManagers}</p>
                    <p>Already correct: {result.summary.alreadyCorrect}</p>
                    <p>Migrated: {result.summary.migrated}</p>
                    <p className="font-medium">Status: {result.summary.status}</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-red-800 font-medium mb-2">Migration Failed</h3>
                <p className="text-red-700 text-sm">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
