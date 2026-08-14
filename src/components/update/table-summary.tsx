import React from 'react'

interface PlayerDetails {
  gwpts: number;
  gwtotalPts: number;
  playerClub: string;
  playerDNP: boolean;
  playerName: string;
  playerPosition: string;
}

interface TeamPlayer {
  playerDetails: PlayerDetails;
  playerId: number;
}

interface Manager {
  managerId: number;
  manager: string;
  teamDetails: TeamPlayer[];
  totalPoints: number;
  gameWeekPoints: number;
  posNow: number;
  posLast: number;
}

interface TableSummaryProps {
  leagueData: Manager[]
  dateUpdated?: string
}

const TableSummary = ({ leagueData, dateUpdated }: TableSummaryProps) => {
  if (!leagueData?.length) {
    return null
  }

  return (
    <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden">
      {dateUpdated && (
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-600">
            Last updated: {dateUpdated}
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-[#B8D4E8] text-black">
              <th className="px-6 py-3 text-left text-sm font-semibold">Prev</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Now</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Manager</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Week Pts</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Season Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leagueData.map((manager, index) => {
              // Fix position change calculation
              // If posLast is higher than posNow, they've moved up (improved)
              // If posLast is lower than posNow, they've moved down (got worse)
              const positionChange = manager.posLast - manager.posNow
              let arrow = '⯀'  // No change
              let arrowColor = 'text-gray-500'

              if (positionChange < 0) {
                // posLast (e.g., 2) - posNow (e.g., 3) = -1 means moved down
                arrow = '▼'
                arrowColor = 'text-red-500'
              } else if (positionChange > 0) {
                // posLast (e.g., 3) - posNow (e.g., 2) = 1 means moved up
                arrow = '▲'
                arrowColor = 'text-green-500'
              }

              // Calculate total points from teamDetails if not already set
              const totalPoints = manager.totalPoints || manager.teamDetails?.reduce((sum, player) => {
                return sum + (player.playerDetails?.gwtotalPts || 0)
              }, 0) || 0

              return (
                <>
                  <tr 
                    key={`${manager.managerId}-${index}`} 
                    className={index % 2 === 0 ? 'bg-[#E8E8E8]' : 'bg-[#F4F4F4]'}
                  >
                    {/* Add header row for each manager */}
                    <td colSpan={5} className="p-0">
                      <div className="flex items-center justify-between bg-[#1a1f2e] text-white p-4">
                        <span className="text-[#ff9933] text-2xl font-bold">
                          {manager.manager}
                        </span>
                        <div className="flex items-center">
                          <span className="text-[#a8b4cc] mr-2">Current Position:</span>
                          <div className="bg-[#40c4ff] text-black font-bold text-2xl w-12 h-12 flex items-center justify-center clip-triangle">
                            {manager.posNow}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr className={index % 2 === 0 ? 'bg-[#E8E8E8]' : 'bg-[#F4F4F4]'}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {manager.posLast}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-900">{manager.posNow}</span>
                        <span className={arrowColor}>{arrow}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {manager.manager}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 font-medium">
                      {manager.gameWeekPoints}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      {totalPoints}
                    </td>
                  </tr>
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TableSummary
