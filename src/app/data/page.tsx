import { Metadata } from 'next'
import DataTable from '@/components/data/data-table'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'View Data - DreamTeam27 Capture',
  description: 'View and manage uploaded data',
}

export default function DataPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">View Data</h1>
          <Link
            href="/upload"
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Upload Data
          </Link>
        </div>
        <div className="bg-white shadow-lg rounded-lg p-6">
          <DataTable />
        </div>
      </div>
    </main>
  )
}
