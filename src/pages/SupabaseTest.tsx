// src/pages/SupabaseTest.tsx

import React, { useState, useEffect, useCallback } from 'react'; // useCallback añadido
// --- CAMBIO AQUÍ: Importar funciones correctas ---
import {
  supabase, // Se mantiene por si se usa directamente en otro lugar
  verifySupabaseConnection // La función que existe para verificar todo
} from '@/services/supabaseClient'; // Ajusta la ruta si es necesario
// --- FIN CAMBIO ---

// --- ELIMINADO: Funciones que no existen ---
// import {
//   verifyConnection,
//   checkTableAccess,
//   setSupabaseCredentials,
//   resetStoredCredentials,
//   getCurrentSupabaseUrl
// } from '@/services/supabaseClient';
// --- FIN ELIMINADO ---

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
// import { toast } from '@/components/ui/sonner'; // toast no se usa aquí directamente
import { RefreshCw, CheckCircle, XCircle, Trash2, AlertTriangle, Loader2 } from 'lucide-react'; // Loader2 añadido
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'react-router-dom'; // Link se usa al final

// Tipos locales para este componente
type TableStatus = {
  name: string;
  accessible: boolean | undefined; // Permitir undefined para estado inicial/no verificado
  error?: string; // Mensaje de error específico si falla el acceso (derivado del general)
};

type ConnectionStatus = {
  success: boolean;
  message: string; // Mensaje de la verificación
};

const SupabaseTest = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testTables] = useState(['designs', 'templates']); // Tablas a verificar

  // --- COMENTADO: Estado para credenciales manuales ---
  // const [manualUrl, setManualUrl] = useState('');
  // const [manualKey, setManualKey] = useState('');
  // --- FIN COMENTADO ---

  // Función para ejecutar las pruebas de conexión y acceso
  const runTests = useCallback(async () => {
    setIsLoading(true);
    setConnectionStatus(null); // Resetear estado previo
    setTableStatuses(testTables.map(name => ({ name, accessible: undefined }))); // Resetear tablas a indeterminado

    console.log("SupabaseTest: Running connection tests...");
    const result = await verifySupabaseConnection(); // Llama a la función unificada
    console.log("SupabaseTest: Verification result:", result);

    // Actualizar estado de conexión general
    setConnectionStatus({
        success: result.success,
        message: result.message
    });

    // Actualizar estado de acceso a tablas
    const newTableStatuses = testTables.map(tableName => ({
      name: tableName,
      // Si la conexión general fue exitosa, usa el resultado de tableAccess, sino marca como inaccesible
      accessible: result.success ? (result.tableAccess?.[tableName] ?? false) : false,
      // Poner mensaje de error general si la conexión falló
      error: !result.success ? result.message : undefined
    }));
    setTableStatuses(newTableStatuses);

    setIsLoading(false);
    console.log("SupabaseTest: Tests finished.");
  }, [testTables]); // Dependencia de testTables (aunque no cambia)

  // Ejecutar pruebas al cargar la página
  useEffect(() => {
    // --- COMENTADO: Obtener URL actual (función no existe) ---
    // const currentUrl = getCurrentSupabaseUrl(); // Esta función no existe
    // setManualUrl(currentUrl || ''); // Setear URL inicial si existiera
    // --- FIN COMENTADO ---
    runTests();
  }, [runTests]); // Ejecutar cuando runTests cambie (solo al montar)


  // --- COMENTADO: Funciones para manejar credenciales manuales ---
  /*
  const handleManualConnect = () => {
    if (manualUrl.trim() && manualKey.trim()) {
      console.log("Attempting to set manual credentials (functionality commented out)...");
      // setSupabaseCredentials(manualUrl.trim(), manualKey.trim()); // ¡Función no existe!
      // runTests(); // Re-test after setting
    } else {
      // toast.error("Both URL and Key are required."); // Necesitarías importar 'toast'
      alert("Both URL and Key are required.");
    }
  };

  const handleResetCredentials = () => {
     console.log("Attempting to reset stored credentials (functionality commented out)...");
    // resetStoredCredentials(); // ¡Función no existe!
    // runTests(); // Re-test after resetting
  };
  */
  // --- FIN COMENTADO ---


  // Helper para renderizar iconos de estado
  const renderStatusIcon = (status: boolean | undefined) => {
    if (status === true) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === false) return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />; // Indeterminado o cargando
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Supabase Connection Test</CardTitle>
          <CardDescription>
            Verify connection to the Supabase backend and access to required tables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              API Connection
              <Button variant="ghost" size="sm" onClick={runTests} disabled={isLoading} className="ml-auto h-auto px-2 py-1">
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Test Again
              </Button>
            </h3>
            {isLoading && !connectionStatus ? (
                 <div className="flex items-center text-muted-foreground">
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...
                 </div>
            ) : connectionStatus ? (
              <Alert variant={connectionStatus.success ? "default" : "destructive"}>
                 {connectionStatus.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertTitle>{connectionStatus.success ? "Success" : "Failed"}</AlertTitle>
                <AlertDescription className="text-xs mt-1">{connectionStatus.message}</AlertDescription>
              </Alert>
            ) : (
               <p className="text-sm text-muted-foreground">Status not available.</p>
            )}
          </div>

          <Separator />

          {/* Table Access Status */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Table Access</h3>
            {isLoading && tableStatuses.every(s => s.accessible === undefined) ? (
                 <div className="flex items-center text-muted-foreground">
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking table access...
                 </div>
            ) : tableStatuses.length > 0 ? (
                <ul className="space-y-2">
                {tableStatuses.map((status) => (
                    <li key={status.name} className="flex items-center justify-between text-sm p-2 border rounded-md">
                    <span className="font-medium">{status.name}</span>
                    <div className={`flex items-center px-2 py-0.5 rounded-full text-xs ${
                        status.accessible === undefined ? 'bg-yellow-100 text-yellow-800' :
                        status.accessible ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                    }`}>
                        {renderStatusIcon(status.accessible)}
                        <span className="ml-1.5">
                        {status.accessible === undefined ? 'Pending' : status.accessible ? 'Accessible' : 'Error'}
                        </span>
                    </div>
                    </li>
                ))}
                </ul>
            ) : (
                 <p className="text-sm text-muted-foreground">No tables checked yet.</p>
            )}
             {/* Mostrar error general si la conexión falló y afectó el chequeo de tablas */}
             {!isLoading && connectionStatus && !connectionStatus.success && (
                 <p className="text-xs text-red-500 mt-2">Table access could not be verified due to connection failure.</p>
             )}
          </div>

        </CardContent>
      </Card>

      {/* --- COMENTADO: Card para Configuración Manual --- */}
      {/*
      <div className="mt-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Manual Configuration (Optional)</CardTitle>
            <CardDescription>
              If auto-detection fails, you can manually enter and store credentials locally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full items-center gap-4">
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
              Connect & Test
            </Button>
          </CardFooter>
        </Card>
      </div>
      */}
      {/* --- FIN COMENTADO --- */}


      <div className="mt-8 text-center">
        {/* Asumiendo que usas react-router-dom, si no, cambia por <a> */}
        <Link to="/" className="text-blue-500 hover:underline">Return to Main App</Link>
      </div>
    </div>
  );
};

export default SupabaseTest;