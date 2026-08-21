'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useCart } from 'react-use-cart'
import { dbService } from '@/lib/db-service'
import { DB_PATHS, APP_CONSTANTS, POSITION_ORDER } from '@/lib/constants'
import { LeagueTable } from '@/components/league-table'
import { Spinner } from '@/components/ui/spinner'
import { ChevronRight, ArrowUp, ArrowDown, ChevronsRightLeft } from 'lucide-react'
import { toast } from 'react-toastify'
import SelectedPlayers from '@/components/managers/selected-players'

// Define types before using them
type PlayerDetails = {
  gwpts: number;
  gwtotalPts: number;
  playerinjured: boolean;
  playerSuspended: boolean;
  playerDNP: boolean;
  [key: string]: any;
}

type TeamPlayer = {
  playerId: string;
  playerDetails: PlayerDetails;
  [key: string]: any;
}

type Manager = {
  managerId: string;
  name?: string
  manager?: string
  players?: any[]
  teamDetails?: any[]
  totalPoints?: number
  gameWeekPoints?: number
  posNow?: number
  posLast?: number
}

type PlayerData = {
  id: string;
  gameweekPoints?: number;
  totalPoints?: number;
  injured?: boolean;
  suspended?: boolean;
  [key: string]: any;
}

// Helper function to get ordinal suffix

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Reorders a manager's teamDetails into GK/DEF/MID/STR order. This ONLY
// reorders — every player entry (and every field on it) is passed through
// completely untouched; nothing is added, removed, or mutated. Ties (e.g.
// two DEFs) keep their existing relative order (stable sort). Positions not
// in POSITION_ORDER (e.g. an 'Unknown') sort last rather than being dropped.
// Self-heals any team whose stored order predates the sort already applied
// at selection time in selected-players.tsx, or that was written by another
// app (e.g. dreamteam27-manager) without that logic.
function sortTeamByPosition<T>(teamDetails: T, isArray: boolean): T {
  const rank = (player: any): number => {
    const pos = player?.playerDetails?.playerPosition;
    return POSITION_ORDER[pos] ?? 99;
  };

  if (isArray) {
    const arr = teamDetails as unknown as any[];
    return [...arr]
      .map((player, index) => ({ player, index }))
      .sort((a, b) => rank(a.player) - rank(b.player) || a.index - b.index)
      .map(({ player }) => player) as unknown as T;
  }

  // Object-keyed teamDetails: rebuild with the same key -> value pairs,
  // just reordered, so no data is lost or altered.
  const obj = teamDetails as unknown as Record<string, any>;
  const sortedEntries = Object.entries(obj)
    .map(([key, player], index) => ({ key, player, index }))
    .sort((a, b) => rank(a.player) - rank(b.player) || a.index - b.index);
  return Object.fromEntries(sortedEntries.map(({ key, player }) => [key, player])) as unknown as T;
}

// Define all helper functions before the component
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date); // "Weds"
const day = getOrdinal(date.getDate()); // "2nd"
const month = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date); // "July"
const year = date.getFullYear(); // 2025

let hours = date.getHours();
const minutes = date.getMinutes().toString().padStart(2, '0');
const ampm = hours >= 12 ? 'pm' : 'am';
hours = hours % 12 || 12; // Convert to 12-hour format

const time = `${hours}:${minutes}${ampm}`;
const formatted = `${weekday}, ${day} ${month}, ${year} : ${time}`;

  return formatted
}

