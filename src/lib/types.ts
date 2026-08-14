export interface PlayerStatusDetails {
  startDate?: string;
  endDate?: string | null;
  description?: string;
}

export interface PlayerData {
  id: number | string;
  firstName: string;
  lastName: string;
  displayName: string;
  position: string;
  totalPoints: number;
  squadId?: number;
  playerClub: string;
  price: number;
  gameweekPoints: number | null;
  status: string;
}

export interface Player extends PlayerData {
  statusDetails: PlayerStatusDetails | null;
  averagePoints: number;
  bonusPoints: number;
  last3Average: number;
  percentSelected: number;
  priceChange: number;
  weeklyPoints?: number;
  lastPoints?: number;
}

export interface PlayerDetails {
  gwpts: number;
  gwtotalPts: number;
  playerClub: string;
  playerDNP: boolean;
  playerName: string;
  playerPosition: string;
  price?: number;  // Make price optional since it might not exist in old data
  squadId?: number;  // Make squadId optional since it might not exist in old data
}

export interface TeamPlayer {
  playerDetails: PlayerDetails;
  playerId: number | string; // 2026/27: player ids are UUID strings (legacy data was numeric)
}

export interface Manager {
  managerId: number;
  manager: string;
  players: Player[];
  totalPoints: number;
  gameWeekPoints: number;
  posNow: number;
  posLast: number;
  teamDetails?: TeamPlayer[];  
}
