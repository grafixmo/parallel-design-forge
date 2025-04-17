
import React, { useState, useEffect } from 'react';
import { 
  supabase, 
  verifyConnection, 
  checkTableAccess, 
  setSupabaseCredentials,
  resetStoredCredentials,
  getCurrentSupabaseUrl
} from '@/services/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { RefreshCw, CheckCircle, XCircle, Trash2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type TableStatus = {
  name: string;
  accessible: boolean;
  error?: string;
  errorType?: string;
  details?: any;
};

type ConnectionStatus = {
  success: boolean;
  error?: any;
  errorType?: string;
  details?: string;
};

const SupabaseTest = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testTables, setTestTables] = useState(['designs', 'templates']);
  const [customTable, setCustomTable] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    checkConnection();
  }, []);
  
  const checkConnection = async () => {
    setIsLoading(true);
    try {
      // Check overall connection
      const result = await verifyConnection();
      setConnectionStatus(result);
      
      // If connection is successful, check tables
      if (result.success) {
        const statuses = [];
        
        for (const table of testTables) {
          const tableResult = await checkTableAccess(table);
          statuses.push({
            name: table,
            ...tableResult
          });
        }
        
        setTableStatuses(statuses);
      } else {
        // Clear table statuses if connection failed
        setTableStatuses([]);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error('Connection test failed', {
        description: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleManualConnect = async () => {
    if (!manualUrl || !manualKey) {
      toast.error('Missing credentials', {
        description: 'Please provide both URL and API key'
      });
      return;
    }
    
    setIsLoading(true);
    try {
      await setSupabaseCredentials(manualUrl, manualKey);
      toast.success('Credentials updated', {
        description: 'Manual connection established'
      });
      checkConnection();
    } catch (error) {
      console.error('Manual connection failed:', error);
      toast.error('Connection failed', {
        description: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResetCredentials = async () => {
    setIsLoading(true);
    try {
      resetStoredCredentials();
      toast.success('Credentials reset', {
        description: 'Reverted to default/environment credentials'
      });
      
      // Clear form
      setManualUrl('');
      setManualKey('');
      
      // Recheck connection
      checkConnection();
    } catch (error) {
      console.error('Reset failed:', error);
      toast.error('Reset failed', {
        description: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCheckCustomTable = async () => {
    if (!customTable) {
      toast.error('No table specified', {
        description: 'Please enter a table name to check'
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await checkTableAccess(customTable);
      
      // Add to test tables if not already there
      if (!testTables.includes(customTable)) {
        setTestTables([...testTables, customTable]);
      }
      
      // Update table statuses
      setTableStatuses([
        ...tableStatuses.filter(t => t.name !== customTable),
        {
          name: customTable,
          ...result
        }
      ]);
      
      // Show success/fail toast
      if (result.accessible) {
        toast.success(`Table access successful`, {
          description: `'${customTable}' table is accessible`
        });
      } else {
        toast.error(`Table access failed`, {
          description: result.error || 'Could not access table'
        });
      }
      
      // Clear custom table input
      setCustomTable('');
    } catch (error) {
      console.error('Custom table check failed:', error);
      toast.error('Table check failed', {
        description: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Supabase Connection Test</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
            <CardDescription>
              Test your connection to Supabase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <Button 
                onClick={checkConnection} 
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
              
              <Button
                onClick={() => setShowDetails(!showDetails)}
                variant="ghost"
                size="sm"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>
            
            {connectionStatus && (
              <div className="bg-muted rounded-md p-4 mt-4">
                <div className="flex items-center mb-2">
                  {connectionStatus.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mr-2" />
                  )}
                  <span className="font-medium">
                    {connectionStatus.success ? 'Connection Successful' : 'Connection Failed'}
                  </span>
                </div>
                
                {!connectionStatus.success && (
                  <div className="mt-2">
                    <div className="text-sm text-red-500">
                      {connectionStatus.details || 'Unknown error'}
                    </div>
                    
                    {showDetails && connectionStatus.error && (
                      <div className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-2 overflow-auto max-h-40">
                        <pre>{JSON.stringify(connectionStatus.error, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground mt-2">
                  Using URL: {getCurrentSupabaseUrl()}
                </div>
              </div>
            )}
            
            {tableStatuses.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Table Access:</h3>
                <div className="bg-muted rounded-md p-4">
                  {tableStatuses.map((table, index) => (
                    <div key={index} className="flex items-center mb-2">
                      {table.accessible ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mr-2" />
                      )}
                      <span className="flex-grow">
                        {table.name}: {table.accessible ? 'Accessible' : table.error || 'Not Accessible'}
                      </span>
                      
                      {showDetails && !table.accessible && table.details && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            // Show details in toast for simplicity
                            toast.info(`Details for ${table.name}`, {
                              description: typeof table.details === 'object' 
                                ? JSON.stringify(table.details, null, 2)
                                : String(table.details)
                            });
                          }}
                        >
                          Details
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 flex gap-2">
                  <Input
                    value={customTable}
                    onChange={(e) => setCustomTable(e.target.value)}
                    placeholder="Check custom table..."
                    className="flex-grow"
                  />
                  <Button 
                    onClick={handleCheckCustomTable}
                    disabled={isLoading || !customTable}
                  >
                    Check
                  </Button>
                </div>
              </div>
            )}
            
            {connectionStatus && !connectionStatus.success && connectionStatus.errorType === 'credentials_error' && (
              <Alert variant="warning" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Using Default Credentials</AlertTitle>
                <AlertDescription>
                  You are using placeholder credentials. Please connect with Supabase integration or enter your credentials manually below.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Manual Connection</CardTitle>
            <CardDescription>
              Connect with your own Supabase credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="supabase-url">Supabase URL</Label>
                <Input 
                  id="supabase-url" 
                  placeholder="https://your-project.supabase.co" 
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supabase-key">Supabase Anon Key</Label>
                <Input 
                  id="supabase-key" 
                  placeholder="your-anon-key" 
                  type="password"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline"
              onClick={handleResetCredentials}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset Credentials
            </Button>
            
            <Button 
              onClick={handleManualConnect}
              disabled={isLoading || !manualUrl || !manualKey}
            >
              Connect
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="mt-8 text-center">
        <a href="/" className="text-blue-500 hover:underline">Return to Home</a>
      </div>
    </div>
  );
};

export default SupabaseTest;
