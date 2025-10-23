import { useState, useEffect, useCallback } from 'react';
import { getBackendURL, invalidateBackendURLCache } from '../constants/env';
import NetworkDiscoveryService from '../services/network-discovery.service';

export interface BackendConnectionState {
  url: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

export const useBackendDiscovery = () => {
  const [state, setState] = useState<BackendConnectionState>({
    url: null,
    isConnected: false,
    isLoading: true,
    error: null,
    lastChecked: null,
  });

  const discoverBackend = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('🔍 Starting backend discovery...');
      
      const networkService = NetworkDiscoveryService.getInstance();
      const discoveredURL = await networkService.findWorkingBackend(3000);
      
      if (discoveredURL) {
        console.log('✅ Backend discovered:', discoveredURL);
        setState({
          url: discoveredURL,
          isConnected: true,
          isLoading: false,
          error: null,
          lastChecked: new Date(),
        });
      } else {
        console.log('❌ No backend found');
        setState({
          url: null,
          isConnected: false,
          isLoading: false,
          error: 'No working backend found',
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      console.error('❌ Backend discovery error:', error);
      setState({
        url: null,
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date(),
      });
    }
  }, []);

  const refreshBackend = useCallback(async () => {
    console.log('🔄 Refreshing backend connection...');
    invalidateBackendURLCache();
    await discoverBackend();
  }, [discoverBackend]);

  const testConnection = useCallback(async (url: string) => {
    try {
      const networkService = NetworkDiscoveryService.getInstance();
      const isConnected = await networkService.testBackendConnection(url);
      
      setState(prev => ({
        ...prev,
        isConnected,
        lastChecked: new Date(),
      }));
      
      return isConnected;
    } catch (error) {
      console.error('❌ Connection test error:', error);
      setState(prev => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        lastChecked: new Date(),
      }));
      return false;
    }
  }, []);

  // Auto-discover on mount
  useEffect(() => {
    discoverBackend();
  }, [discoverBackend]);

  return {
    ...state,
    discoverBackend,
    refreshBackend,
    testConnection,
  };
};

export default useBackendDiscovery;
