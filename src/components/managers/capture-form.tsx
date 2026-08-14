'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from 'react-use-cart'
import { toast } from 'react-toastify'
import { v4 as uuidv4 } from 'uuid'
import { dbService } from '@/lib/db-service'
import { getClubName, normalizeString, normalizeStringV3_CACHEBUST } from '@/lib/utils'
import SearchResults from './search-results'
import SelectedPlayers from './selected-players'
import type { ExtendedCartItem } from './types'
import { DB_PATHS, APP_CONSTANTS } from '@/lib/constants'
import { useSearchParams } from 'next/navigation'

// Constants
const MAX_PLAYERS = APP_CONSTANTS.MAX_PLAYERS
const BUDGET_LIMIT = APP_CONSTANTS.BUDGET_LIMIT
const MIN_MANAGER_NAME_LENGTH = APP_CONSTANTS.MIN_MANAGER_NAME_LENGTH

interface CaptureFormProps {
  onResetCart?: () => Promise<void>
  pendingItems?: ExtendedCartItem[]
  onSaveItems?: (items: ExtendedCartItem[]) => void
}

const CaptureForm = ({
  onResetCart: externalResetCart,
  pendingItems,
  onSaveItems
}: CaptureFormProps) => {
  const router = useRouter()
  const { items, addItem, removeItem, emptyCart, cartTotal, totalItems } = useCart();
  
  // Debug cart state changes
  console.log('🛒 CaptureForm cart state:', {
    itemsCount: items?.length || 0,
    cartTotal,
    totalItems,
    items: items?.map(item => ({ id: item.id, name: item.displayName })) || [],
    timestamp: new Date().toISOString()
  });
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [resultCount, setResultCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [managerName, setManagerName] = useState('')
  const [sessionId, setSessionId] = useState(() => uuidv4())
  const [cartKey, setCartKey] = useState(1)
  const [isCheckingManager, setIsCheckingManager] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [managerExists, setManagerExists] = useState(false)
  const [managerData, setManagerData] = useState<any>(null)
  const [isManagerConfirmed, setIsManagerConfirmed] = useState(false)
  const [showCreatePrompt, setShowCreatePrompt] = useState(false)
  const [isLoadingManager, setIsLoadingManager] = useState(false)
  // Add state for all managers
  const [allManagers, setAllManagers] = useState<any[]>([])
  const [isLoadingAllManagers, setIsLoadingAllManagers] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [managerToDelete, setManagerToDelete] = useState<any>(null)

  // Helper to normalise strings to a-z only, lower-case, remove diacritics
  const normalizeString = (value: string): string => {
    return value
      .toLowerCase()
      .normalize('NFD')                     // split accents from letters
      .replace(/\p{Diacritic}/gu, '')      // remove accents
      .replace(/[^a-z]/g, '');              // strip non-alphabetics
  };

  // Get manager name from URL parameter
  const searchParams = useSearchParams()
  const paramManagerName = searchParams?.get('name') ?? null

  // Effect to handle manager name from URL parameter
  useEffect(() => {
    if (paramManagerName) {
      setManagerName(paramManagerName)
      setIsLoadingManager(true)
      checkManager(paramManagerName)
    }
  }, [paramManagerName])
  
  // Fetch all managers on component mount
  useEffect(() => {
    fetchAllManagers();
  }, []);
  
  // Function to fetch all managers
  const fetchAllManagers = async () => {
    setIsLoadingAllManagers(true);
    try {
      const managers = await dbService.get('/0');
      
      // Handle empty database or non-existent path
      if (!managers || managers === null || managers === undefined) {
        console.log('No managers found in database - empty database condition');
        setAllManagers([]);
        return;
      }
      
      // Ensure managers is an array
      const managersArray = Array.isArray(managers) ? managers : Object.values(managers);
      setAllManagers(managersArray.filter(manager => manager && manager.manager)); // Filter out null/undefined entries
    } catch (error) {
      console.error('Error fetching managers:', error);
      // Don't show error toast for empty database - it's a normal initial condition
      setAllManagers([]);
    } finally {
      setIsLoadingAllManagers(false);
    }
  };
  
  // Format price to £X.XM format
  const formatPrice = (price?: string | number | null) => {
    if (price === undefined || price === null) return '£0.0M';

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
  };
  
  // Calculate team value for a manager - Firebase structure has playerDetails nested
  const calculateTeamValue = (teamDetails: any) => {
    if (!teamDetails || !Array.isArray(teamDetails)) {
      return 0;
    }
    
    let totalValue = 0;
    
    teamDetails.forEach(player => {
      if (player?.playerDetails?.playerValue) {
        totalValue += parseFloat(player.playerDetails.playerValue) || 0;
      }
    });
    
    return totalValue;
  };
  
  // Handle edit manager click
  const handleEditManager = (managerName: string) => {
    setManagerName(managerName);
    checkManager(managerName);
  };

  // Handle delete manager click
  const handleDeleteManager = (manager: any) => {
    setManagerToDelete(manager);
    setShowDeleteConfirm(true);
  };

  // Confirm delete manager
  const confirmDeleteManager = async () => {
    if (!managerToDelete) return;
    
    try {
      // Get current managers
      const managers = await dbService.get('/0');
      if (!managers) return;
      
      const managersArray = Array.isArray(managers) ? managers : Object.values(managers);
      
      // Filter out the manager to delete
      const updatedManagers = managersArray.filter(m => 
        m && m.managerId !== managerToDelete.managerId
      );
      
      // Update database
      await dbService.set('/0', updatedManagers);
      
      // Refresh the managers list
      await fetchAllManagers();
      
      toast.success(`Manager "${managerToDelete.manager}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting manager:', error);
      toast.error('Failed to delete manager');
    } finally {
      setShowDeleteConfirm(false);
      setManagerToDelete(null);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setManagerToDelete(null);
  };

  // Add effect to handle page navigation cleanup (after forceClearCart is defined)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear cart when navigating away
      emptyCart();
    };

    // Add event listener for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Clear cart on component unmount (navigation away)
      emptyCart();
    };
  }, []); // Remove emptyCart from dependencies to prevent infinite loop

  // Force clear **localStorage** cart data generated by CaptureWrapper without
  // touching the currently active shared cart. We deliberately **do not call**
  // emptyCart() here so that other pages (e.g. Update-Manager) that share the
  // layout CartProvider aren't wiped unintentionally.
  const forceClearCart = useCallback(() => {
    // ONLY clear localStorage keys; leave React cart state untouched here.
    // Callers that truly want to empty the cart should invoke emptyCart()
    // themselves before/after this util.
    try {
      // Clear current cart from localStorage
      if (typeof window !== 'undefined') {
        // Get all localStorage keys
        const keys = Object.keys(localStorage);
        
        // Find and remove only capture-form related cart items
        keys.forEach(key => {
          // Only remove keys generated by local CaptureWrapper instances (e.g. "capture-cart-<session>-<n>")
          if (key.startsWith('capture-cart-')) {
            console.log('Clearing localStorage cart data:', key);
            localStorage.removeItem(key);
          }
        });
        
        console.log('Forcibly cleared capture cart data from localStorage');
      }
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
    
    // Signal to CaptureWrapper that a fresh cart is needed
    // Commented out to prevent cart resets during normal operation
    // setSessionId(uuidv4());
    // setCartKey(prev => prev + 1);
    
    return Promise.resolve();
  }, []);

  // Reset cart with new key to force remount
  const handleResetCart = useCallback(async () => {
    emptyCart();
    
    // Use external reset function if provided
    if (externalResetCart) {
      await externalResetCart();
    }
    // Removed automatic cart key changes to prevent flickering
    
    return Promise.resolve();
  }, [emptyCart, externalResetCart]);

  // Reset all form inputs and state
  const handleResetAll = useCallback(() => {
    // Empty current cart first, then clear capture-cart localStorage keys
    emptyCart();
    forceClearCart();
    
    // Reset manager-related state
    setManagerName('');
    setManagerExists(false);
    setIsManagerConfirmed(false);
    setManagerData(null);
    setShowCreatePrompt(false);
    
    // Reset search-related state
    setSearchTerm('');
    setSearchResults([]);
    setResultCount(null);
    
    // Refresh managers list to show updated data
    fetchAllManagers();
    
    toast.info('Form has been reset');
  }, [forceClearCart]);

  // Ref to store debounce timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Handle manager name change
  const handleManagerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManagerName(value)
    
    // Reset manager-related states when name changes
    setManagerExists(false)
    setIsManagerConfirmed(false)
    setManagerData(null)
    setShowCreatePrompt(false)
    
    // First do an instant lookup in pre-loaded cache to avoid flicker
    if (value.length >= MIN_MANAGER_NAME_LENGTH && managerCacheLoaded) {
      const cached = managerCache.find(m => m && m.manager && m.manager.toLowerCase() === value.toLowerCase())
      if (cached) {
        setManagerExists(true)
        setManagerData(cached)
        setShowCreatePrompt(false)
      } else {
        setManagerExists(false)
        setManagerData(null)
        // we will decide on showCreatePrompt after async debounce completes
      }
    }
    
    // Debounce manager existence check to keep cache fresh / in case not loaded yet
    if (value.length >= MIN_MANAGER_NAME_LENGTH) {
      // Cancel any pending check
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        checkManager(value);
      }, 400); // 400-ms debounce
    } else {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    }
  }
  
  // Check if manager exists
  const checkManager = async (name: string) => {
    let found = false;
    if (!name || name.length < MIN_MANAGER_NAME_LENGTH) return;
    
    setIsCheckingManager(true);
    
    try {
      const managers = await dbService.get(DB_PATHS.MANAGERS);
      
      // Handle empty database or non-existent path
      if (!managers || managers === null || managers === undefined) {
        console.log('No managers in database - empty database condition');
        setManagerData(null);
        setManagerExists(false);
        found = false;
      } else {
        // Ensure managers is an array
        const managersArray = Array.isArray(managers) ? managers : Object.values(managers);
        
        // Find manager by name (case insensitive) - Firebase uses 'manager' field
        const manager = managersArray.find(m => 
          m && m.manager && m.manager.toLowerCase() === name.toLowerCase()
        );
        
        if (manager) {
          found = true;
          
          // Ensure teamDetails is properly structured
          if (manager.teamDetails && !Array.isArray(manager.teamDetails)) {
            manager.teamDetails = Object.values(manager.teamDetails);
          }
          
          setManagerData(manager);
          setManagerExists(true);
        } else {
          setManagerData(null);
          setManagerExists(false);
        }
      }
    } catch (error) {
      console.error('Error checking manager:', error);
      // Don't show error toast for empty database - it's a normal initial condition
      setManagerData(null);
      setManagerExists(false);
    } finally {
      setIsCheckingManager(false);
      setIsLoadingManager(false);
      // Only show create prompt if manager not found AFTER search completes
      setShowCreatePrompt(!found && name.length >= MIN_MANAGER_NAME_LENGTH);
    }
  };

  // Manager cache
  const [managerCache, setManagerCache] = useState<any[]>([])
  const [managerCacheLoaded, setManagerCacheLoaded] = useState(false)

  const refreshManagerCache = useCallback(async () => {
    try {
      const mgrs = await dbService.get(DB_PATHS.MANAGERS)
      
      // Handle empty database or non-existent path
      if (!mgrs || mgrs === null || mgrs === undefined) {
        console.log('No managers in cache - empty database condition');
        setManagerCache([]);
      } else {
        const managersArray = Array.isArray(mgrs) ? mgrs : Object.values(mgrs);
        setManagerCache(managersArray.filter(manager => manager && manager.manager)); // Filter out null/undefined entries
      }
      setManagerCacheLoaded(true)
    } catch (e) {
      console.error('Failed to refresh manager cache', e)
      setManagerCache([]) // Set empty array on error
      setManagerCacheLoaded(true) // Still mark as loaded to prevent infinite loading
    }
  }, [])

  // Load cache on mount
  useEffect(() => {
    refreshManagerCache()
  }, [refreshManagerCache])

  // Confirm existing manager
  const handleConfirmManager = () => {
    setIsManagerConfirmed(true);
    setShowCreatePrompt(false);
    
    // If manager exists, load their team
    if (managerExists && managerData && managerData.teamDetails) {
      loadManagerTeam(managerData.teamDetails);
      
    }
    
  };
  
  // Create new manager
  const handleCreateManager = () => {
    // Start a fresh cart for the new manager
    emptyCart();
    forceClearCart();
    
    setIsManagerConfirmed(true);
    setManagerData({
      manager: managerName,
      managerId: Date.now(), // Use timestamp as temporary ID
      teamDetails: [] // Start with empty team
    });
    
    // Refresh cache so the new manager is immediately recognised next time
    refreshManagerCache()
  };
  
  // Load manager's team into cart
  const loadManagerTeam = async (teamDetails: any[]) => {
    // Clear cart first and wait a moment for state to commit
    emptyCart();
    await new Promise(res => setTimeout(res, 50));
    
    // Set a loading state to prevent partial rendering
    setIsLoading(true);
    
    // Ensure teamDetails is an array
    if (!Array.isArray(teamDetails)) {
      teamDetails = Object.values(teamDetails);
    }
    
    // Add each player to cart
    if (teamDetails.length > 0) {
      try {
        // First, prepare all items to add
        const itemsToAdd = teamDetails
          .filter(player => player) // ensure truthy
          .map(player => {
            // Handle both plural (playerDetails) and singular (playerDetail) containers
            const pdContainer =
              (player.playerDetails && typeof player.playerDetails === 'object')
                ? player.playerDetails
                : (player.playerDetail && typeof player.playerDetail === 'object')
                  ? player.playerDetail
                  : player;

            const pd = pdContainer;

            // Price is already stored in the correct display format (e.g. "£3.2M") or as a numeric value in millions.
            let formattedPrice: string;
            if (typeof pd.playerValue === 'string') {
              formattedPrice = pd.playerValue; // e.g. "£3.2M"
            } else {
              const numeric = typeof pd.playerValue === 'number' ? pd.playerValue : 0;
              const millions = numeric > 100 ? numeric / 1_000_000 : numeric;
              formattedPrice = `£${millions.toFixed(1)}M`;
            }

            // Club name is already stored as the full club string in db/0
            const clubName = pd.playerClub ?? player.playerClub ?? 'NO CLUB';
            
            return {
              // Keep the id as its native type. Player ids are UUID strings this
              // season, so Number(...) would produce NaN — which react-use-cart
              // rejects as a missing id. Match the raw string used by search-adds.
              id: player.playerId || player.id || pd.playerId || Date.now(),
              displayName: pd.playerName ?? pd.displayName ?? 'UNK',
              position: pd.playerPosition ?? pd.position ?? 'UNK',
              playerClub: clubName,
              price: formattedPrice,
              rawPrice: typeof pd.playerValue === 'number' ? pd.playerValue : parseFloat(String(pd.playerValue).replace(/[^\d.]/g, '')),
              originalData: player
            };
          });

        // Atomic replacement of cart to avoid race conditions
        emptyCart();
        itemsToAdd.forEach(item => addItem(item));
        
        // Wait a moment to ensure React state updates are processed
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error('Error loading team data:', error);
        toast.error('Error loading team data');
      } finally {
        // Turn off loading state
        setIsLoading(false);
      }
    } else {
      // If no items to add, just turn off loading
      setIsLoading(false);
    }
  };
  

   // Handle player search with real data
   const searchPlayers = useCallback(async () => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setSearchResults([]);
    setResultCount(null);
    
    try {
      // Fetch player data from database instead of live API
      const playerData = await dbService.get(DB_PATHS.PLAYER_DATA);
      console.log('DEBUG: Raw data from database:', playerData);

      let allPlayers: any[] = [];
      
      // Handle empty database or non-existent path
      if (!playerData || playerData === null || playerData === undefined) {
        console.log('No player data found in database');
        setSearchResults([]);
        setResultCount(0);
        return;
      }
      
      // Check if the data is a valid array
      const playersArray = Array.isArray(playerData) ? playerData : Object.values(playerData);
      if (playersArray && playersArray.length > 0) {

        // Map the player data with the correct property names
        allPlayers = playersArray
          .map(player => ({
            id: player.id,
            displayName: player.displayName,
            position: player.position,
            playerClub: player.playerClub || 'Unknown', // Use playerClub from database
            price: player.price || 0,
            rawPrice: player.price || 0
          }))
          .filter(player => player.displayName); // Ensure player has a name

        console.log('DEBUG: Mapped and filtered players for UI:', allPlayers);
      } else {
        console.log('DEBUG: Data is not an array or is empty.');
      }

      // Perform the search on the complete and correctly formatted player list
      const normalizedSearchTerm = searchTerm.toLowerCase();
      const results = allPlayers.filter(player =>
        player.displayName.toLowerCase().includes(normalizedSearchTerm)
      );
      
      setSearchResults(results);
      setResultCount(results.length);
    } catch (error) {
      console.error("Error fetching player data from database:", error);
      toast.error("Failed to fetch player data from database. Please ensure data has been uploaded.");
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (searchTerm.length < 3) {
      setSearchResults([]);
      setResultCount(null);
      setIsSearching(false);
      return;
    }

    const performSearch = async () => {
      setIsLoading(true);
      try {
        // Fetch player data from database instead of live API
        const playerData = await dbService.get(DB_PATHS.PLAYER_DATA);
        console.log('DEBUG: Raw data from database:', playerData);

        let allPlayers: any[] = [];
        
        // Handle empty database or non-existent path
        if (!playerData || playerData === null || playerData === undefined) {
          console.log('No player data found in database');
          setSearchResults([]);
          setResultCount(0);
          return;
        }
        
        // Check if the data is a valid array
        const playersArray = Array.isArray(playerData) ? playerData : Object.values(playerData);
        if (playersArray && playersArray.length > 0) {

          // Map the player data with the correct property names
          allPlayers = playersArray
            .map(player => ({
              id: player.id,
              displayName: player.displayName,
              position: player.position,
              playerClub: player.playerClub || 'Unknown', // Use playerClub from database
              price: player.price || 0,
              rawPrice: player.price || 0
            }))
            .filter(player => player.displayName); // Ensure player has a name

          console.log('DEBUG: Mapped and filtered players for UI:', allPlayers);
        } else {
          console.log('DEBUG: Data is not an array or is empty.');
        }

        // Perform the search on the complete and correctly formatted player list
        const normalizedSearchTerm = normalizeStringV3_CACHEBUST(searchTerm);
        console.log('DEBUG: Search term:', searchTerm, '-> normalized:', normalizedSearchTerm);
        
        const results = allPlayers.filter(player => {
          const normalizedPlayerName = normalizeStringV3_CACHEBUST(player.displayName);
          const matches = normalizedPlayerName.includes(normalizedSearchTerm);
          
          // Debug specific players with special characters
          if (player.displayName.includes('ø') || player.displayName.includes('Ø')) {
            console.log('DEBUG: Nordic player:', player.displayName, '-> normalized:', normalizedPlayerName, 'matches:', matches);
          }
          
          return matches;
        });
        
        setSearchResults(results);
        setResultCount(results.length);
      } catch (error) {
        console.error("Error fetching or processing player data:", error);
        toast.error("Failed to fetch player data.");
      } finally {
        setIsLoading(false);
      }
    };

    const debounceSearch = setTimeout(() => {
      setIsSearching(true)
      performSearch()
    }, 300)

    return () => clearTimeout(debounceSearch)
  }, [searchTerm])

  // ---------------------------------------------------------------
  // Cleanup: on unmount, clear cart + capture-form localStorage keys
  // ---------------------------------------------------------------
  useEffect(() => {
    return () => {
      try {
        emptyCart();
        forceClearCart(); // removes capture-cart-* keys only
        console.log('CaptureForm unmounted – cart reset');
      } catch (err) {
        console.warn('Error clearing cart on unmount', err);
      }
    };
  }, []);

  return (
    <div className="capture-form">
      {isLoadingManager ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-slate-300">Loading manager data...</p>
        </div>
      ) : (
        <>
          <div className="manager-section">
            <label htmlFor="managerName" className="block text-sm font-medium text-slate-300 mb-2">
              Enter Manager Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="managerName"
                value={managerName}
                onChange={handleManagerNameChange}
                className="w-full px-4 py-2 text-slate-100 border border-slate-700 bg-slate-800 rounded-md"
                placeholder="Enter manager name"
                disabled={isManagerConfirmed}
              />
              {isCheckingManager && (
                <div className="text-slate-300">Checking...</div>
              )}
              <button
                onClick={handleResetAll}
                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-500"
                title="Cancel and reset"
              >
                Cancel
              </button>
            </div>
            
            {/* Manager prompts */}
            {managerExists && !isManagerConfirmed && (
              <div className="mt-2 flex items-center gap-2">
                <div className="text-green-400">Manager found! Edit team?</div>
                <button 
                  onClick={handleConfirmManager}
                  className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-500"
                >
                  Edit
                </button>
              </div>
            )}
            
            {showCreatePrompt && !isManagerConfirmed && (
              <div className="mt-2 flex items-center gap-2">
                <div className="text-yellow-400">Manager not found. Create new?</div>
                <button 
                  onClick={handleCreateManager}
                  className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-500"
                >
                  Create
                </button>
              </div>
            )}
          </div>
          
          {/* Managers Table - Show only when no manager is confirmed and input is empty */}
          {!isManagerConfirmed && !managerExists && !showCreatePrompt && managerName.trim() === '' && (
            <div className="managers-table-section mt-8">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">Current Managers</h2>
              
              {isLoadingAllManagers ? (
                <div className="text-slate-300">Loading managers...</div>
              ) : (allManagers && allManagers.length > 0) ? (
                <div className="bg-slate-800 rounded-md overflow-hidden w-full sm:max-w-[66%] mx-auto">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="bg-slate-700">
                        <th className="px-2 md:px-4 py-2 text-left text-slate-200">Manager Name</th>
                        <th className="px-2 md:px-4 py-2 text-right text-slate-200">Team Value</th>
                        <th className="px-2 md:px-4 py-2 text-right text-slate-200">Points</th>
                        <th className="px-2 md:px-4 py-2 text-center text-slate-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allManagers.map((manager, index) => (
                        <tr 
                          key={manager.managerId || index} 
                          className={`border-t border-slate-700 ${index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'}`}
                        >
                          <td className="px-2 md:px-4 py-3 text-slate-200 break-words">
                            {manager.manager}
                          </td>
                          <td className="px-2 md:px-4 py-3 text-slate-200 text-right">
                            {formatPrice(manager.teamValue || calculateTeamValue(manager.teamDetails))}
                          </td>
                          <td className="px-2 md:px-4 py-3 text-slate-200 text-right">
                            {manager.totalPoints || 0}
                          </td>
                          <td className="px-2 md:px-4 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => handleEditManager(manager.manager)}
                                className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-500 text-xs"
                                title="Edit team"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteManager(manager)}
                                className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-500 text-xs"
                                title="Delete manager"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-slate-300">
                  <p>No managers found.</p>
                  <p className="text-sm text-slate-400 mt-2">Enter a manager name above to create the first manager.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && managerToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 max-w-md mx-4">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">
                  Confirm Delete
                </h3>
                <p className="text-slate-300 mb-6">
                  Are you sure you want to delete manager <strong>"{managerToDelete.manager}"</strong>? 
                  This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteManager}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {isManagerConfirmed && (
            <>
              <div className="search-section mt-4">
                <label htmlFor="searchTerm" className="block text-sm font-medium text-slate-300">
                  Search Players
                </label>
                <input
                  type="text"
                  id="searchTerm"
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 text-slate-100 border border-slate-700 rounded-md"
                  placeholder="Input a player name to start the search...."
                />
                {searchTerm.length < 3 && (
                  <p className="text-xs italic text-slate-400 mt-1">Input 3 characters to start search</p>
                )}
              </div>
              
              {(isSearching || searchResults.length > 0) && (
                <div className="results-section mt-4">
                  {resultCount !== null && (
                    <div className="mt-4 text-center">
                      <p className="text-lg font-medium text-gray-700">
                        {resultCount} {resultCount === 1 ? 'Player' : 'Players'} Found
                      </p>
                    </div>
                  )}
                  <SearchResults 
                    results={searchResults} 
                    isLoading={isLoading} 
                    onPlayerAdded={() => {
                      setSearchTerm('');
                      // Focus the search input after clearing
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                      }, 100);
                    }}
                  />
                </div>
              )}
              
              <div className="selected-section mt-4">
                <SelectedPlayers 
                  managerId={managerData?.id} 
                  managerName={managerName}
                  onSaveComplete={handleResetAll}
                />
                <div className="debug-info mt-2 text-xs text-slate-400">
                  Debug: managerName = "{managerName}" (length: {managerName?.length || 0})
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default CaptureForm