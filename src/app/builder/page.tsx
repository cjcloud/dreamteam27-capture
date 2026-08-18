'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { dbService } from '@/lib/db-service'
import {
  DB_PATHS,
  EUROPEAN_CLUBS,
  EUROPEAN_CLUBS_PATH,
  SCORE_FACTORS,
  ALLOWED_FORMATIONS,
  APP_CONSTANTS,
} from '@/lib/constants'
import ClubShirt from '@/components/ClubShirt'

type Pos = 'GK' | 'DEF' | 'MID' | 'STR'
const POSITIONS: Pos[] = ['GK', 'DEF', 'MID', 'STR']
const POSITION_MAX: Record<string, number> = { GK: 1, DEF: 5, MID: 5, STR: 3 }
const POSITION_LABEL: Record<string, string> = {
  GK: 'goalkeeper',
  DEF: 'defenders',
  MID: 'midfielders',
  STR: 'strikers',
}
// Explicit classes (Tailwind can't generate dynamic `text-${align}`).
const ALIGN: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}
const REFERENCE_SEASON = '2025/26'

// --- Optimiser (exact grouped-knapsack over a discretised budget) ---
type Cand = { id: string; units: number; pts: number }
type Pick = { pts: number; ids: string[] }

// Best selection of EXACTLY k players from a group, for every budget b (0..B),
// maximising points. Returned as a prefix-max (best achievable with budget <= b).
function chooseExactK(players: Cand[], k: number, B: number): Pick[] {
  const NEG = Number.NEGATIVE_INFINITY
  const dp: Pick[][] = Array.from({ length: k + 1 }, () =>
    Array.from({ length: B + 1 }, () => ({ pts: NEG, ids: [] as string[] }))
  )
  for (let b = 0; b <= B; b++) dp[0][b] = { pts: 0, ids: [] }
  for (const pl of players) {
    for (let j = k; j >= 1; j--) {
      for (let b = B; b >= pl.units; b--) {
        const prev = dp[j - 1][b - pl.units]
        if (prev.pts !== NEG && prev.pts + pl.pts > dp[j][b].pts) {
          dp[j][b] = { pts: prev.pts + pl.pts, ids: [...prev.ids, pl.id] }
        }
      }
    }
  }
  const out: Pick[] = new Array(B + 1)
  let best: Pick = { pts: NEG, ids: [] }
  for (let b = 0; b <= B; b++) {
    if (dp[k][b].pts > best.pts) best = dp[k][b]
    out[b] = best
  }
  return out
}

// Max-plus convolution: best combined pick across two groups within budget b.
function combine(a: Pick[], b: Pick[], B: number): Pick[] {
  const NEG = Number.NEGATIVE_INFINITY
  const out: Pick[] = new Array(B + 1)
  for (let t = 0; t <= B; t++) {
    let bestPts = NEG
    let bestIds: string[] = []
    for (let s = 0; s <= t; s++) {
      const A = a[s]
      const Bv = b[t - s]
      if (A.pts !== NEG && Bv.pts !== NEG && A.pts + Bv.pts > bestPts) {
        bestPts = A.pts + Bv.pts
        bestIds = [...A.ids, ...Bv.ids]
      }
    }
    out[t] = { pts: bestPts, ids: bestIds }
  }
  return out
}

interface RawPlayer {
  id: string | number
  displayName?: string
  name?: string
  playerClub?: string
  position?: string
  price?: number
  totalPoints?: number
}
interface SquadPlayer {
  id: string
  name: string
  club: string
  position: Pos
  priceM: number
}

// Seeded prices are in micro-units (e.g. 2_000_000); live data is un-scaled (2.0).
const toMillions = (price?: number): number => {
  const raw = Number(price) || 0
  return raw > 1000 ? raw / 1_000_000 : raw
}

