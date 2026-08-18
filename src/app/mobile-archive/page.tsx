'use client'

import { useCallback, useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { toast } from 'react-toastify'
import { Shield, RefreshCw, Archive, Clock } from 'lucide-react'
import { MOBILE_ARCHIVE_AVAILABLE_FROM_ISO, isMobileArchiveAvailable } from '@/lib/constants'

type ArchiveEntry = {
  manager: string
  mobile: string
  managerId?: string | null
  archivedAt: string
  archivedBy: string
}

type ArchiveResult = {
  archived: number
  sanitised: number
  managers?: string[]
  message?: string
}

// Admin-only page for the "Archive & sanitise manager mobile numbers" action.
// Background: dreamteam27-manager collects mobile numbers for self-service
// team identity, but the shared database's read rules can't restrict a
// single field (rules cascade and can't be revoked at a deeper path once a
// shallower one grants access — see dreamteam27-manager's
// docs/SPEC-manager-app.md §11). Per the agreed plan, once
// dreamteam27-manager retires at the season's edit cutoff, mobile numbers no
// longer serve any purpose and are collated here into a restricted archive
// (readable only by an authenticated capture admin) before being wiped from
// the live manager records. Both the collate and the read are gated behind
// a verified Firebase ID token server-side (see /api/manager-mobile-archive),
// not just this page's own AuthGuard, since API routes aren't covered by
// that guard.
//
// This is a manually-initiated process — nothing here runs automatically.
// It should only be run once dreamteam27-manager has retired for the
// season (per the plan recorded in dreamteam27-manager's spec).
export default function MobileArchivePage() {
  const [archive, setArchive] = useState<Record<string, ArchiveEntry>>({})
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [lastResult, setLastResult] = useState<ArchiveResult | null>(null)
  // Mirrors the client-side pattern dreamteam27-manager uses for its own
  // registration/edit cutoff: seed from the current time, then re-check
  // periodically so the page flips over on its own once the deadline
  // passes, without needing a reload.
  const [archiveAvailable, setArchiveAvailable] = useState(() => isMobileArchiveAvailable())

  useEffect(() => {
    const id = setInterval(() => setArchiveAvailable(isMobileArchiveAvailable()), 30_000)
    return () => clearInterval(id)
  }, [])

  const authedFetch = useCallback(async (input: RequestInfo, init: RequestInit = {}) => {
    const user = auth.currentUser
    if (!user) {
      throw new Error('You must be signed in to do this.')
    }
    const token = await user.getIdToken()
    return fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
  }, [])

  const loadArchive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch('/api/manager-mobile-archive')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load archive.')
      }
      setArchive(data.archive || {})
    } catch (error) {
      console.error('Failed to load mobile archive:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load archive.')
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  useEffect(() => {
    loadArchive()
  }, [loadArchive])

  const handleArchiveAndSanitise = async () => {
    if (!archiveAvailable) return

    const confirmed = window.confirm(
      'This will collate every real mobile number currently stored against a manager into the secure archive, ' +
        'then overwrite those mobile numbers with "ADMIN" in the live manager records. ' +
        'This should only be done once dreamteam27-manager has retired for the season. Continue?'
    )
    if (!confirmed) return

    setWorking(true)
    try {
      const res = await authedFetch('/api/manager-mobile-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Archive & sanitise failed.')
      }
      setLastResult(data)
      if (data.archived > 0) {
        toast.success(`Archived and sanitised ${data.archived} mobile number(s).`)
      } else {
        toast.info(data.message || 'No real mobile numbers found to archive.')
      }
      await loadArchive()
    } catch (error) {
      console.error('Archive & sanitise failed:', error)
      toast.error(error instanceof Error ? error.message : 'Archive & sanitise failed.')
    } finally {
      setWorking(false)
    }
  }

  const entries = Object.entries(archive).sort(([a], [b]) => Number(a) - Number(b))

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-6 h-6 text-[#B9203C]" />
        <h1 className="text-2xl font-bold">Mobile Number Archive</h1>
      </div>
      <p className="text-gray-600 mb-6">
        Restricted, admin-only record of manager mobile numbers. Use &quot;Archive &amp; sanitise&quot; to collate every
        real mobile number currently in the live manager data into this archive, then replace it with{' '}
        <code className="bg-gray-100 px-1 rounded">ADMIN</code> in the live records. This is a manually-initiated,
        one-way action, disabled until dreamteam27-manager retires for the season.
      </p>

      {!archiveAvailable && (
        <div className="flex items-start gap-2 mb-6 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            Archive &amp; sanitise is disabled until dreamteam27-manager retires on{' '}
            <strong>Friday 21 August 2026, 19:59 (UK time)</strong> — mobile numbers are still live and changing
            until then, so this action can&apos;t run yet. The button below will become active automatically once
            the deadline passes.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={loadArchive}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={handleArchiveAndSanitise}
          disabled={working || !archiveAvailable}
          title={!archiveAvailable ? `Available from ${MOBILE_ARCHIVE_AVAILABLE_FROM_ISO}` : undefined}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#B9203C] text-white hover:bg-[#9c1a32] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#B9203C]"
        >
          <Archive className="w-4 h-4" />
          {working ? 'Archiving…' : 'Archive & sanitise'}
        </button>
      </div>

      {lastResult && (
        <div className="mb-6 p-3 rounded-md bg-gray-50 border border-gray-200 text-sm">
          <p>
            Last run: archived {lastResult.archived}, sanitised {lastResult.sanitised}.
          </p>
          {lastResult.managers && lastResult.managers.length > 0 && (
            <p className="text-gray-600 mt-1">{lastResult.managers.join(', ')}</p>
          )}
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">Manager</th>
              <th className="text-left px-3 py-2">Mobile</th>
              <th className="text-left px-3 py-2">Archived</th>
              <th className="text-left px-3 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  Archive is empty.
                </td>
              </tr>
            ) : (
              entries.map(([index, entry]) => (
                <tr key={index} className="border-t">
                  <td className="px-3 py-2">{entry.manager}</td>
                  <td className="px-3 py-2">{entry.mobile}</td>
                  <td className="px-3 py-2 text-gray-500">{new Date(entry.archivedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-500">{entry.archivedBy}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