// Component definition
export default function UpdateManager({ managerName }: { managerName?: string }) {
  // Initialize all state variables first
  const searchParams = useSearchParams()
  const paramManagerName = searchParams?.get('name')
  const effectiveManagerName = managerName || paramManagerName
  const router = useRouter()
  const { user, loading } = useAuth()

  // Initialize all state hooks
  const [thisData, setThisData] = useState<Manager[]>([])
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingPlayers, setIsUpdatingPlayers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [leagueData, setLeagueData] = useState<Manager[]>([])
  const {
    addItem,
    items = [],
    removeItem,
    clearCart
  } = useCart()
  const [clicked, setClicked] = useState({ b1: false, b2: false, b3: false })

  // Fetch last updated timestamp
  const fetchLastUpdated = useCallback(async () => {
    try {
      const lastUpdated = await dbService.get(DB_PATHS.LAST_UPDATED);

      const timestamp = lastUpdated;

      if (timestamp && !isNaN(Number(timestamp))) {
        try {
        
          const formatted = formatDate(timestamp);
          setLastUpdated(formatted);

        } catch (err) {
          console.error('Error formatting timestamp:', err);
          setLastUpdated('Unknown');
        }
      } else {
        setLastUpdated('Never');
      }
    } catch (error) {
      console.error('Error fetching last updated timestamp:', error);
      setLastUpdated('Error');
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (loading) return;

      if (!user) {
        router.push('/');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const managerData = await dbService.get(DB_PATHS.MANAGERS);
        
        if (!managerData || !Array.isArray(managerData) || managerData.length === 0) {
          setError('No manager data found');
          setIsLoading(false);
          return;
        }
        
        const processedData = managerData
          .filter(manager => manager !== null && manager !== undefined)
          .map(manager => {
            if (!manager.name && manager.manager) {
              manager.name = manager.manager;
            }
            
            return manager;
          });
        
        setThisData(processedData);
        
        if (effectiveManagerName) {
          const manager = processedData.find(m => 
            m.name && m.name.toLowerCase() === effectiveManagerName.toLowerCase()
          );
          
          if (manager) {
            setSelectedManager(manager);
          } else {
            setError(`Manager "${effectiveManagerName}" not found`);
          }
        }
        
        const sortedData = [...processedData].sort((a, b) => {
          const pointsA = a.totalPoints || 0;
          const pointsB = b.totalPoints || 0;
          return pointsB - pointsA;
        });
        
        setLeagueData(sortedData);
        
        fetchLastUpdated();
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, loading, router, effectiveManagerName, fetchLastUpdated]);

  useEffect(() => {
    if (error) {
      console.error('Error state:', error);
      toast.error(error);
    }
  }, [error]);

  const renderError = () => {
    if (!error) return null;
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  };

  const updateManagersWithPlayerData = async () => {
    setIsUpdatingPlayers(true);
    setError(null);
    
    try {
      const managers = await dbService.get(DB_PATHS.MANAGERS);
      
      if (!managers || !Array.isArray(managers) || managers.length === 0) {
        throw new Error('No manager data found');
      }
      
      const playerData = await dbService.get(DB_PATHS.PLAYER_DATA);
      
      if (!playerData) {
        throw new Error('No player data found');
      }
      
      // Build a lookup map keyed by the real player id (string) regardless of how
      // `playerData` is structured (array or object keys).
      const playerMap: Record<string, any> = {};

      if (Array.isArray(playerData)) {
        playerData.forEach((p) => {
          const pid = p?.id ?? p?.playerId ?? p?._id;
          if (pid != null) {
            playerMap[pid.toString()] = p;
          }
        });
      } else {
        Object.values(playerData).forEach((p: any) => {
          const pid = p?.id ?? p?.playerId ?? p?._id;
          if (pid != null) {
            playerMap[pid.toString()] = p;
          }
        });
      }
      
      const updatedManagers = managers.map(manager => {
        try {
          if (!manager || !manager.teamDetails) {
            return manager;
          }
          
          if (!manager.name && manager.manager) {
            manager.name = manager.manager;
          }
          
          const isArray = Array.isArray(manager.teamDetails);
          let totalPoints = 0;
          let gameWeekPoints = 0;
          
          // helper to update a single player object
          const updatePlayer = (player: any) => {
            if (!player || !player.playerId) return player;

            // Normalise the id to **string** because Object.entries keys are strings
            const playerIdRaw = player.playerId ?? player.id ?? player._id;
            const playerIdStr = playerIdRaw?.toString?.() ?? '';

            // Look-up using the normalised string id
            const playerInfo = playerMap[playerIdStr];
            if (!playerInfo) return player; // No data – leave unchanged

            const playerDetails = player.playerDetails || {};

            // NOTE: playerValue is the price at which the manager PICKED the player.
            // It is locked at team selection (pre-season) and must NOT be refreshed
            // from retrieved data — do not assign playerDetails.playerValue here.
            // Only points / status / availability are updated below.

            // Safely parse numbers (default 0)
            const gwPoints = parseInt(playerInfo.gameweekPoints || 0);
            const totalPlayerPoints = parseInt(playerInfo.totalPoints || 0);

            // Update per-player details
            playerDetails.gwpts = gwPoints;
            playerDetails.gwtotalPts = totalPlayerPoints;
            playerDetails.playerinjured = playerInfo.status === 'injured';
            playerDetails.playerSuspended = playerInfo.status === 'suspended';
            playerDetails.playereliminated = playerInfo.status === 'eliminated';
            
            // Determine if player is available (not injured, not suspended, not eliminated)
            const isAvailable = !playerDetails.playerinjured && !playerDetails.playerSuspended && !playerDetails.playereliminated;
            
            // Update playerDNP based on availability and gameweek points
            if (isAvailable) {
              if (playerInfo.gameweekPoints === null || playerInfo.gameweekPoints === undefined) {
                // Available but gameweekPoints is null = didn't play
                playerDetails.playerDNP = true;
              } else {
                // Available and gameweekPoints is 0 or any number = did play
                playerDetails.playerDNP = false;
              }
            } else {
              // Not available (injured/suspended/eliminated) = didn't play
              playerDetails.playerDNP = true;
            }

            // Remove legacy playerPlayed field from database
            if ('playerPlayed' in playerDetails) {
              delete playerDetails.playerPlayed;
            }

            if (!playerDetails.playerName && playerInfo.displayName) {
              playerDetails.playerName = playerInfo.displayName;
            }
            if (!playerDetails.playerPosition && playerInfo.position) {
              playerDetails.playerPosition = playerInfo.position;
            }
            // Club is fixed at selection. squadId is a UUID this season, so the old
            // getClubName(squadId) mapping no longer applies (it returned "NO CLUB"
            // and corrupted the club on update). Only backfill a missing club from
            // the API-resolved code; never overwrite an existing one.
            if (!playerDetails.playerClub && playerInfo.playerClub) {
              playerDetails.playerClub = playerInfo.playerClub;
            }

            // Accumulate team totals
            gameWeekPoints += gwPoints;
            totalPoints += totalPlayerPoints;

            return {
              ...player,
              playerDetails
            };
          };

          let updatedTeamDetails: any;

          if (isArray) {
            updatedTeamDetails = (manager.teamDetails as any[]).map(updatePlayer);
          } else {
            updatedTeamDetails = {} as Record<string, any>;
            Object.entries(manager.teamDetails || {}).forEach(([key, p]) => {
              updatedTeamDetails[key] = updatePlayer(p);
            });
          }

          // Re-order only (see sortTeamByPosition doc comment) — every
          // player's data is untouched, this just fixes display order.
          updatedTeamDetails = sortTeamByPosition(updatedTeamDetails, isArray);

          return {
            ...manager,
            teamDetails: updatedTeamDetails,
            totalPoints,
            gameWeekPoints
          };
        } catch (managerError) {
          return manager;
        }
      });
      
      const sortedManagers = [...updatedManagers]
        .filter(manager => manager !== null && manager !== undefined)
        .sort((a, b) => {
          const pointsA = a.totalPoints || 0;
          const pointsB = b.totalPoints || 0;
          return pointsB - pointsA;
        });
      
      const managersWithPositions = sortedManagers.map((manager, index) => {
        const posNow = index + 1;
        const posLast = manager.posNow || posNow;
        
        return {
          ...manager,
          posNow,
          posLast
        };
      });
      
      await dbService.set(DB_PATHS.MANAGERS, managersWithPositions);
      
      const timestamp = Date.now();
      await dbService.set(DB_PATHS.LAST_UPDATED, timestamp);
      
      setThisData(managersWithPositions);
      setLeagueData(managersWithPositions);
      
      if (selectedManager) {
        const updatedSelectedManager = managersWithPositions.find(
          m => m.name === selectedManager.name
        );
        
        if (updatedSelectedManager) {
          setSelectedManager(updatedSelectedManager);
        }
      }
      
      fetchLastUpdated();
      
      toast.success('Player data updated successfully');
    } catch (error) {
      console.error('Error updating player data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to update player data: ${errorMessage}`);
      toast.error('Failed to update player data');
    } finally {
      setIsUpdatingPlayers(false);
    }
  };

  const handleRemovePlayer = (playerId: string | number) => {
    if (!items) return
    removeItem(playerId.toString())
  }

  // ---------------------------------------------------------------
  // Helper: load a manager's saved team into the cart
  // ---------------------------------------------------------------
  const loadTeamToCart = useCallback(
    (teamDetails: any) => {
      if (!teamDetails) return

      // Clear current cart first – allow React/useCart state to flush
      clearCart()

      // Ensure we have an array
      if (!Array.isArray(teamDetails)) {
        if (typeof teamDetails === 'object') {
          teamDetails = Object.values(teamDetails)
        } else {
          teamDetails = []
        }
      }

      // Map saved player objects → cart items expected by SelectedPlayers
      const itemsToAdd = (teamDetails as any[])
        .filter(Boolean)
        .map((player) => {
          // Player details may be nested differently – handle common shapes
          const pd: any =
            (player.playerDetails && typeof player.playerDetails === 'object')
              ? player.playerDetails
              : (player.playerDetail && typeof player.playerDetail === 'object')
                ? player.playerDetail
                : player

          const rawPriceNum = typeof pd.playerValue === 'number'
            ? pd.playerValue
            : parseFloat(String(pd.playerValue).replace(/[^\d.]/g, '')) || 0
          const millions = rawPriceNum > 100 ? rawPriceNum / 1_000_000 : rawPriceNum

          const formattedPrice = (typeof pd.playerValue === 'string' && pd.playerValue.startsWith('£'))
            ? pd.playerValue
            : `£${millions.toFixed(1)}M`

          return {
            // UUID string ids this season — Number(...) would give NaN, which
            // react-use-cart rejects. Keep the native id.
            id: player.playerId || player.id || Date.now(),
            displayName: pd.playerName || pd.displayName || 'UNK',
            position: pd.playerPosition || pd.position || 'UNK',
            playerClub: pd.playerClub || player.playerClub || 'NO CLUB',
            price: formattedPrice,
            rawPrice: millions,
            originalData: player
          }
        })

      // Delay addition slightly so the emptyCart reducer runs first
      setTimeout(() => {
        itemsToAdd.forEach((itm) => addItem(itm))
      }, 0)
    },
    [addItem, clearCart]
  )

  // When a manager is selected (or changes), load their saved team into cart
  useEffect(() => {
    if (selectedManager && selectedManager.teamDetails) {
      loadTeamToCart(selectedManager.teamDetails)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedManager])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (selectedManager) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl text-slate-200 font-bold mb-8">
          Update Manager: {selectedManager.name}
        </h1>

        {error && renderError()}

        {/* Manager Details */}
        <div className="bg-slate-400 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl text-slate-800 font-semibold mb-4">Manager Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-800"><strong>Name:</strong> {selectedManager.name}</p>
              <p className="text-slate-800"><strong>Total Points:</strong> {selectedManager.totalPoints}</p>
              <p className="text-slate-800"><strong>Game Week Points:</strong> {selectedManager.gameWeekPoints}</p>
            </div>
          </div>
        </div>

        {lastUpdated && (
          <p className="text-slate-400 mb-4">Last updated: {lastUpdated}</p>
        )}

        {/* Selected Players Table */}
        <div className="bg-green-400 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl text-slate-800 font-semibold mb-4">Selected Players</h2>
          <SelectedPlayers
            managerId={selectedManager.managerId}
            managerName={selectedManager.name}
          />
        </div>

        {/* Player Data Sync Button */}
        <div className="bg-green-400 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl text-slate-800 font-semibold mb-4">Sync Player Data</h2>
          <p className="text-slate-800 mb-4">
            Update all manager team details with the latest player data from /1/playerData.
            This will sync player stats, points, and status for all managers.
          </p>
          <button
            onClick={updateManagersWithPlayerData}
            disabled={isUpdatingPlayers}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
          >
            {isUpdatingPlayers ? 'Updating...' : 'Update Player Data'}
          </button>
        </div>

        {/* League Table */}
        <div className="bg-green-400 rounded-lg shadow-md p-6">
          <h2 className="text-xl text-slate-800 font-semibold mb-4">League Positions</h2>
          <p className="text-gray-600 text-sm mb-2">
            Last updated: {lastUpdated}
          </p>
          <LeagueTable data={leagueData} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl text-slate-200 font-bold mb-8">Update Manager Summary</h1>

      {lastUpdated && (
        <p className="text-slate-400 mb-4">Last updated: {lastUpdated}</p>
      )}

      {error && renderError()}

      {/* Player Data Sync Button */}
      <div className="bg-green-200 rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl text-slate-800 font-semibold mb-4">Sync Player Data</h2>
        <p className="text-slate-800 mb-4">
          Update all manager team details with the latest player data from /1/playerData.
          This will sync player stats, points, and status for all managers.
        </p>
        <button
          onClick={updateManagersWithPlayerData}
          disabled={isUpdatingPlayers}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
        >
          {isUpdatingPlayers ? 'Updating...' : 'Update Player Data'}
        </button>
      </div>

      {/* League Table */}
      <div className="bg-green-200 rounded-lg shadow-md p-6">
        <h2 className="text-xl text-slate-800 font-semibold mb-4">League Positions</h2>
        <p className="text-gray-600 text-sm mb-2">
          Last updated: {lastUpdated}
        </p>
        <LeagueTable data={leagueData} />
      </div>
    </div>
  );
}
