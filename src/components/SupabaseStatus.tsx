
import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { checkTableAccess, verifyConnection, supabase, setSupabaseCredentials } from '@/services/supabaseClient';
import { AlertCircle, CheckCircle, RefreshCw, Settings, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TableStatus {
  name: string;
  accessible: boolean;
  error?: any;
  details?: any;
}

interface ConnectionStatus {
  success: boolean;
  error?: any;
  errorType?: string;
  details?: any;
}

const SupabaseStatus = () => {
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [showVerboseDetails, setShowVerboseDetails] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      // First verify overall connection
      const connectionResult = await verifyConnection();
      setConnectionStatus(connectionResult);
      
      if (!connectionResult.success) {
        console.error('Supabase connection failed:', connectionResult);
        
        // Show toast notification for credential errors
        if (connectionResult.errorType === 'credentials_error') {
          toast.error('Supabase Connection Issue', {
            description: 'Using placeholder credentials. Please connect to Supabase in project settings.',
          });
        }
        
        setTableStatuses([]);
        setIsLoading(false);
        return;
      }
      
      // If connection succeeded, check tables
      const tables = ['designs', 'templates'];
      const statuses: TableStatus[] = [];

      // Check each table
      for (const table of tables) {
        const result = await checkTableAccess(table);
        statuses.push({
          name: table,
          accessible: result.accessible,
          error: result.error,
          details: result.details
        });
      }

      setTableStatuses(statuses);
    } catch (error) {
      console.error('Error checking Supabase connection:', error);
      toast.error('Connection check failed', {
        description: 'Could not verify Supabase connection status',
      });
    } finally {
      setIsLoading(false);
      
      // Keep visible longer when there are issues
      const delay = connectionStatus?.success && tableStatuses.every(s => s.accessible) ? 10000 : 60000;
      
      const timer = setTimeout(() => {
        setShowStatus(false);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // Allow manually dismissing the status
  const dismissStatus = () => setShowStatus(false);

  // Force a refresh of the status
  const refreshStatus = () => {
    setShowVerboseDetails(false);
    checkConnection();
  };

  // Function to open Supabase settings
  const openSupabaseSettings = () => {
    // This is a placeholder - in a real app, this would open the Supabase settings modal or page
    toast.info('Supabase Settings', {
      description: 'Please connect to Supabase using the green button in the top right',
    });
  };

  // Handle manual connection
  const handleManualConnect = async () => {
    if (!manualUrl || !manualKey) {
      toast.error('Missing credentials', {
        description: 'Please provide both URL and API key',
      });
      return;
    }

    try {
      setIsLoading(true);
      await setSupabaseCredentials(manualUrl, manualKey);
      
      // Close dialog
      setManualDialogOpen(false);
      
      // Check connection with new credentials
      await checkConnection();
      
      toast.success('Manual connection applied', {
        description: 'Supabase credentials updated. Testing connection...'
      });
    } catch (error) {
      console.error('Error setting manual credentials:', error);
      toast.error('Connection failed', {
        description: 'Could not connect with provided credentials',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!showStatus) {
    return null;
  }

  const allAccessible = connectionStatus?.success && tableStatuses.every(status => status.accessible);
  const usingPlaceholders = connectionStatus?.errorType === 'credentials_error';
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Alert variant={allAccessible ? "default" : "destructive"} className="shadow-md">
        <div className="flex items-start">
          {allAccessible ? (
            <CheckCircle className="h-4 w-4 mt-0.5 mr-2 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 mr-2" />
          )}
          <div className="flex-1">
            <AlertTitle className="flex items-center justify-between">
              <span>
                {connectionStatus?.success 
                  ? "Supabase Connected" 
                  : usingPlaceholders
                    ? "Supabase Not Connected"
                    : "Supabase Connection Issues"}
              </span>
              <div className="flex gap-2">
                {!allAccessible && (
                  <>
                    <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-5 w-5 rounded-full"
                          title="Manual Connection"
                        >
                          <Key className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Manual Supabase Connection</DialogTitle>
                          <DialogDescription>
                            Enter your Supabase URL and anon key to connect manually.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="supabase-url" className="text-right">
                              URL
                            </Label>
                            <Input
                              id="supabase-url"
                              value={manualUrl}
                              onChange={(e) => setManualUrl(e.target.value)}
                              placeholder="https://your-project.supabase.co"
                              className="col-span-3"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="supabase-key" className="text-right">
                              API Key
                            </Label>
                            <Input
                              id="supabase-key"
                              value={manualKey}
                              onChange={(e) => setManualKey(e.target.value)}
                              type="password"
                              placeholder="your-anon-key"
                              className="col-span-3"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleManualConnect} disabled={isLoading}>
                            {isLoading ? 'Connecting...' : 'Connect'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-5 w-5 rounded-full"
                      onClick={openSupabaseSettings}
                      title="Open Supabase Settings"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 rounded-full"
                  onClick={refreshStatus}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </AlertTitle>
            <AlertDescription className="mt-2 text-sm">
              {isLoading ? (
                <div className="text-center py-2">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Checking connection...
                </div>
              ) : !connectionStatus?.success ? (
                <div className="text-sm">
                  <div className="font-medium text-destructive mb-1">
                    {usingPlaceholders ? 'Connection Not Established' : 'Connection Failed'}
                  </div>
                  <div className="text-xs opacity-90 mb-2">
                    {usingPlaceholders 
                      ? 'Using placeholder Supabase credentials. Try using the manual connection option.' 
                      : connectionStatus?.errorType === 'api_error' 
                        ? 'Cannot reach Supabase API' 
                        : connectionStatus?.errorType === 'query_error' 
                          ? 'API reachable but query failed' 
                          : 'Unexpected connection error'}
                  </div>
                  
                  {showVerboseDetails && (
                    <div className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-20">
                      {typeof connectionStatus?.error === 'object' 
                        ? JSON.stringify(connectionStatus.error, null, 2) 
                        : String(connectionStatus?.error || 'Unknown error')}
                    </div>
                  )}
                  
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs mt-1"
                    onClick={() => setShowVerboseDetails(!showVerboseDetails)}
                  >
                    {showVerboseDetails ? 'Hide' : 'Show'} details
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-2 text-xs font-medium">Table Access:</div>
                  {tableStatuses.map((status, index) => (
                    <div key={index} className="text-sm flex items-center mb-1">
                      {status.accessible ? (
                        <CheckCircle className="h-3 w-3 mr-1 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1 text-red-500 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate">
                        {status.name}: {status.accessible ? "Connected" : "Error"}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </AlertDescription>
            <div className="mt-3 text-xs text-muted-foreground">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={dismissStatus}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </Alert>
    </div>
  );
};

export default SupabaseStatus;
