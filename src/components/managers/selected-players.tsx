'use client'

import React, { useMemo, useState } from 'react'
import { useCart } from 'react-use-cart'
import { toast } from 'react-toastify'
import { ref, get } from 'firebase/database'
import { db } from '@/lib/firebase'
import { dbService } from '@/lib/db-service'; // Import the dbService
import ClubShirt from '@/components/ClubShirt'
import { APP_CONSTANTS, ALLOWED_FORMATIONS } from '@/lib/constants'

interface SelectedPlayersProps {
  managerId?: string;
  managerName?: string;
  onSaveComplete?: () => void;
}

const SelectedPlayers = ({ managerId, managerName, onSaveComplete }: SelectedPlayersProps) => {
  const { items, removeItem, emptyCart } = useCart()
  
  // Debug selected players cart state
  console.log('⚽ SelectedPlayers cart state:', {
    itemsCount: items?.length || 0,
    items: items?.map(item => ({ id: item.id, name: item.displayName, position: item.position })) || [],
    emptyCartFunction: typeof emptyCart,
    timestamp: new Date().toISOString()
  });
  const [isSaving, setIsSaving] = useState(false)
  
  // Format price to £X.XM format
  const formatPrice = (price?: string | number): string => {
    if (price === undefined || price === null) return '£0.0M';

    // helper
    const toMillions = (num: number) => {
      const millions = num > 100 ? num / 1_000_000 : num;
      return `£${millions.toFixed(1)}M`;
    };

    if (typeof price === 'string') {
      const match = price.trim().match(/£?([\d.]+)/);
      if (match) {
        const num = parseFloat(match[1]);
        if (!isNaN(num)) return toMillions(num);
      }
      return price.startsWith('£') ? price : `£${price}`;
    }

    const numericPrice = parseFloat(String(price));
    if (isNaN(numericPrice)) return '£0.0M';
    return toMillions(numericPrice);
  }

  // Calculate team total value
  const calculatedTeamValue = useMemo(() => {
    if (!items || !Array.isArray(items)) return 0;
    
    // Debug cart contents
    console.log('Cart items:', items);
    
    const total = items.reduce((sum, player) => {
      // Debug individual player price data
      console.log('Player in cart:', {
        id: player.id,
        name: player.displayName,
        price: player.price,
        priceType: typeof player.price,
        rawPrice: player.rawPrice,
        rawPriceType: typeof player.rawPrice
      });
      
      // Use rawPrice if available, otherwise try to parse from price string
      if (player.rawPrice != null) {
        return sum + player.rawPrice;
      } else if (typeof player.price === 'number') {
        return sum + player.price;
      } else if (typeof player.price === 'string') {
        // Extract numeric value from price string (e.g., "£4.0M" -> 4.0)
        const priceMatch = player.price.match(/£?([\d.]+)M?/);
        return sum + (priceMatch ? parseFloat(priceMatch[1]) : 0);
      }
      return sum;
    }, 0);
    
    return total; // return raw numeric for now
  }, [items]);

  // Count positions
  const positionCounts = useMemo(() => {
    if (!items || !Array.isArray(items)) return { GK: 0, DEF: 0, MID: 0, STR: 0 };
    
    return items.reduce((counts: Record<string, number>, player) => {
      const position = player.position || 'UNKNOWN';
      counts[position] = (counts[position] || 0) + 1;
      return counts;
    }, { GK: 0, DEF: 0, MID: 0, STR: 0 } as Record<string, number>);
  }, [items]);

  // Sort items by position
  const sortedItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    
    const positionOrder: Record<string, number> = { GK: 1, DEF: 2, MID: 3, STR: 4 };

    return [...items].sort((a, b) => {
      const posA = a.position || 'UNKNOWN';
      const posB = b.position || 'UNKNOWN';

      return (positionOrder[posA] || 99) - (positionOrder[posB] || 99);
    });
  }, [items]);

  return (
    <div className="space-y-4 w-full mt-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Selected Players</h2>
          <div className="text-sm text-slate-300 mt-1">
            Formation: {positionCounts.DEF}-{positionCounts.MID}-{positionCounts.STR}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-300">
            Team Value: <span className="font-semibold text-green-400">{formatPrice(calculatedTeamValue)}</span>
          </div>
          <div className="text-sm text-slate-300 mt-1">
            No. of Players: <span className="font-semibold text-slate-100">{items.length}</span>
          </div>
        </div>
      </div>

      {sortedItems.length > 0 && (
        <div className="bg-slate-800 1rounded-md p-2 sm:p-4">
          {/* Confirmation button at top when team is complete */}
          {sortedItems.length === 11 && (
            <div className="mb-4 pb-4 border-b border-green-400/30">
              <button
                onClick={async () => {
                  console.log('Manager name check:', { managerName, type: typeof managerName, length: managerName?.length });
                  if (!managerName || managerName.trim() === '') {
                    toast.error('Manager name is required');
                    return;
                  }

                  // --- Rules enforcement (hard block) ---
                  // Report every rule that failed so the user knows exactly why.
                  const formation = `${positionCounts.DEF}-${positionCounts.MID}-${positionCounts.STR}`;
                  const violations: string[] = [];

                  if (sortedItems.length !== APP_CONSTANTS.MAX_PLAYERS) {
                    violations.push(
                      `squad must be exactly ${APP_CONSTANTS.MAX_PLAYERS} players (currently ${sortedItems.length})`
                    );
                  }
                  if (positionCounts.GK !== 1) {
                    violations.push(
                      `exactly 1 goalkeeper required (currently ${positionCounts.GK})`
                    );
                  }
                  if (!ALLOWED_FORMATIONS.includes(formation)) {
                    violations.push(
                      `formation ${formation} is not allowed (allowed: ${ALLOWED_FORMATIONS.join(', ')})`
                    );
                  }
                  if (calculatedTeamValue > APP_CONSTANTS.BUDGET_LIMIT) {
                    violations.push(
                      `team value £${calculatedTeamValue.toFixed(1)}M exceeds the £${APP_CONSTANTS.BUDGET_LIMIT.toFixed(0)}M limit`
                    );
                  }

                  if (violations.length > 0) {
                    toast.error(`Cannot save this team — ${violations.join('; ')}.`, {
                      autoClose: 10000,
                    });
                    return;
                  }

                  setIsSaving(true);
                  
                  try {
                    // Load existing managers data
                    let managers: any[] = await dbService.get('/0');
                    
                    if (managers) {
                      // Ensure managers is an array
                      if (!Array.isArray(managers)) {
                        console.warn('Managers data is not an array, initializing empty array');
                        managers = [];
                      }
                    } else {
                      console.log('No managers data found, initializing empty array');
                      managers = [];
                    }
                    
                    // Find if manager exists or create new ID
                    let managerId = 1;
                    let existingManagerIndex = -1;
                    
                    if (managers && managers.length > 0) {
                      // Find existing manager or get next ID
                      existingManagerIndex = managers.findIndex(m => 
                        m && m.manager && m.manager.toLowerCase() === managerName.toLowerCase()
                      );
                      
                      if (existingManagerIndex === -1) {
                        // Get highest manager ID and add 1
                        const maxId = managers.reduce((max, m) => 
                          m && m.managerId && m.managerId > max ? m.managerId : max, 0
                        );
                        managerId = maxId + 1;
                      } else {
                        managerId = managers[existingManagerIndex].managerId;
                      }
                    }

                    // Fetch player data to calculate points
                    const playerData = await dbService.get('/1/playerData');
                    
                    // Create a map of player data for easy lookup
                    const playerMap: Record<string, any> = {};
                    
                    if (playerData) {
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
                    }

                    // Calculate total points and team value
                    let totalPoints = 0;
                    let teamValue = 0;
                    
                    const teamPlayers = sortedItems.map(player => {
                      const playerInfo = playerMap[player.id.toString()];
                      const gameweekPoints = playerInfo?.gameweekPoints || 0;
                      totalPoints += gameweekPoints;
                      
                      // Handle price calculation - use same logic as calculatedTeamValue
                      let playerPrice = 0;
                      if (player.rawPrice !== undefined && player.rawPrice !== null) {
                        playerPrice = Number(player.rawPrice);
                      } else if (player.price) {
                        // Extract numeric value from price string (e.g., "£4.0M" -> 4.0)
                        const priceMatch = String(player.price).match(/£?([\d.]+)M?/);
                        playerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
                      }
                      teamValue += playerPrice;
                      
                      return {
                        playerId: player.id,
                        playerName: player.displayName,
                        playerClub: player.playerClub,
                        position: player.position,
                        price: playerPrice,
                        gameweekPoints: gameweekPoints,
                        totalPoints: playerInfo?.totalPoints || 0
                      };
                    });

                    console.log('Team value calculation debug:', {
                      totalTeamValue: teamValue,
                      playersCount: teamPlayers.length,
                      samplePlayerPrices: teamPlayers.slice(0, 3).map(p => ({ name: p.playerName, price: p.price }))
                    });

                    const teamData = {
                      managerId,
                      manager: managerName,
                      name: managerName,
                      totalPoints,
                      teamValue,
                      // The display app and capture editor read `teamDetails` /
                      // `playerDetails` (the canonical shape used by the seeded data),
                      // so write that rather than a flat `players` array.
                      teamDetails: teamPlayers.map((p) => ({
                        playerId: p.playerId,
                        playerDetails: {
                          playerName: p.playerName,
                          playerClub: p.playerClub,
                          playerPosition: p.position,
                          gwpts: p.gameweekPoints ?? 0,
                          gwtotalPts: p.totalPoints ?? 0,
                          playerValue: p.price,
                          playerinjured: false,
                          playerSuspended: false,
                          playereliminated: false,
                          playerDNP: false,
                        },
                      })),
                      lastUpdated: new Date().toISOString(),
                    };

                    // Update or add manager data
                    let updatedManagers = [...managers];
                    
                    if (existingManagerIndex !== -1) {
                      // Update existing manager
                      updatedManagers[existingManagerIndex] = teamData;
                    } else {
                      // Add new manager
                      updatedManagers.push(teamData);
                    }
                    
                    // Sort managers by total points and update positions
                    const sortedManagers = [...updatedManagers].sort((a, b) => {
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
                    
                    // Save to database using the API route instead of direct Firebase write
                    console.log('Saving team data via API route');
                    await dbService.set('/0', managersWithPositions);
                    
                    // Update last updated timestamp
                    const timestamp = Date.now();
                    await dbService.set('/timestamp', timestamp);
                    
                    toast.success('Team saved successfully!');
                    emptyCart();
                    
                    // Notify parent component that save is complete to reset other inputs
                    if (onSaveComplete) {
                      onSaveComplete();
                    }
                  } catch (error) {
                    console.error('Error saving team:', error);
                    toast.error('Failed to save team');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
              >
                {isSaving ? 'Saving Team...' : 'Confirm Team'}
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-6 gap-2 sm:gap-4 text-sm border-b border-green-400/50 border- font-semibold text-green-400 mb-2">
            <div className="col-span-2 text-left">Player</div>
            <div className="col-span-1 text-center">Pos</div>
            <div className="col-span-1 text-left pl-1">Club</div>
            <div className="col-span-1 text-right">Price</div>
            <div className="col-span-1 text-center">Action</div>
          </div>
          <ul className="space-y-2">
            {sortedItems.map((player) => (
              <li key={player.id} className="grid grid-cols-6 gap-2 sm:gap-4 items-center text-slate-200 text-sm">
                <div className="col-span-2 break-words font-semibold">{player.displayName}</div>
                <div className="col-span-1 text-center text-slate-300">{player.position}</div>
                <div className="col-span-1 flex items-center gap-1.5 text-slate-300 pl-1">
                  <ClubShirt club={player.playerClub as string} position={player.position as string} size={20} className="shrink-0" />
                  <span className="whitespace-nowrap">{player.playerClub as string}</span>
                </div>
                <div className="col-span-1 text-right font-semibold">{formatPrice(player.price)}</div>
                <div className="col-span-1 text-center">
                  <button
                    onClick={() => removeItem(player.id)}
                    className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-500 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {/* Total Row */}
          <div className="grid grid-cols-12 gap-2 sm:gap-4 items-center text-slate-200 mt-4 pt-4 border-t border-slate-700">
            <div className="col-span-7 text-right font-semibold text-sm">Team Total:</div>
            <div className="col-span-2 text-right font-semibold text-sm">{formatPrice(calculatedTeamValue)}</div>
            <div className="col-span-3"></div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {sortedItems.length > 0 && (
        <div className="flex flex-col items-start mt-4">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to cancel? All selected players will be lost.')) {
                emptyCart();
                toast.info('Team selection cancelled');
                // Call onSaveComplete to reset manager input field
                if (onSaveComplete) {
                  onSaveComplete();
                }
              }
            }}
            className="px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600"
          >
            Cancel
          </button>
          
          <button
            onClick={async () => {
              console.log('Manager name check:', { managerName, type: typeof managerName, length: managerName?.length });
              if (!managerName || managerName.trim() === '') {
                toast.error('Manager name is required');
                return;
              }

              if (sortedItems.length < 11) {
                toast.error('You must select 11 players');
                return;
              }

              setIsSaving(true);
              try {
                console.log('Saving team data for manager:', managerName);
                
                // Load existing managers data
                let managers: any[] = await dbService.get('/0');
                
                if (managers) {
                  // Ensure managers is an array
                  if (!Array.isArray(managers)) {
                    console.warn('Managers data is not an array, initializing empty array');
                    managers = [];
                  }
                } else {
                  console.log('No managers data found, initializing empty array');
                  managers = [];
                }
                
                // Find if manager exists or create new ID
                let managerId = 1;
                let existingManagerIndex = -1;
                
                if (managers && managers.length > 0) {
                  // Find existing manager or get next ID
                  existingManagerIndex = managers.findIndex(m => 
                    m && m.manager && m.manager.toLowerCase() === managerName.toLowerCase()
                  );
                  
                  if (existingManagerIndex === -1) {
                    // Get highest manager ID and add 1
                    const maxId = managers.reduce((max, m) => 
                      m && m.managerId && m.managerId > max ? m.managerId : max, 0
                    );
                    managerId = maxId + 1;
                  } else {
                    managerId = managers[existingManagerIndex].managerId;
                  }
                }

                // Fetch player data to calculate points
                const playerData = await dbService.get('/1/playerData');
                
                // Create a map of player data for easy lookup
                const playerMap: Record<string, any> = {};
                
                if (playerData) {
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
                }
                
                // Initialize totals
                let totalPoints = 0;
                let gameWeekPoints = 0;
                
                // Prepare team data in the required format with calculated points
                const teamDetails = sortedItems.map(player => {
                  // Get player ID as string for lookup
                  const playerIdRaw = player.id ?? '';
                  const playerIdStr = playerIdRaw?.toString?.() ?? '';
                  
                  // Look up player data
                  const playerInfo = playerMap[playerIdStr];
                  
                  // Set default values
                  let gwPoints = 0;
                  let totalPlayerPoints = 0;
                  let isInjured = false;
                  let isSuspended = false;
                  
                  // Update with actual data if available
                  if (playerInfo) {
                    gwPoints = parseInt(playerInfo.gameweekPoints || 0);
                    totalPlayerPoints = parseInt(playerInfo.totalPoints || 0);
                    isInjured = !!playerInfo.injured;
                    isSuspended = !!playerInfo.suspended;
                    
                    // Accumulate team totals
                    gameWeekPoints += gwPoints;
                    totalPoints += totalPlayerPoints;
                  }
                  
                  return {
                    playerDetails: {
                      gwpts: gwPoints,
                      gwtotalPts: totalPlayerPoints,
                      playerClub: player.playerClub,
                      playerDNP: false,
                      playerName: player.displayName,
                      playerPosition: player.position,
                      playerSuspended: isSuspended,
                      playerValue: typeof player.price === 'number' ? player.price : parseFloat(String(player.price).replace('£', '').replace('M', '')),
                      playereliminated: false,
                      playerinjured: isInjured
                    },
                    playerId: player.id
                  };
                });
                
                // Prepare team data with calculated points
                const teamData = {
                  gameWeekPoints: gameWeekPoints,
                  manager: managerName,
                  managerId: managerId,
                  posLast: existingManagerIndex !== -1 ? managers[existingManagerIndex].posLast : 1,
                  posNow: existingManagerIndex !== -1 ? managers[existingManagerIndex].posNow : 1,
                  teamDetails: teamDetails,
                  totalPoints: totalPoints,
                  weekPoints: gameWeekPoints
                };
                
                // Update or add manager data
                let updatedManagers = [...managers];
                
                if (existingManagerIndex !== -1) {
                  // Update existing manager
                  updatedManagers[existingManagerIndex] = teamData;
                } else {
                  // Add new manager
                  updatedManagers.push(teamData);
                }
                
                // Sort managers by total points and update positions
                const sortedManagers = [...updatedManagers].sort((a, b) => {
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
                
                // Save to database using the API route instead of direct Firebase write
                console.log('Saving team data via API route');
                await dbService.set('/0', managersWithPositions);
                
                // Update last updated timestamp
                const timestamp = Date.now();
                await dbService.set('/timestamp', timestamp);
                
                toast.success('Team saved successfully!');
                emptyCart();
                
                // Notify parent component that save is complete to reset other inputs
                if (onSaveComplete) {
                  onSaveComplete();
                }
              } catch (error) {
                console.error('Error saving team:', error);
                toast.error('Failed to save team');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="px-4 py-2 mt-2 bg-green-600 text-white rounded-md hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Confirm Team'}
          </button>
        </div>
      )}
    </div>
  )
}

export default SelectedPlayers
