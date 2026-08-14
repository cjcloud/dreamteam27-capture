import { CartItem } from 'react-use-cart'
import type { Player, Manager, TeamPlayer, PlayerStatusDetails } from '@/lib/types'

// Extend CartItem with any additional properties we need
export type Position = 'GK' | 'DEF' | 'MID' | 'STR';

export interface SearchResult {
  id: string | number
  displayName: string
  position: Position
  playerClub: string
  price: string  // Always a string in X.X format
}

export interface ExtendedCartItem extends SearchResult {
    originalId?: string | number;  // Original player ID before making unique
    squadId: number;
    gameweekPoints?: number | null;
    statusDetails?: string | null;
    totalPoints?: number;
    quantity: number;  
    [key: string]: any  // Allow any additional string-indexed properties
}

// Props for the CaptureForm component
export interface CaptureFormProps {
    onResetCart: () => Promise<void>;
    onSaveItems?: (items: ExtendedCartItem[]) => void;
    pendingItems?: ExtendedCartItem[];
}

// Props for the SelectedPlayers component
export interface SelectedPlayersProps {
    items: ExtendedCartItem[]
    sortedItems: ExtendedCartItem[]
    onRemovePlayer: (playerId: string | number) => void
    onConfirmTeam: () => void
    onResetCart: () => Promise<void>
    isSubmitting: boolean
    MAX_PLAYERS: number
    teamValue: number
    BUDGET_LIMIT: number
    isTeamModified: boolean
    onUpdateTeam: () => Promise<void>
    onCancelChanges: () => Promise<void>
    managerName?: string
}

// Props for the CancelConfirmModal component
export interface CancelConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
}

// Props for the ManagerInput component
export interface ManagerInputProps {
    managerName: string
    onManagerNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    isManagerConfirmed: boolean
    isCheckingManager: boolean
    managerExists: boolean
    onEditManager: () => void
    onConfirmManager: () => void
    onCancel: () => void
    onShowCancelConfirm: () => void
    isLoading: boolean
}

// Props for the SearchResults component
export interface SearchResultsProps {
    searchTerm: string
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    isSearching: boolean
    searchResults: SearchResult[]
    onAddPlayer: (player: SearchResult) => void
    items: ExtendedCartItem[]
    isManagerConfirmed: boolean
}

// Extended Manager type
export interface ExtendedManager extends Omit<Manager, 'teamDetails'> {
    teamDetails?: TeamPlayer[]
}

// Extend CartContextValue type to include emptyCart
export type ExtendedCartContextValue<T extends CartItem> = import('react-use-cart').CartContextValue<T> & {
    emptyCart: () => void;
}

// Database types
export interface DbPlayer extends SearchResult {
  managerId: number
  teamId: number
}

export interface DbManager {
  managerId: number
  manager: string
  players: DbPlayer[]
  teamDetails: any[] // TODO: Define proper type
  posNow: number
  posLast: number
}

export interface ManagerLookupResult {
  found: boolean
  index: number
  error?: string
  data?: DbManager
}

export interface TeamLoadResult {
  success: boolean
  error?: string
  players?: DbPlayer[]
}
