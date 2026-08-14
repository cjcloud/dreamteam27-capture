'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-toastify'
import { uploadJsonData, checkDataExists } from '@/lib/db'
import { dbService } from '@/lib/db-service'
import { Upload, FileText, Code, CloudDownload } from 'lucide-react'
import type { PlayerData } from '@/lib/types'
import { getClubName, decodeJwtPayload, isJwtExpired } from '@/lib/utils'
import { DB_PATHS } from '@/lib/constants'

interface FileUploadProps {
  onUploadComplete?: () => void;
}

interface UploadedData extends Record<string, unknown> {
  playerData: PlayerData[];
  lastUpdated: string;
}

// Type for raw JSON data before validation
interface RawPlayerInput {
  id?: string | number;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  position?: string;
  totalPoints?: number;
  squadId?: number;
  playerClub?: string;        // 2026/27 API path: club code already resolved
  contestantFlagKey?: string; // 2026/27 API path: raw flag key
  price?: number;
  gameweekPoints?: number;
  status?: string;
  [key: string]: unknown;
}

export default function FileUpload({ onUploadComplete = () => { } }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'file' | 'paste' | 'api'>('file')
  const [jsonText, setJsonText] = useState('')
  const [token, setToken] = useState('')

  // Restore a token from the session (survives refresh, cleared on tab close).
  useEffect(() => {
    const saved = sessionStorage.getItem('dtfc-token')
    if (saved) setToken(saved)
  }, [])

  // Human-friendly note about the current token (expiry / validity).
  const tokenInfo = (() => {
    if (!token.trim()) return null
    const payload = decodeJwtPayload(token.trim())
    if (!payload || typeof payload.exp !== 'number') return { ok: false, msg: 'Not a valid token' }
    const msLeft = payload.exp * 1000 - Date.now()
    if (msLeft <= 0) return { ok: false, msg: 'Token has expired — grab a fresh one' }
    const h = Math.floor(msLeft / 3_600_000)
    const m = Math.floor((msLeft % 3_600_000) / 60_000)
    return { ok: true, msg: `Valid — expires in ${h}h ${m}m` }
  })()

  const processJsonData = async (jsonData: any) => {
    console.log('Processing JSON data:', jsonData);
    
    // Validate data structure and types
    if (!Array.isArray(jsonData)) {
      console.error('Invalid data format: Not an array', jsonData);
      throw new Error('Invalid data format: Expected an array')
    }

    console.log(`Processing array with ${jsonData.length} items`);
    
    // Validate each player has required fields
    const validatedPlayers = jsonData.map((player: RawPlayerInput, index: number): PlayerData => {
      
      // Debug first few players to see available fields for injured status
      if (index < 3) {
        console.log(`=== SAMPLE PLAYER ${index} STRUCTURE ===`);
        console.log('displayName:', player.displayName);
        console.log('Available fields:', Object.keys(player));
        console.log('status:', player.status);
        console.log('Full object:', JSON.stringify(player, null, 2));
      }
      
      // Debug Palmer specifically - broader search
      if (player.displayName && (
        player.displayName.toLowerCase().includes('palmer') ||
        player.displayName.toLowerCase().includes('cole') ||
        player.firstName?.toLowerCase().includes('cole') ||
        player.lastName?.toLowerCase().includes('palmer')
      )) {
        console.log('=== PALMER/COLE FOUND ===');
        console.log('Raw player object:', JSON.stringify(player, null, 2));
      }
      
      // Also check if this is a Chelsea player (Palmer plays for Chelsea)
      if (player.squadId === 8) {
        console.log(`Chelsea player: ${player.displayName} - status: ${player.status}`);
      }
      
      if (!player.id || !player.displayName || !player.position) {
        console.error('Invalid player data:', player);
        throw new Error('Invalid player data: Missing required fields')
      }
      
      const validatedPlayer = {
        id: player.id,
        firstName: player.firstName || '',
        lastName: player.lastName || '',
        displayName: player.displayName,
        position: player.position,
        totalPoints: player.totalPoints || 0,
        squadId: player.squadId,
        playerClub: player.playerClub || (player.squadId ? getClubName(player.squadId) : 'Unknown'),
        price: player.price || 0,
        gameweekPoints: player.gameweekPoints !== undefined ? player.gameweekPoints : null,
        status: player.status || 'playing'
      };
      
      console.log(`Player ${index} validated:`, validatedPlayer);
      console.log(`SquadId: ${player.squadId}, Club: ${validatedPlayer.playerClub}`);
      return validatedPlayer;
    })

    // Upload players directly, not wrapped in an object
    const data = validatedPlayers
    
    console.log('Final data structure to be uploaded:', data);
    console.log('Upload path:', DB_PATHS.PLAYER_DATA);
    console.log('Resolved path value:', '/1/playerData');

    // Check if data already exists
    const exists = await checkDataExists(DB_PATHS.PLAYER_DATA)
    console.log('Data already exists?', exists);
    
    if (exists) {
      const confirm = window.confirm(
        'Data already exists in the database. Do you want to overwrite it?'
      )
      if (!confirm) {
        toast.info('Upload cancelled')
        return
      }
    }

    // Rolling history: keep the last two normalised pulls (current + previous),
    // so a bad update can be rolled back and updates can be diffed.
    try {
      const prevCurrent = await dbService.get(DB_PATHS.HISTORY_CURRENT)
      if (prevCurrent) {
        await dbService.set(DB_PATHS.HISTORY_PREVIOUS, prevCurrent)
      }
      await dbService.set(DB_PATHS.HISTORY_CURRENT, data)
    } catch (histErr) {
      console.warn('History snapshot failed (continuing with upload):', histErr)
    }

    // Upload data (the live current-season pool)
    console.log('Uploading data to Firebase...');
    console.log('About to call uploadJsonData with path:', DB_PATHS.PLAYER_DATA);
    await uploadJsonData(DB_PATHS.PLAYER_DATA, data)
    console.log('Upload completed successfully');
    toast.success('Data uploaded successfully')
    onUploadComplete()
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true)
    try {
      const file = acceptedFiles[0];
      const text = await file.text();
      const jsonData = JSON.parse(text);
      await processJsonData(jsonData);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Upload error:', error)
        toast.error(error.message)
      } else {
        toast.error('Failed to upload file')
      }
    } finally {
      setUploading(false)
    }
  }, [onUploadComplete])

  const handlePasteSubmit = async () => {
    if (!jsonText.trim()) {
      toast.error('Please enter JSON data')
      return
    }

    setUploading(true)
    try {
      const jsonData = JSON.parse(jsonText);
      await processJsonData(jsonData);
      setJsonText(''); // Clear the textarea after successful upload
    } catch (error) {
      if (error instanceof Error) {
        console.error('JSON parse error:', error)
        toast.error(error.message)
      } else {
        toast.error('Failed to process JSON data')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleApiFetch = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      toast.error('Paste your Bearer token first.');
      return;
    }
    if (isJwtExpired(trimmed)) {
      toast.error('That token has expired. Log in again and paste a fresh one.');
      return;
    }

    // Remember for the rest of the session.
    sessionStorage.setItem('dtfc-token', trimmed);

    setUploading(true);
    // Abort guard so the UI never hangs indefinitely on a slow API/DB.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s
    try {
      toast.info('Fetching latest player data…');
      const response = await fetch('/api/players', {
        headers: { Authorization: `Bearer ${trimmed}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        // Token rejected/expired — clear it and prompt for a fresh one.
        sessionStorage.removeItem('dtfc-token');
        setToken('');
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Token rejected. Paste a fresh token.');
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `Fetch failed (HTTP ${response.status}).`
        );
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('The API returned no players — check the token and try again.');
      }
      toast.info(`Fetched ${data.length} players — saving to the database…`);
      // The API returns a direct array of normalised players, passed straight through.
      await processJsonData(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error(
          'Timed out after 90s — the API or database was too slow to respond. Please try again.'
        );
      } else if (error instanceof Error) {
        console.error('API fetch error:', error);
        toast.error(error.message);
      } else {
        toast.error('An unknown error occurred while fetching data.');
      }
    } finally {
      clearTimeout(timeoutId);
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json']
    },
    multiple: false
  })

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('file')}
          className={`py-2 px-4 flex items-center gap-2 ${activeTab === 'file'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          <FileText className="w-4 h-4" />
          Upload File
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`py-2 px-4 flex items-center gap-2 ${activeTab === 'paste'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-400'
            }`}
        >
          <Code className="w-4 h-4" />
          Paste JSON
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`py-2 px-4 flex items-center gap-2 ${activeTab === 'api'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-400'
            }`}
        >
          <CloudDownload className="w-4 h-4" />
          Fetch from API
        </button>
      </div>

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-gray-400 bg-gray-200' : 'border-gray-400 hover:border-slate-500'}`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          {uploading ? (
            <p className="text-gray-600">Uploading...</p>
          ) : isDragActive ? (
            <p className="text-blue-500">Drop the JSON file here</p>
          ) : (
            <div>
              <p className="text-gray-600">Drag and drop a JSON file here, or click to select</p>
              <p className="text-sm text-gray-500 mt-2">Only .json files are accepted</p>
            </div>
          )}
        </div>
      )}

      {/* JSON Paste Tab */}
      {activeTab === 'paste' && (
        <div className="space-y-4">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Paste your JSON data here..."
            className="w-full h-64 p-4 border border-gray-900 rounded-lg font-mono text-sm text-slate-700"
            disabled={uploading}
          />
          <button
            onClick={handlePasteSubmit}
            disabled={uploading || !jsonText.trim()}
            className={`w-full py-2 px-4 rounded-md text-white font-medium flex items-center justify-center gap-2 ${uploading || !jsonText.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {uploading ? 'Processing...' : 'Upload JSON Data'}
          </button>
        </div>
      )}

      {/* API Fetch Tab */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <p className="text-gray-600 text-center">
            Paste a fresh Bearer token, then fetch the latest player data directly from the source.
          </p>

          <div className="space-y-1">
            <label htmlFor="dtfc-token" className="block text-sm font-medium text-gray-700">
              Bearer token
            </label>
            <input
              id="dtfc-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOi… (from DevTools → Network → any /api call → Authorization)"
              autoComplete="off"
              spellCheck={false}
              className="w-full p-2 border border-gray-400 rounded-md font-mono text-xs text-slate-700"
              disabled={uploading}
            />
            {tokenInfo && (
              <p className={`text-xs ${tokenInfo.ok ? 'text-green-600' : 'text-red-600'}`}>
                {tokenInfo.msg}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Held for this session only — never saved to disk or committed.
            </p>
          </div>

          <button
            onClick={handleApiFetch}
            disabled={uploading || !token.trim() || (tokenInfo ? !tokenInfo.ok : false)}
            className={`w-full py-2 px-4 rounded-md text-white font-medium flex items-center justify-center gap-2 ${
              uploading || !token.trim() || (tokenInfo ? !tokenInfo.ok : false)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {uploading ? 'Fetching & Processing...' : 'Fetch Latest Player Data'}
          </button>
        </div>
      )}
    </div>
  )
}
