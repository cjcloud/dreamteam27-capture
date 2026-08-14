'use client'

import React from 'react'
import { ArrowUp, ArrowDown, ChevronsRightLeft } from 'lucide-react'

type Manager = {
  managerId?: string;
  name?: string;
  manager?: string;
  players?: any[];
  teamDetails?: any[];
  totalPoints?: number;
  gameWeekPoints?: number;
  posNow?: number;
  posLast?: number;
}

export function LeagueTable({ data }: { data: Manager[] }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-200 italic">No league data available.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-3/4 md:min-w-1/2 bg-white">
        <thead className="bg-gray-800 text-white">
          <tr>
            <th className="py-1 px-3 text-center text-sm">Now</th>
            <th className="py-1 px-3 text-center text-sm">Prev</th>
            <th className="py-1 px-3 text-left text-sm">Manager</th>
            <th className="py-1 px-3 text-center text-sm">Week Pts</th>
            <th className="py-1 px-3 text-center text-sm">Total</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {data.map((manager, index) => {
            const positionChange = (manager.posLast || 0) - (manager.posNow || 0);
            
            return (
              <tr key={manager.managerId || index} className={(index + 1) % 2 === 0 ? 'bg-gray-200' : 'bg-slate-50'}>
                <td className="py-1 px-3 text-center text-slate-800">{manager.posNow}</td>
                <td className="py-1 px-3 text-center text-slate-800">
                  <div className="flex items-center justify-center">
                    {manager.posLast}
                    {positionChange > 0 && (
                      <ArrowUp className="ml-1 h-3 w-3 text-green-500" />
                    )}
                    {positionChange < 0 && (
                      <ArrowDown className="ml-1 h-3 w-3 text-red-500" />
                    )}
                    {positionChange === 0 && (
                      <ChevronsRightLeft className="ml-1 h-3 w-3 text-gray-500" />
                    )}
                  </div>
                </td>
                <td className="py-1 px-3 text-left text-slate-800">{manager.name || manager.manager || 'Unknown'}</td>
                <td className="py-1 px-3 text-center font-medium text-slate-800">{manager.gameWeekPoints || 0}</td>
                <td className="py-1 px-3 text-center font-bold text-slate-800">{manager.totalPoints || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
