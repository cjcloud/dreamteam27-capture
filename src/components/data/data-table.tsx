'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchData, deleteData } from '@/lib/db'
import { toast } from 'react-toastify'
import { Trash2, RefreshCw, Trophy, Edit, AlertCircle } from 'lucide-react'
import type { Manager } from '@/lib/types'
import Link from 'next/link'
import { ref, get } from 'firebase/database'
import { db } from '@/lib/firebase'
import { DB_PATHS } from '@/lib/constants'
import { dbService } from '@/lib/db-service'

// The table adds a display `name` field (from manager.manager) to each row.
type ManagerRow = Manager & { name: string };

interface ViewData {
  managers: ManagerRow[];
  players: Record<string, unknown>[];
  lastUpdated: string;
}

interface Column {
  header: string;
  accessor: keyof ManagerRow;
}

export default function DataTable() {
  const [data, setData] = useState<ViewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteConfirmation, setDeleteConfirmation] = useState<number | null>(null)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ManagerRow;
    direction: 'asc' | 'desc';
  } | null>(null)

  const columns = useMemo<Column[]>(() => [
    { header: 'Position', accessor: 'posNow' },
    { header: 'Manager', accessor: 'name' },
    { header: 'Total Points', accessor: 'totalPoints' },
    { header: 'Position Change', accessor: 'posLast' },
    { header: 'Actions', accessor: 'managerId' }
  ], [])

  const fetchTableData = async () => {
    try {
      setLoading(true)
      const result = await fetchData()
      
      // Transform Player[] to Record<string, unknown>[]
      const viewData: ViewData = {
        managers: result.managers.map(manager => ({
          ...manager,
          // Ensure name property exists, using manager property as fallback
          name: (manager as { name?: string }).name || manager.manager
        })),
        players: result.players.map(player => {
          const record: Record<string, unknown> = {};
          Object.entries(player).forEach(([key, value]) => {
            record[key] = value;
          });
          return record;
        }),
        lastUpdated: result.lastUpdated
      }
      
      setData(viewData)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to fetch data')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTableData()
  }, [])

  const handleDelete = async (managerId: number | string, managerName: string) => {
    try {
      console.group('Manager Deletion Process')
      console.log(`Starting deletion process for manager: ${managerName} (ID: ${managerId})`)
      
      // Get the entire managers object
      const managersRef = ref(db, DB_PATHS.MANAGER_DATA)
      const snapshot = await get(managersRef)
      
      if (!snapshot.exists()) {
        console.log('No managers data found')
        toast.error('No managers data found')
        console.groupEnd()
        setDeleteConfirmation(null)
        return
      }
      
      // Get the raw managers object
      const managersData = snapshot.val()
      console.log('Managers data:', managersData)
      
      // Find the key where managerId matches
      let managerKey = null
      for (const key in managersData) {
        if (managersData[key] && 
            managersData[key].managerId && 
            managersData[key].managerId.toString() === managerId.toString()) {
          managerKey = key
          break
        }
      }
      
      if (!managerKey) {
        console.log(`No manager found with ID: ${managerId}`)
        toast.error(`Manager "${managerName}" not found`)
        console.groupEnd()
        setDeleteConfirmation(null)
        return
      }
      
      console.log(`Found manager with ID ${managerId} at key: ${managerKey}`)
      
      // Use the API to delete the manager at the correct path
      const deletePath = `${DB_PATHS.MANAGER_DATA}/${managerKey}`
      console.log(`Deleting manager via API at path: ${deletePath}`)
      
      const result = await deleteData(deletePath)
      console.log('Delete operation result:', result)
      
      if (result && result.success) {
        console.log('Manager deletion successful')
        
        // Now clean up the managers array to prevent stale data when recreating a manager
        // Get all managers again after deletion
        const updatedSnapshot = await get(managersRef)
        if (updatedSnapshot.exists()) {
          const updatedManagersData = updatedSnapshot.val()
          
          // Convert to array if needed
          let managersArray = Array.isArray(updatedManagersData) 
            ? [...updatedManagersData] 
            : Object.values(updatedManagersData)
          
          // Filter out any managers with the same name (case insensitive)
          managersArray = managersArray.filter(m => 
            !m || !m.manager || m.manager.toLowerCase() !== managerName.toLowerCase()
          )
          
          // Save the cleaned array back to the database
          console.log('Cleaning up managers array to prevent stale data')
          await dbService.set(DB_PATHS.MANAGER_DATA, managersArray)
          console.log('Cleanup complete')
        }
        
        toast.success(`Manager "${managerName}" deleted successfully`)
        
        // Force a complete data refresh with a longer delay
        console.log('Scheduling data refresh...')
        setTimeout(() => {
          console.log('Forcing data refresh after deletion')
          fetchTableData()
        }, 2000)
      } else {
        console.error('Delete operation failed:', result)
        toast.error('Failed to delete manager')
      }
      
      console.groupEnd()
      setDeleteConfirmation(null)
    } catch (error) {
      console.error('Delete error:', error)
      if (error instanceof Error) {
        toast.error(`Failed to delete manager: ${error.message}`)
      } else {
        toast.error('Failed to delete manager')
      }
      console.groupEnd()
      setDeleteConfirmation(null)
    }
  }

  const handleRefresh = () => {
    fetchTableData()
  }

  const sortedData = useMemo(() => {
    if (!data?.managers || !sortConfig) return data?.managers

    return [...data.managers].sort((a, b) => {
      // Only primitive columns are ever sortable, so treat values as comparable.
      const aValue = a[sortConfig.key] as string | number
      const bValue = b[sortConfig.key] as string | number

      if (aValue === bValue) return 0

      if (sortConfig.direction === 'asc') {
        return aValue < bValue ? -1 : 1
      } else {
        return aValue > bValue ? -1 : 1
      }
    })
  }, [data?.managers, sortConfig])

  const handleSort = (key: keyof ManagerRow) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' }
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' }
      }
      return null
    })
  }

  if (loading) return <div>Loading...</div>
  if (!data) return <div>No data available</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">League Table</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-100 rounded-full"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {sortedData && sortedData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(column => (
                  <th
                    key={column.header}
                    onClick={() => column.accessor !== 'managerId' && handleSort(column.accessor)}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.accessor !== 'managerId' ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {column.header}
                      {sortConfig?.key === column.accessor && (
                        <Trophy className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((manager, index) => (
                <tr 
                  key={`manager-${manager.managerId}-${index}`}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {manager.posNow}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {manager.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {manager.totalPoints}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`${
                      manager.posLast - manager.posNow > 0 
                        ? 'text-green-600' 
                        : manager.posLast - manager.posNow < 0 
                        ? 'text-red-600' 
                        : 'text-gray-600'
                    }`}>
                      {manager.posLast - manager.posNow > 0 ? '↑' : 
                       manager.posLast - manager.posNow < 0 ? '↓' : '−'}
                      {Math.abs(manager.posLast - manager.posNow)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/capture?name=${encodeURIComponent(manager.name)}`}
                        className="p-2 hover:bg-gray-100 rounded-full inline-flex items-center"
                        title="Edit Team Composition"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      
                      {deleteConfirmation === manager.managerId ? (
                        <div className="flex items-center space-x-1 bg-red-50 rounded-md p-1">
                          <span className="text-xs text-red-600">Confirm?</span>
                          <button
                            onClick={() => handleDelete(manager.managerId, manager.name)}
                            className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirmation(null)}
                            className="text-xs bg-gray-200 px-2 py-1 rounded"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmation(manager.managerId)}
                          className="p-2 hover:bg-red-100 rounded-full inline-flex items-center"
                          title="Delete Manager"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>No managers found</div>
      )}
    </div>
  )
}
