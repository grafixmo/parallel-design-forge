
import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { checkTableAccess } from '@/services/supabaseClient';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface TableStatus {
  name: string;
  accessible: boolean;
  error?: any;
}

const SupabaseStatus = () => {
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showStatus, setShowStatus] = useState(true);

  useEffect(() => {
    const checkTables = async () => {
      setIsLoading(true);
      try {
        // List of tables to check
        const tables = ['designs', 'templates'];
        const statuses: TableStatus[] = [];

        // Check each table
        for (const table of tables) {
          const result = await checkTableAccess(table);
          statuses.push({
            name: table,
            accessible: result.accessible,
            error: result.error
          });
        }

        setTableStatuses(statuses);
      } catch (error) {
        console.error('Error checking table access:', error);
      } finally {
        setIsLoading(false);
        
        // Automatically hide the status after 10 seconds
        const timer = setTimeout(() => {
          setShowStatus(false);
        }, 10000);
        
        return () => clearTimeout(timer);
      }
    };

    checkTables();
  }, []);

  if (!showStatus || isLoading) {
    return null;
  }

  const allAccessible = tableStatuses.every(status => status.accessible);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Alert variant={allAccessible ? "default" : "destructive"} className="shadow-md">
        <div className="flex items-start">
          {allAccessible ? (
            <CheckCircle className="h-4 w-4 mt-0.5 mr-2 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 mr-2" />
          )}
          <div>
            <AlertTitle>
              {allAccessible ? "Supabase Connected" : "Supabase Connection Issues"}
            </AlertTitle>
            <AlertDescription className="mt-2">
              {tableStatuses.map((status, index) => (
                <div key={index} className="text-sm flex items-center mb-1">
                  {status.accessible ? (
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                  )}
                  <span>
                    {status.name}: {status.accessible ? "Connected" : "Error"}
                  </span>
                </div>
              ))}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
};

export default SupabaseStatus;
