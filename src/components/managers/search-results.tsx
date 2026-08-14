'use client'

import { useCart } from 'react-use-cart'
import { toast } from 'react-toastify'
import type { SearchResult } from './types'
import ClubShirt from '@/components/ClubShirt'
import { APP_CONSTANTS } from '@/lib/constants'

// Max of each position across all allowed formations (GK 1; DEF/MID 3–5; STR 1–3).
const POSITION_MAX: Record<string, number> = { GK: 1, DEF: 5, MID: 5, STR: 3 };
const POSITION_LABEL: Record<string, string> = {
  GK: 'goalkeeper', DEF: 'defenders', MID: 'midfielders', STR: 'strikers',
};

interface SearchResultsProps {
  results: any[]
  isLoading?: boolean
  onPlayerAdded?: () => void
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading = false,
  onPlayerAdded
}) => {
  const { addItem, items } = useCart()
  
  // Debug cart hook behavior
  console.log('🔍 SearchResults useCart hook:', {
    itemsCount: items?.length || 0,
    itemsArray: items,
    addItemFunction: typeof addItem,
    timestamp: new Date().toISOString()
  });
  
  // Debug the incoming results prop
  console.log('SearchResults component received:', { 
    resultsProvided: results ? true : false,
    resultsLength: results ? results.length : 0,
    resultsType: typeof results,
    isArray: Array.isArray(results),
    results: results
  });
  
  // Format price to £X.XM format - price is already in X.X format string
  const formatPrice = (price: string | number): string => {
    if (price === undefined || price === null) return '£0.0M'

    // Helper to convert any numeric value to millions
    const toMillions = (value: number): string => {
      // If value is already in millions (< 100 most FPL prices) just use it
      const millions = value > 100 ? value / 1_000_000 : value
      return `£${millions.toFixed(1)}M`
    }

    // If price is already a formatted string like "£4.5M" or even a very large one
    if (typeof price === 'string') {
      const trimmed = price.trim()
      // Extract numeric part regardless of existing suffixes
      const match = trimmed.match(/£?([\d.]+)/)
      if (match) {
        const num = parseFloat(match[1])
        if (!isNaN(num)) {
          return toMillions(num)
        }
      }
      // Fallback
      return price.startsWith('£') ? price : `£${price}`
    }

    // Handle numeric values
    const numericPrice = parseFloat(String(price))
    if (isNaN(numericPrice)) return '£0.0M'
    return toMillions(numericPrice)
  }

  // Check if player is already in cart
  const isPlayerInCart = (playerId: string | number): boolean => {
    if (!items || !Array.isArray(items)) return false;
    return items.some(item => item.id === playerId);
  };
  
  // Handle adding player to cart — enforces the rules at entry (hard block).
  const handleAddPlayer = (player: any) => {
    const currentItems = Array.isArray(items) ? items : [];

    // No duplicates (the Add button is also disabled for selected players).
    if (currentItems.some((it: any) => it.id === player.id)) return;

    // Current squad make-up: position counts and total value (£M).
    const counts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, STR: 0 };
    let currentTotal = 0;
    currentItems.forEach((it: any) => {
      if (counts[it.position] !== undefined) counts[it.position] += 1;
      const p =
        typeof it.rawPrice === 'number'
          ? it.rawPrice
          : typeof it.price === 'number'
          ? it.price
          : 0;
      currentTotal += p;
    });

    // This player's price in £M (handles "£4.5M", "4.5", or raw 4500000).
    let rawPrice = 0;
    if (player.price !== undefined && player.price !== null) {
      if (typeof player.price === 'string') {
        const match = player.price.match(/[\d.]+/);
        if (match) rawPrice = parseFloat(match[0]);
      } else if (typeof player.price === 'number') {
        rawPrice = player.price;
      }
    }
    const rawPriceMillions = rawPrice > 100 ? rawPrice / 1_000_000 : rawPrice;

    // --- Entry-stage rules (hard block, with advisory) ---
    const pos = player.position;

    if (currentItems.length >= APP_CONSTANTS.MAX_PLAYERS) {
      toast.error(`Team is full — ${APP_CONSTANTS.MAX_PLAYERS} players already selected.`);
      return;
    }
    if (POSITION_MAX[pos] !== undefined && counts[pos] >= POSITION_MAX[pos]) {
      toast.error(
        `Cannot add ${player.displayName} — max ${POSITION_MAX[pos]} ${POSITION_LABEL[pos]} allowed (already have ${counts[pos]}).`
      );
      return;
    }
    if (currentTotal + rawPriceMillions > APP_CONSTANTS.BUDGET_LIMIT) {
      toast.error(
        `Cannot add ${player.displayName} — that would make the team £${(
          currentTotal + rawPriceMillions
        ).toFixed(1)}M, over the £${APP_CONSTANTS.BUDGET_LIMIT.toFixed(0)}M budget.`
      );
      return;
    }

    try {
      addItem({
        id: player.id,
        displayName: player.displayName,
        position: player.position,
        playerClub: player.playerClub,
        price: rawPriceMillions,
        rawPrice: rawPriceMillions,
      });
      if (onPlayerAdded) onPlayerAdded();
    } catch (error) {
      console.error('Error adding player to cart:', error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-4 text-slate-300">Loading results...</div>;
  }

  return (
    <div className="rounded-lg overflow-hidden">
      <table className="w-full text-sm bg-slate-100">
        <thead>
          <tr className="bg-slate-300 text-slate-800">
            <th className="text-left font-normal px-3 py-2 rounded-tl-lg">Player</th>
            <th className="text-center font-normal px-3 py-2">Position</th>
            <th className="text-center font-normal px-3 py-2">Club</th>
            <th className="text-right font-normal px-3 py-2">Price</th>
            <th className="text-left font-normal px-3 py-2 rounded-tr-lg"></th>
          </tr>
        </thead>
        <tbody>
          {/* Debug output for results array */}
          {!results || results.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-slate-500 rounded-bl-lg rounded-br-lg">
                No results found. Try a different search term.
                {/* <div className="text-xs text-red-500 mt-1">
                  Debug: Results is {results ? `an array with length ${results.length}` : 'null or undefined'}
                </div> */}
              </td>
            </tr>
          ) : (
            results.map((player, index) => (
              <tr 
                key={player.id}
                className={`text-sm ${index % 2 === 1 ? 'bg-slate-200' : ''}`}
              >
                <td className="text-slate-800 font-semibold px-3 py-2">
                  {player.displayName || player.name}
                </td>
                <td className="text-center text-slate-800 px-3 py-2">
                  {player.position || '-'}
                </td>
                <td className="text-center text-slate-800 px-3 py-2">
                  <span className="inline-flex items-center justify-center gap-1">
                    <ClubShirt club={player.playerClub} position={player.position} size={18} />
                    {player.playerClub || '-'}
                  </span>
                </td>
                <td className="text-right text-slate-800 px-3 py-2">
                  {/* Add debug output for price data */}
                  {formatPrice(player.price)}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => {
                      console.log('Add button clicked for player:', player);
                      handleAddPlayer(player);
                    }}
                    disabled={isPlayerInCart(player.id)}
                    className={`px-2 py-1 rounded text-xs ${
                      isPlayerInCart(player.id)
                        ? 'bg-green-100 text-green-600 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                  >
                    {isPlayerInCart(player.id) ? 'Selected' : 'Add'}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default SearchResults
