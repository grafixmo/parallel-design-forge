
import React, { useState, useEffect } from 'react';
import { supabase, verifyConnection, checkTableAccess, setSupabaseCredentials } from '@/services/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const SupabaseTest = () => {
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [tableStatuses, setTableStatuses] = useState<any[]>([]);
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
        const tables = ['designs', 'templates'];
        const statuses = [];
        
        for (const table of tables) {
          const tableResult = await checkTableAccess(table);
          statuses.push({
            name: table,
            ...tableResult
          });
        }
        
        setTableStatuses(statuses);
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
                  <div className="text-sm text-red-500 mt-2">
                    Error: {connectionStatus.details || String(connectionStatus.error)}
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground mt-2">
                  Using URL: {supabase.supabaseUrl}
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
                      <span>
                        {table.name}: {table.accessible ? 'Accessible' : 'Not Accessible'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
          <CardFooter>
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
