import { toast } from 'react-toastify';

/**
 * Client-side service for interacting with the Firebase Admin SDK via API routes
 * This allows secure database operations without exposing Firebase credentials to the client
 */

// Interface for API responses
interface DbApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Get the base URL for API requests (handles both development and production)
const getApiUrl = () => {
  // In the browser, use absolute URL which works in both dev and production
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/db`;
};

export const dbService = {
  /**
   * Get data from a specific path in the database
   * @param path The path to get data from
   * @returns The data at the specified path
   */
  async get(path: string): Promise<any> {
    try {
      console.log(`[dbService] Getting data from path: ${path}`);
      const apiUrl = getApiUrl();
      console.log(`[dbService] Using API URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          operation: 'get',
          path,
        }),
      });

      // Check if the response is ok (status in the range 200-299)
      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        console.error(`[dbService] API error: ${statusText}`);
        toast.error(`Database error: ${statusText}`);
        return null;
      }

      // Parse the response
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('[dbService] Failed to parse response:', parseError);
        toast.error('Failed to parse server response');
        return null;
      }

      // Check if the operation was successful
      if (!responseData.success) {
        console.error('[dbService] Operation failed:', responseData.error);
        toast.error(`Database error: ${responseData.error || 'Unknown error'}`);
        return null;
      }

      return responseData.data;
    } catch (error) {
      console.error('[dbService] Error in get operation:', error);
      toast.error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  },

  /**
   * Set data at a specific path in the database
   * @param path The path to set data at
   * @param data The data to set
   */
  async set(path: string, data: any): Promise<DbApiResponse> {
    try {
      console.log(`[dbService] Setting data at path: ${path}`);
      const apiUrl = getApiUrl();
      console.log(`[dbService] Using API URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          operation: 'set',
          path,
          data,
        }),
      });

      // Check if the response is ok (status in the range 200-299)
      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        console.error(`[dbService] API error: ${statusText}`);
        toast.error(`Database error: ${statusText}`);
        return {
          success: false,
          error: statusText,
        };
      }

      // Parse the response
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('[dbService] Failed to parse response:', parseError);
        toast.error('Failed to parse server response');
        return {
          success: false,
          error: 'Failed to parse server response',
        };
      }

      // Check if the operation was successful
      if (!responseData.success) {
        console.error('[dbService] Operation failed:', responseData.error);
        toast.error(`Database error: ${responseData.error || 'Unknown error'}`);
        return responseData;
      }

      return responseData;
    } catch (error) {
      console.error('[dbService] Error in set operation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Database error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Update data at a specific path in the database
   * @param path The path to update data at
   * @param data The data to update
   */
  async update(path: string, data: any): Promise<DbApiResponse> {
    try {
      console.log(`[dbService] Updating data at path: ${path}`);
      const apiUrl = getApiUrl();
      console.log(`[dbService] Using API URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          operation: 'update',
          path,
          data,
        }),
      });

      // Check if the response is ok (status in the range 200-299)
      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        console.error(`[dbService] API error: ${statusText}`);
        toast.error(`Database error: ${statusText}`);
        return {
          success: false,
          error: statusText,
        };
      }

      // Parse the response
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('[dbService] Failed to parse response:', parseError);
        toast.error('Failed to parse server response');
        return {
          success: false,
          error: 'Failed to parse server response',
        };
      }

      // Check if the operation was successful
      if (!responseData.success) {
        console.error('[dbService] Operation failed:', responseData.error);
        toast.error(`Database error: ${responseData.error || 'Unknown error'}`);
        return responseData;
      }

      return responseData;
    } catch (error) {
      console.error('[dbService] Error in update operation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Database error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Remove data at a specific path in the database
   * @param path The path to remove data from
   */
  async remove(path: string): Promise<DbApiResponse> {
    try {
      console.log(`[dbService] Removing data at path: ${path}`);
      const apiUrl = getApiUrl();
      console.log(`[dbService] Using API URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          operation: 'remove',
          path,
        }),
      });

      // Check if the response is ok (status in the range 200-299)
      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        console.error(`[dbService] API error: ${statusText}`);
        toast.error(`Database error: ${statusText}`);
        return {
          success: false,
          error: statusText,
        };
      }

      // Parse the response
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('[dbService] Failed to parse response:', parseError);
        toast.error('Failed to parse server response');
        return {
          success: false,
          error: 'Failed to parse server response',
        };
      }

      // Check if the operation was successful
      if (!responseData.success) {
        console.error('[dbService] Operation failed:', responseData.error);
        toast.error(`Database error: ${responseData.error || 'Unknown error'}`);
        return responseData;
      }

      return responseData;
    } catch (error) {
      console.error('[dbService] Error in remove operation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Database error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};