export default function BuilderPage() {
  const [players, setPlayers] = useState<RawPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [activePos, setActivePos] = useState<Pos>('DEF')
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(SCORE_FACTORS.map((f) => [f.key, f.defaultWeight]))
  )
  const [starter, setStarter] = useState<Record<string, number>>({}) // id -> 1..5
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'score',
    dir: 'desc',
  })
  const [squad, setSquad] = useState<SquadPlayer[]>([])
  const [managerName, setManagerName] = useState('')
  const [saving, setSaving] = useState(false)
  const [europe, setEurope] = useState<Set<string>>(new Set(EUROPEAN_CLUBS))
  const [showEuropeConfig, setShowEuropeConfig] = useState(false)
  const [savingEurope, setSavingEurope] = useState(false)
  const [lastSeason, setLastSeason] = useState<Record<string, number>>({})
  const [capturingSnapshot, setCapturingSnapshot] = useState(false)
  const [europeOnly, setEuropeOnly] = useState(false)
  // Provenance + saved-state of the European-clubs selection, so it is always
  // observable: where the active list came from, and whether there are edits
  // not yet written to the database.
  const [europeSource, setEuropeSource] = useState<'database' | 'browser' | 'default'>('default')
  const [europeDirty, setEuropeDirty] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const data = await dbService.get(DB_PATHS.PLAYER_DATA)
      const arr = Array.isArray(data) ? data : data ? Object.values(data) : []
      setPlayers((arr as RawPlayer[]).filter(Boolean))

      // European-clubs selection: database, then browser, then the default seed.
      // Track WHERE it came from so the active list is always observable.
      let list: string[] | null = null
      let source: 'database' | 'browser' | 'default' = 'default'
      try {
        const cfg = await dbService.get(EUROPEAN_CLUBS_PATH)
        if (Array.isArray(cfg)) {
          list = cfg as string[]
          source = 'database'
        }
      } catch {
        /* ignore */
      }
      if (!list) {
        try {
          const ls = localStorage.getItem('europeanClubs')
          if (ls) {
            list = JSON.parse(ls)
            source = 'browser'
          }
        } catch {
          /* ignore */
        }
      }
      const finalList = list ?? EUROPEAN_CLUBS
      setEurope(new Set(finalList))
      setEuropeSource(source)
      setEuropeDirty(false)
      // Traceability: the authoritative optimiser input, logged on every load.
      console.log(
        `[builder] European clubs (optimiser pool) loaded from ${source} — ${finalList.length} clubs:`,
        finalList
      )

      // Last-season points from the frozen 2025/26 reference (name -> total points).
      try {
        const ref = await dbService.get(DB_PATHS.REFERENCE_PLAYERS)
        const refArr = Array.isArray(ref) ? ref : ref ? Object.values(ref) : []
        if (refArr.length) {
          const map: Record<string, number> = {}
          ;(refArr as RawPlayer[]).forEach((p) => {
            const name = p?.displayName || p?.name
            if (name) map[name] = Number(p.totalPoints) || 0
          })
          setLastSeason(map)
        }
      } catch {
        /* ignore */
      }

      setLoading(false)
    })()
  }, [])

  // One-time per season: freeze the current pool as the read-only 2025/26
  // reference, BEFORE refreshing the pool with the new season's (0-point) data.
  const captureLastSeason = async () => {
    // Confirm before overwriting an already-frozen reference.
    if (Object.keys(lastSeason).length > 0) {
      const ok = window.confirm(
        `Are you sure? The ${REFERENCE_SEASON} reference is already frozen. ` +
          `Freezing again will overwrite it with the current pool — only do this while ` +
          `the pool still holds last season's data.`
      )
      if (!ok) return
    }

    setCapturingSnapshot(true)
    try {
      const pool = await dbService.get(DB_PATHS.PLAYER_DATA)
      const arr = Array.isArray(pool) ? pool : pool ? Object.values(pool) : []
      // Freeze the FULL records as the reference.
      await dbService.set(DB_PATHS.REFERENCE_PLAYERS, arr)
      // Derive the name -> points lookup the table uses.
      const map: Record<string, number> = {}
      ;(arr as RawPlayer[]).forEach((p) => {
        const name = p?.displayName || p?.name
        if (name) map[name] = Number(p.totalPoints) || 0
      })
      setLastSeason(map)
      toast.success(`Froze last-season reference for ${arr.length} players.`)
    } catch (e) {
      console.error('Reference freeze failed:', e)
      toast.error('Could not freeze reference (database write needs the service-account key).')
    } finally {
      setCapturingSnapshot(false)
    }
  }

  // All clubs present in the pool (auto-adapts each season).
  const allClubs = useMemo(
    () =>
      Array.from(new Set(players.map((p) => p.playerClub).filter(Boolean) as string[])).sort(),
    [players]
  )

  const toggleClub = (club: string) => {
    setEuropeDirty(true) // edited but not yet written to the database
    setEurope((prev) => {
      const next = new Set(prev)
      if (next.has(club)) next.delete(club)
      else next.add(club)
      try {
        localStorage.setItem('europeanClubs', JSON.stringify(Array.from(next)))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const saveEurope = async () => {
    setSavingEurope(true)
    try {
      await dbService.set(EUROPEAN_CLUBS_PATH, Array.from(europe))
      setEuropeSource('database')
      setEuropeDirty(false)
      toast.success(`European clubs saved for the season (${europe.size} clubs).`)
    } catch (e) {
      console.error('Europe save failed:', e)
      toast.error('Saved in this browser, but the database write failed (needs the service-account key).')
    } finally {
      setSavingEurope(false)
    }
  }

  const totalWeight = useMemo(
    () => Object.values(weights).reduce((a, b) => a + b, 0) || 1,
    [weights]
  )

  const inSquad = (id: string) => squad.some((s) => s.id === id)
  const squadCounts = useMemo(
    () =>
      squad.reduce(
        (c, s) => {
          c[s.position] = (c[s.position] || 0) + 1
          return c
        },
        { GK: 0, DEF: 0, MID: 0, STR: 0 } as Record<string, number>
      ),
    [squad]
  )
  const squadValue = useMemo(() => squad.reduce((t, s) => t + s.priceM, 0), [squad])
  const formation = `${squadCounts.DEF}-${squadCounts.MID}-${squadCounts.STR}`
  const frozenCount = Object.keys(lastSeason).length
  const isFrozen = frozenCount > 0

  // Indicators + composite score, normalised within the active position group.
  const rows = useMemo(() => {
    const group = players
      .filter((p) => (p.position || '').toUpperCase() === activePos)
      .map((p) => {
        const priceM = toMillions(p.price) // current price (from the pool)
        const name = p.displayName || p.name || 'Unknown'
        // Points are LAST season's: prefer the captured snapshot (survives a live
        // refresh); fall back to the pool's own total while it still holds last-season data.
        const snapPts = lastSeason[name]
        const pts = snapPts !== undefined ? snapPts : Number(p.totalPoints) || 0
        const club = p.playerClub || 'Unknown'
        return {
          id: String(p.id),
          name,
          club,
          priceM,
          pts,
          ppv: priceM > 0 ? pts / priceM : 0,
          euro: europe.has(club),
          starterRating: starter[String(p.id)] ?? 3,
        }
      })

    if (group.length === 0) return []
    const ptsVals = group.map((r) => r.pts)
    const ppvVals = group.map((r) => r.ppv)
    const minPts = Math.min(...ptsVals)
    const maxPts = Math.max(...ptsVals)
    const minPpv = Math.min(...ppvVals)
    const maxPpv = Math.max(...ppvVals)
    const norm = (v: number, mn: number, mx: number) =>
      mx > mn ? ((v - mn) / (mx - mn)) * 100 : 0

    return group.map((r) => {
      const nTotal = norm(r.pts, minPts, maxPts)
      const nPpv = norm(r.ppv, minPpv, maxPpv)
      const nEuro = r.euro ? 100 : 0
      const nStarter = ((r.starterRating - 1) / 4) * 100
      const score =
        (nTotal * weights.totalPoints +
          nPpv * weights.pointsPerValue +
          nEuro * weights.european +
          nStarter * weights.starter) /
        totalWeight
      return { ...r, score: Math.round(score) }
    })
  }, [players, activePos, weights, starter, totalWeight, europe, lastSeason])

  const sorted = useMemo(() => {
    const base = europeOnly ? rows.filter((r) => r.euro) : rows
    const arr = [...base]
    const { key, dir } = sort
    arr.sort((a: any, b: any) => {
      const pick = (r: any) => (key === 'euro' ? (r.euro ? 1 : 0) : r[key])
      const av = pick(a)
      const bv = pick(b)
      if (typeof av === 'string') {
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return dir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [rows, sort, europeOnly])

  const toggleSort = (key: string) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    )

  const addToSquad = (r: any) => {
    if (inSquad(r.id)) return
    if (squad.length >= APP_CONSTANTS.MAX_PLAYERS) {
      toast.error(`Team is full — ${APP_CONSTANTS.MAX_PLAYERS} players already selected.`)
      return
    }
    if ((squadCounts[activePos] || 0) >= POSITION_MAX[activePos]) {
      toast.error(
        `Cannot add ${r.name} — max ${POSITION_MAX[activePos]} ${POSITION_LABEL[activePos]} allowed.`
      )
      return
    }
    if (squadValue + r.priceM > APP_CONSTANTS.BUDGET_LIMIT) {
      toast.error(
        `Cannot add ${r.name} — would exceed the £${APP_CONSTANTS.BUDGET_LIMIT.toFixed(0)}M budget.`
      )
      return
    }
    setSquad((sq) => [
      ...sq,
      { id: r.id, name: r.name, club: r.club, position: activePos, priceM: r.priceM },
    ])
  }
  const removeFromSquad = (id: string) => setSquad((sq) => sq.filter((s) => s.id !== id))

  const saveTeam = async () => {
    if (!managerName.trim()) {
      toast.error('Enter a manager name.')
      return
    }
    const violations: string[] = []
    if (squad.length !== APP_CONSTANTS.MAX_PLAYERS)
      violations.push(`exactly ${APP_CONSTANTS.MAX_PLAYERS} players (currently ${squad.length})`)
    if (squadCounts.GK !== 1)
      violations.push(`exactly 1 goalkeeper (currently ${squadCounts.GK})`)
    if (!ALLOWED_FORMATIONS.includes(formation))
      violations.push(`formation ${formation} is not allowed`)
    if (squadValue > APP_CONSTANTS.BUDGET_LIMIT)
      violations.push(
        `value £${squadValue.toFixed(1)}M over the £${APP_CONSTANTS.BUDGET_LIMIT.toFixed(0)}M limit`
      )
    if (violations.length) {
      toast.error(`Cannot save — ${violations.join('; ')}.`, { autoClose: 10000 })
      return
    }

    setSaving(true)
    try {
      const teamDetails = squad.map((pl) => ({
        playerId: pl.id,
        playerDetails: {
          playerName: pl.name,
          playerClub: pl.club,
          playerPosition: pl.position,
          gwpts: 0,
          gwtotalPts: 0,
          playerValue: pl.priceM,
          playerinjured: false,
          playerSuspended: false,
          playereliminated: false,
          playerDNP: false,
        },
      }))

      let managers = await dbService.get('/0')
      managers = Array.isArray(managers) ? managers : []
      const idx = managers.findIndex(
        (m: any) => m && (m.manager || '').toLowerCase() === managerName.trim().toLowerCase()
      )
      const managerId =
        idx !== -1
          ? managers[idx].managerId
          : managers.reduce((mx: number, m: any) => Math.max(mx, m?.managerId || 0), 0) + 1

      // dreamteam27-manager (self-service registration) keys teams by
      // (manager name, mobile); capture doesn't collect one, so write the
      // "ADMIN" placeholder unless this manager already has a real mobile
      // (i.e. was originally self-registered) — preserve that rather than
      // clobbering it. See dreamteam27-manager's docs/SPEC-manager-app.md §9.
      const existingMobile = idx !== -1 ? managers[idx]?.mobile : undefined

      const teamData = {
        manager: managerName.trim(),
        name: managerName.trim(),
        managerId,
        mobile: existingMobile ?? 'ADMIN',
        totalPoints: 0,
        gameWeekPoints: 0,
        teamDetails,
        lastUpdated: new Date().toISOString(),
      }
      if (idx !== -1) managers[idx] = teamData
      else managers.push(teamData)

      const sortedM = [...managers].sort(
        (a: any, b: any) => (b.totalPoints || 0) - (a.totalPoints || 0)
      )
      const withPos = sortedM.map((m: any, i: number) => ({
        ...m,
        posNow: i + 1,
        posLast: m.posNow || i + 1,
      }))

      await dbService.set('/0', withPos)
      await dbService.set('/timestamp', Date.now())
      toast.success(`Saved ${managerName.trim()}'s team.`)
      setSquad([])
      setManagerName('')
    } catch (e) {
      console.error('Save failed:', e)
      toast.error('Failed to save team.')
    } finally {
      setSaving(false)
    }
  }

  // Candidate pool for the optimiser. The optimiser ALWAYS restricts to the
  // confirmed European clubs — that curated list is the single source of truth
  // for who is eligible. (The table's own view filter is separate.)
  const candidates = useMemo(
    () =>
      players
        .map((p) => {
          const priceM = toMillions(p.price)
          const name = p.displayName || p.name || 'Unknown'
          const snapPts = lastSeason[name]
          const pts = snapPts !== undefined ? snapPts : Number(p.totalPoints) || 0
          const club = p.playerClub || 'Unknown'
          const position = (p.position || '').toUpperCase() as Pos
          return { id: String(p.id), name, club, position, priceM, pts, euro: europe.has(club) }
        })
        .filter(
          (c) =>
            c.priceM > 0 &&
            (['GK', 'DEF', 'MID', 'STR'] as string[]).includes(c.position) &&
            c.euro // hard constraint: only players at confirmed European clubs
        ),
    [players, lastSeason, europe]
  )

  // Exact best XI for a given outfield shape (DEF-MID-STR); GK is always 1.
  const solveFormation = (
    def: number,
    mid: number,
    str: number
  ): { pts: number; players: SquadPlayer[] } | null => {
    const B = 500 // £50.0M in 0.1M units
    const quotas: Record<Pos, number> = { GK: 1, DEF: def, MID: mid, STR: str }
    const byPos: Record<Pos, Cand[]> = { GK: [], DEF: [], MID: [], STR: [] }
    candidates.forEach((c) =>
      byPos[c.position].push({ id: c.id, units: Math.round(c.priceM * 10), pts: c.pts })
    )
    for (const pos of ['GK', 'DEF', 'MID', 'STR'] as Pos[]) {
      if (byPos[pos].length < quotas[pos]) return null
    }
    let comb = chooseExactK(byPos.GK, 1, B)
    comb = combine(comb, chooseExactK(byPos.DEF, def, B), B)
    comb = combine(comb, chooseExactK(byPos.MID, mid, B), B)
    comb = combine(comb, chooseExactK(byPos.STR, str, B), B)
    const best = comb[B]
    if (!best || !isFinite(best.pts) || best.ids.length !== 1 + def + mid + str) return null
    const idset = new Set(best.ids)
    const chosen: SquadPlayer[] = candidates
      .filter((c) => idset.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, club: c.club, position: c.position, priceM: c.priceM }))
    return { pts: best.pts, players: chosen }
  }

  const applyFormation = (formationStr: string) => {
    if (europe.size === 0) {
      toast.error('No European clubs are configured. Set them in “European clubs” above first.')
      return
    }
    const [def, mid, str] = formationStr.split('-').map(Number)
    const res = solveFormation(def, mid, str)
    if (!res) {
      toast.error(
        `No valid ${formationStr} under £50M found among your ${europe.size} European clubs.`
      )
      return
    }
    if (
      squad.length > 0 &&
      !window.confirm(`Replace the current squad with the optimal ${formationStr}?`)
    )
      return
    setSquad(res.players)
    const val = res.players.reduce((t, p) => t + p.priceM, 0)
    toast.success(`Optimal ${formationStr}: ${res.pts} pts (25/26) for £${val.toFixed(1)}M.`)
  }

  const optimiseBest = () => {
    if (europe.size === 0) {
      toast.error('No European clubs are configured. Set them in “European clubs” above first.')
      return
    }
    let winner: { formation: string; pts: number; players: SquadPlayer[] } | null = null
    for (const f of ALLOWED_FORMATIONS) {
      const [def, mid, str] = f.split('-').map(Number)
      const res = solveFormation(def, mid, str)
      if (res && (!winner || res.pts > winner.pts)) {
        winner = { formation: f, pts: res.pts, players: res.players }
      }
    }
    if (!winner) {
      toast.error(`No valid team under £50M found among your ${europe.size} European clubs.`)
      return
    }
    if (
      squad.length > 0 &&
      !window.confirm(`Replace the current squad with the best overall (${winner.formation})?`)
    )
      return
    setSquad(winner.players)
    const val = winner.players.reduce((t, p) => t + p.priceM, 0)
    toast.success(
      `Best overall: ${winner.formation} — ${winner.pts} pts (25/26) for £${val.toFixed(1)}M.`
    )
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-slate-900 text-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Team Builder — Analysis</h1>
          <p className="text-sm text-slate-400 mt-1">
            Rank players by performance indicators, then build a squad under a manager.
          </p>
        </div>

        {/* Weightings */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4">
          <div className="text-sm text-slate-300 mb-3">
            Weightings — tune what the score rewards (normalised to 100%)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SCORE_FACTORS.map((f) => (
              <div key={f.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{f.label}</span>
                  <span className="font-semibold">
                    {Math.round((weights[f.key] / totalWeight) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={weights[f.key]}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) }))
                  }
                  className="w-full accent-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-3">
            Starter security is a manual 1–5 rating per player (last-season data has no
            minutes). Set it in the table; defaults to 3.
          </div>
        </div>

        {/* European clubs (season setup) */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">European clubs — {europe.size} selected</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    europeSource === 'database'
                      ? 'bg-green-700 text-green-100'
                      : europeSource === 'browser'
                        ? 'bg-amber-700 text-amber-100'
                        : 'bg-slate-600 text-slate-200'
                  }`}
                >
                  {europeSource === 'database'
                    ? 'saved to database'
                    : europeSource === 'browser'
                      ? 'this browser only'
                      : 'default (not set)'}
                </span>
                {europeDirty && (
                  <span className="px-1.5 py-0.5 rounded text-[11px] bg-red-700 text-red-100">
                    unsaved changes
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {europe.size > 0
                  ? Array.from(europe).sort().join(', ')
                  : 'None selected — the optimiser has no eligible players.'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                This list is the optimiser&apos;s only eligible pool — it picks solely from these clubs.
              </div>
            </div>
            <button
              onClick={() => setShowEuropeConfig((v) => !v)}
              className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
            >
              {showEuropeConfig ? 'Hide' : 'Edit'}
            </button>
          </div>
          {showEuropeConfig && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {allClubs.map((club) => (
                  <button
                    key={club}
                    onClick={() => toggleClub(club)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      europe.has(club)
                        ? 'bg-green-600 border-green-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {club}
                  </button>
                ))}
                {allClubs.length === 0 && (
                  <span className="text-xs text-slate-500">
                    No clubs yet — load the player pool first.
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <button
                  onClick={saveEurope}
                  disabled={savingEurope}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-50"
                >
                  {savingEurope ? 'Saving…' : 'Save to database'}
                </button>
                <span className="text-xs text-slate-500">
                  Toggle each club that qualified for Europe this season. Saved for the
                  season and re-selectable when you set up next year.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Last-season points snapshot (season setup) */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {isFrozen ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-600 text-white text-xs font-semibold tracking-wide">
                    ✓ DATA FROZEN FOR: {REFERENCE_SEASON}
                  </span>
                  <span className="text-slate-400">{frozenCount} players</span>
                </span>
              ) : (
                <span className="text-slate-300">
                  Last-season reference ({REFERENCE_SEASON}) — not frozen yet (using the pool
                  total for now)
                </span>
              )}
            </div>
            <button
              onClick={captureLastSeason}
              disabled={capturingSnapshot}
              className={`px-3 py-1.5 rounded text-white text-xs disabled:opacity-50 ${
                isFrozen ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {capturingSnapshot ? 'Freezing…' : isFrozen ? 'Freeze again' : 'Freeze from current pool'}
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Freeze once while the pool still holds last season data — it becomes a read-only
            2025/26 archive. Then refresh the pool with the new season, and the table shows
            current prices alongside last season points.
          </div>
        </div>

        {/* Squad panel */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-slate-400 mb-1">Manager</label>
              <input
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Manager name"
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-4 text-center">
              <div>
                <div className="text-xs text-slate-400">Squad</div>
                <div className="text-lg font-semibold">{squad.length}/11</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Formation</div>
                <div className="text-lg font-semibold">{squad.length ? formation : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Value</div>
                <div
                  className={`text-lg font-semibold ${squadValue > APP_CONSTANTS.BUDGET_LIMIT ? 'text-red-400' : ''}`}
                >
                  £{squadValue.toFixed(1)}M
                </div>
              </div>
            </div>
            <button
              onClick={saveTeam}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save team'}
            </button>
          </div>
          {squad.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {squad.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 bg-slate-700 rounded-full pl-2 pr-1 py-1 text-xs"
                >
                  <span className="text-slate-400">{s.position}</span> {s.name}
                  <button
                    onClick={() => removeFromSquad(s.id)}
                    aria-label={`Remove ${s.name}`}
                    className="ml-1 w-4 h-4 rounded-full bg-slate-600 hover:bg-red-500 text-white leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Add players from the table below to build your squad.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700">
            <span className="text-xs text-slate-400">Auto-pick best XI:</span>
            {ALLOWED_FORMATIONS.map((f) => (
              <button
                key={f}
                onClick={() => applyFormation(f)}
                className="px-2.5 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs font-medium"
              >
                {f}
              </button>
            ))}
            <button
              onClick={optimiseBest}
              className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
            >
              Best overall
            </button>
            <span
              className={`text-xs ${europe.size > 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              · European clubs only ({europe.size})
            </span>
          </div>
        </div>

        {/* Position tabs */}
        <div className="flex gap-2 mb-3">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setActivePos(pos)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activePos === pos
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {pos}
            </button>
          ))}
          <label
            className="self-center flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer ml-3"
            title="View filter for this table only. The optimiser always restricts to European clubs regardless of this."
          >
            <input
              type="checkbox"
              checked={europeOnly}
              onChange={(e) => setEuropeOnly(e.target.checked)}
              className="accent-green-500"
            />
            Table: European only
          </label>
          <span className="ml-auto self-center text-xs text-slate-400">
            {loading ? 'Loading…' : `${sorted.length} players`}
          </span>
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-700">
                  {[
                    ['name', 'Player', 'left'],
                    ['club', 'Club', 'left'],
                    ['priceM', '£M', 'right'],
                    ['pts', 'Pts 25/26', 'right'],
                    ['ppv', 'Pts/£', 'right'],
                    ['euro', 'Euro', 'center'],
                    ['starterRating', 'Starter', 'center'],
                    ['score', 'Score', 'right'],
                  ].map(([key, label, align]) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      title="Sort by this column"
                      className={`px-3 py-2 cursor-pointer select-none whitespace-nowrap hover:text-slate-200 ${ALIGN[align] || 'text-left'}`}
                    >
                      {label}
                      {sort.key === key ? (
                        <span className="text-blue-400">
                          {sort.dir === 'asc' ? ' ▲' : ' ▼'}
                        </span>
                      ) : (
                        <span className="text-slate-600"> ↕</span>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-700/60 ${i % 2 ? 'bg-slate-800' : 'bg-slate-800/60'}`}
                  >
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <ClubShirt club={r.club} position={activePos} size={16} />
                        {r.club}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{r.priceM.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{r.pts}</td>
                    <td className="px-3 py-2 text-right">{r.ppv.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">
                      {r.euro ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-slate-500">–</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <select
                        value={r.starterRating}
                        onChange={(e) =>
                          setStarter((s) => ({ ...s, [r.id]: Number(e.target.value) }))
                        }
                        className="bg-slate-700 text-slate-100 rounded px-1 py-0.5 text-xs"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <span className="inline-flex items-center gap-2 justify-end">
                        <span className="hidden sm:block w-16 h-1.5 rounded bg-slate-700 overflow-hidden">
                          <span
                            className="block h-full bg-blue-500"
                            style={{ width: `${r.score}%` }}
                          />
                        </span>
                        {r.score}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => addToSquad(r)}
                        disabled={inSquad(r.id)}
                        className={`px-2 py-1 rounded text-xs ${
                          inSquad(r.id)
                            ? 'bg-green-800 text-green-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {inSquad(r.id) ? 'Added' : 'Add'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                      No players found for {activePos}. Load the player pool via Upload.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Indicators use last season&apos;s data. Saved teams write to the league under the
          manager name and appear in the display app.
        </p>
      </div>
    </main>
  )
}
