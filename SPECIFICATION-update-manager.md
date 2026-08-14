# Update Manager Component Specification

## Overview
The `update-manager.tsx` component is a core module of the DT Capture application responsible for synchronizing manager team data with the latest player statistics, managing league positions, and providing an interface for updating individual manager teams.

## Component Purpose
- **Primary Function**: Sync manager team data with current player statistics from the database
- **Secondary Functions**: Display league tables, manage individual manager teams, handle player cart operations
- **Data Flow**: Reads from `db/0` (managers) and `db/1/playerData`, processes and updates manager teams

## Architecture

### File Location
`src/components/update/update-manager.tsx`

### Dependencies
```typescript
// React & Next.js
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Internal Services
import { useAuth } from '@/lib/auth-context'
import { useCart } from 'react-use-cart'
import { dbService } from '@/lib/db-service'
import { DB_PATHS, APP_CONSTANTS } from '@/lib/constants'
import { getClubName } from '@/lib/utils'

// UI Components
import { LeagueTable } from '@/components/league-table'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import SelectedPlayers from '@/components/managers/selected-players'

// Icons & Notifications
import { ChevronRight, ArrowUp, ArrowDown, ChevronsRightLeft } from 'lucide-react'
import { toast } from 'react-toastify'
```

## Data Types & Interfaces

### Core Types
```typescript
type PlayerDetails = {
  gwpts: number;                    // Gameweek points
  gwtotalPts: number;              // Total points
  playerinjured: boolean;          // Injury status
  playerSuspended: boolean;        // Suspension status
  playerDNP: boolean;              // Whether player did not play
  playerName?: string;             // Player display name
  playerPosition?: string;         // Player position
  playerClub?: string;            // Player club abbreviation
  playerValue?: number | string;   // Player price/value
  [key: string]: any;             // Additional dynamic properties
}

type TeamPlayer = {
  playerId: string;               // Unique player identifier
  playerDetails: PlayerDetails;   // Player statistics and details
  [key: string]: any;            // Additional dynamic properties
}

type Manager = {
  managerId: string;              // Unique manager identifier
  name?: string;                  // Manager display name
  manager?: string;               // Alternative manager name field
  players?: any[];               // Legacy player array
  teamDetails?: any[];           // Current team composition
  totalPoints?: number;          // Manager's total points
  gameWeekPoints?: number;       // Manager's current gameweek points
  posNow?: number;              // Current league position
  posLast?: number;             // Previous league position
}

type PlayerData = {
  id: string;                    // Player ID
  gameweekPoints?: number;       // Current gameweek points (null = didn't play)
  totalPoints?: number;          // Season total points
  status?: string;               // Player status: 'playing', 'injured', 'suspended', 'eliminated'
  displayName?: string;          // Player display name
  position?: string;             // Player position
  squadId?: number;             // Club/squad identifier
  playerClub?: string;          // Club name/abbreviation
  suspensionDetails?: object;    // Suspension details if suspended
  injuryDetails?: object;        // Injury details if injured
  [key: string]: any;           // Additional API fields
}
```

## Database Schema

### Data Paths
- **Managers**: `db/0` - Array of Manager objects
- **Player Data**: `db/1/playerData` - Array or Object of PlayerData
- **Last Updated**: `db/2/0` - Timestamp of last sync

### Data Flow
1. **Upload Page** → `db/1/playerData` (manual data entry/API import)
2. **Update Manager** → Reads `db/0` + `db/1/playerData` → Updates `db/0`
3. **Capture Form** → Reads `db/1/playerData` for player searches

## Core Functions

### 1. Data Fetching (`fetchData`)
**Purpose**: Load manager data and initialize component state
**Triggers**: Component mount, authentication changes
**Process**:
- Validates user authentication
- Fetches manager data from `db/0`
- Processes and filters valid managers
- Sets selected manager if specified in URL params
- Sorts managers by total points for league table
- Fetches last updated timestamp

### 2. Player Data Synchronization (`updateManagersWithPlayerData`)
**Purpose**: Core sync function that updates all manager teams with latest player data
**Process**:
1. **Data Retrieval**
   - Fetch managers from `db/0`
   - Fetch player data from `db/1/playerData`
   - Build player lookup map (handles both array and object structures)

