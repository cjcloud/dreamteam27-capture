'use client'

import React from 'react'

interface ManagerInputProps {
  managerName: string
  isCheckingManager: boolean
  isManagerConfirmed: boolean
  managerExists?: boolean
  foundManagerName?: string
  showCreatePrompt?: boolean
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onConfirm?: () => void
  onCancelEdit?: () => void
  onCreateManager?: () => void
  isLoading?: boolean
}

const ManagerInput: React.FC<ManagerInputProps> = ({
  managerName,
  isCheckingManager,
  isManagerConfirmed,
  managerExists = false,
  foundManagerName,
  showCreatePrompt = false,
  onNameChange,
  onConfirm,
  onCancelEdit,
  onCreateManager,
  isLoading = false
}) => {
  return (
    <div className="space-y-2">
      <label htmlFor="managerName" className="block text-sm font-medium text-slate-800">
        Enter Manager Name
      </label>
      <div className="relative">
        <input
          type="text"
          name="managerName"
          id="managerName"
          value={managerName}
          onChange={onNameChange}
          disabled={isManagerConfirmed || isLoading} 
          className={`
            w-full px-4 py-2 
            bg-slate-900 text-slate-100
            border ${managerExists ? 'border-green-500' : 'border-slate-700'}
            rounded-md shadow-sm
            placeholder:text-slate-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
          `}
          placeholder="Enter manager name (min 3 characters)"
          autoComplete="off"
        />
        {isCheckingManager && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent" />
          </div>
        )}
        {managerExists && !isManagerConfirmed && !isCheckingManager && (
          <div className="absolute right-3 top-2.5">
            <div className="h-5 w-5 text-green-500">✓</div>
          </div>
        )}
      </div>
      
      {isCheckingManager && (
        <p className="text-sm text-slate-400">
          Checking manager...
        </p>
      )}
      
      {managerExists && !isManagerConfirmed && foundManagerName && !isCheckingManager && (
        <div className="flex items-center justify-between text-sm mt-2 bg-slate-900/50 p-2 rounded-md">
          <p className="text-green-400 flex items-center gap-2">
            <span>Found manager:</span>
            <span className="font-medium">{foundManagerName}</span>
          </p>
          <div className="flex gap-2">
            {onConfirm && (
              <button
                onClick={onConfirm}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-400 text-white rounded-md transition-colors duration-200"
              >
                Edit Team
              </button>
            )}
            <button
              onClick={() => onNameChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
              className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {showCreatePrompt && !isManagerConfirmed && !isCheckingManager && managerName.length >= 3 && (
        <div className="flex items-center justify-between text-sm mt-2 bg-slate-900/50 p-2 rounded-md">
          <p className="text-slate-300">
            Do you wish to create a new manager?
          </p>
          <div className="flex gap-2">
            {onCreateManager && (
              <button
                onClick={onCreateManager}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors duration-200"
              >
                YES
              </button>
            )}
            <button
              onClick={() => onNameChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
              className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors duration-200"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
      
      {isManagerConfirmed && onCancelEdit && (
        <div className="flex justify-end">
          <button
            onClick={onCancelEdit}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors duration-200"
          >
            Cancel Edit
          </button>
        </div>
      )}
    </div>
  )
}

export default ManagerInput