2. **Player Data Processing** (`updatePlayer` helper)
   - Normalize player IDs to strings for consistent lookup
   - Update player statistics (points, totals)
   - Set status flags from `status` field:
     - `playerinjured = (status === 'injured')`
     - `playerSuspended = (status === 'suspended')`
     - `playereliminated = (status === 'eliminated')`
   - **Player Availability Logic**:
     - Available = not injured AND not suspended AND not eliminated
     - If available + gameweekPoints = null → playerDNP = true (didn't play)
     - If available + gameweekPoints = 0+ → playerDNP = false (did play)
     - If not available → playerDNP = true (didn't play)
   - Translate squadId to club names using `getClubName()`
   - Accumulate team totals

3. **Manager Processing**
   - Handle both array and object team structures
   - Calculate total points and gameweek points
   - Update all player details within each manager's team

4. **League Position Calculation**
   - Sort managers by total points (descending)
   - Assign current positions
   - Preserve previous positions for comparison

5. **Data Persistence**
   - Save updated managers to `db/0`
   - Update timestamp in `db/2/0`
   - Refresh component state

### 3. Team Cart Management (`loadTeamToCart`)
**Purpose**: Load a manager's saved team into the shopping cart interface
**Process**:
- Clear existing cart items
- Convert saved team data to cart-compatible format
- Handle price formatting and data normalization
- Add items to cart with proper structure

### 4. Utility Functions
- **`formatDate`**: Convert timestamps to readable format
- **`getOrdinal`**: Add ordinal suffixes to numbers (1st, 2nd, 3rd)
- **`handleRemovePlayer`**: Remove players from cart
- **`renderError`**: Display error messages

## Player Availability Logic (Core Business Rule)

### Status Field Mapping
```typescript
playerinjured = (playerInfo.status === 'injured');
playerSuspended = (playerInfo.status === 'suspended');
playereliminated = (playerInfo.status === 'eliminated');
```

### Availability Determination
```typescript
const isAvailable = !playerinjured && !playerSuspended && !playereliminated;
```

### Play Status Logic
```typescript
if (isAvailable) {
  if (gameweekPoints === null || gameweekPoints === undefined) {
    playerDNP = true;   // Available but didn't play
  } else {
    playerDNP = false;  // Available and played (0+ points)
  }
} else {
  playerDNP = true;     // Not available = didn't play
}
```

### Business Rules
- **Status = 'playing'**: Player is available to play
- **Status = 'injured'**: Player is injured (playerinjured = true)
- **Status = 'suspended'**: Player is suspended (playerSuspended = true)  
- **Status = 'eliminated'**: Player is eliminated (playereliminated = true)
- **Available + null points** = Player was fit but didn't feature in match (playerDNP = true)
- **Available + 0+ points** = Player was fit and played (playerDNP = false)
- **Unavailable** = Player couldn't play due to injury/suspension/elimination (playerDNP = true)

## Component States

### Loading States
- `isLoading`: Initial data fetch
- `isUpdatingPlayers`: Player data sync in progress

### Data States
- `thisData`: Raw manager data
- `selectedManager`: Currently viewed manager
- `leagueData`: Sorted managers for league table
- `lastUpdated`: Formatted timestamp string

### Error Handling
- `error`: Error message state
- Toast notifications for success/failure
- Graceful fallbacks for missing data

## UI Structure

### Manager Selection View
- Manager list/selection interface
- League table display
- Global sync controls

### Individual Manager View
- Manager details panel
- Selected players table (via `SelectedPlayers` component)
- Player data sync controls
- League position display

### Key UI Elements
- **Sync Button**: Triggers `updateManagersWithPlayerData`
- **League Table**: Shows current standings with position changes
- **Selected Players**: Interactive team management interface
- **Last Updated**: Timestamp display for data freshness

## Integration Points

### External Components
- **`SelectedPlayers`**: Team management interface
- **`LeagueTable`**: League standings display
- **`useCart`**: Shopping cart functionality for team building

### Services
- **`dbService`**: Database operations
- **`useAuth`**: Authentication context
- **`getClubName`**: Club name translation utility

## Error Handling & Edge Cases

### Data Validation
- Null/undefined manager checks
- Array vs object team structure handling
- Missing player data graceful degradation
- Invalid timestamp handling

### User Experience
- Loading spinners during operations
- Toast notifications for feedback
- Error message display
- Graceful authentication redirects

## Performance Considerations

### Optimization Strategies
- Memoized callbacks with `useCallback`
- Efficient player lookup maps
- Batch database operations
- Conditional re-renders

### Data Processing
- Single-pass manager updates
- Efficient sorting algorithms
- Minimal state updates

## Future Extension Points

### Potential Enhancements
- Real-time data sync
- Batch manager operations
- Advanced filtering/search
- Export functionality
- Historical data tracking

### Architectural Considerations
- Component splitting for larger teams
- Caching strategies for player data
- WebSocket integration for live updates
- API rate limiting handling

## Testing Considerations

### Key Test Scenarios
- Player availability logic with various data states
- Manager data sync with missing/invalid data
- League position calculations
- Cart integration functionality
- Authentication flow handling

### Mock Data Requirements
- Sample manager objects with various team structures
- Player data with different availability states
- Timestamp data for last updated functionality

## Version History & Changes

### Recent Updates
- Replaced `playerPlayed` with `playerDNP` boolean field to track when players did not play
- Implemented comprehensive player availability logic using playerDNP
- Enhanced error handling for null manager data
- Improved club name translation integration

This specification serves as the definitive guide for understanding, maintaining, and extending the Update Manager component within the DT Capture application ecosystem.
