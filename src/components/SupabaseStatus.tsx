// src/components/SupabaseStatus.tsx

import React, { useEffect, useState, useCallback } from 'react'; // Añadido useCallback
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
// --- CAMBIO AQUÍ: Importar la función correcta ---
import { verifySupabaseConnection } from '@/services/supabaseClient'; // Ajusta la ruta si es necesario

// ELIMINADO: Estas funciones no existen en supabaseClient.ts actual
// import {
//   checkTableAccess,
//   verifyConnection,
//   setSupabaseCredentials,
//   resetStoredCredentials,
//   getCurrentSupabaseUrl
// } from '@/services/supabaseClient';

import { AlertCircle, CheckCircle, RefreshCw, Settings, Key, Trash, Loader2, Database } from 'lucide-react'; // Añadidos Loader2, Database
import { Button } from '@/components/ui/button';
// import { toast } from '@/components/ui/sonner'; // 'toast' no se usa en este archivo
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Link } from 'react-router-dom'; // Link no se usa aquí

interface TableStatus {
  name: string;
  accessible: boolean;
  // error?: any; // Simplificado, el error general está en connectionStatus
  // details?: any;
}

interface ConnectionStatus {
  success: boolean;
  message: string; // Usamos el mensaje de verifySupabaseConnection
  // error?: any; // Incluido en message
  // errorType?: string;
  // details?: any;
}

const SupabaseStatus: React.FC = () => {
  // Estado unificado para simplificar
  const [status, setStatus] = useState<{
    loading: boolean;
    connection: ConnectionStatus | null;
    tables: TableStatus[];
  }>({
    loading: true,
    connection: null,
    tables: [ // Inicializar con las tablas que se esperan
        { name: 'designs', accessible: false },
        { name: 'templates', accessible: false }
    ]
  });

  const [showStatus, setShowStatus] = useState(true); // Mantener estado para mostrar/ocultar
  const [showVerboseDetails, setShowVerboseDetails] = useState(false); // Para mostrar detalles de error

  // --- COMENTADO: Estado para credenciales manuales ---
  // const [manualUrl, setManualUrl] = useState('');
  // const [manualKey, setManualKey] = useState('');
  // const [isCredentialDialogOpen, setIsCredentialDialogOpen] = useState(false);
  // -----------------------------------------------------

  // Función para verificar el estado
  const checkStatus = useCallback(async () => {
    console.log("SupabaseStatus: Checking status...");
    setStatus(prev => ({ ...prev, loading: true })); // Indicar carga

    // Llamar a la función de verificación correcta
    const result = await verifySupabaseConnection();

    console.log("SupabaseStatus: Received result:", result);

    // Crear el array de estado de tablas basado en el resultado
    const newTableStatuses: TableStatus[] = [
      { name: 'designs', accessible: result.tableAccess?.designs ?? false },
      { name: 'templates', accessible: result.tableAccess?.templates ?? false },
      // Añadir 'template_likes' si esa tabla existe y se verifica en verifySupabaseConnection
      // { name: 'template_likes', accessible: result.tableAccess?.template_likes ?? false },
    ];

    // Actualizar el estado unificado
    setStatus({
      loading: false,
      connection: {
        success: result.success,
        message: result.message,
      },
      tables: newTableStatuses,
    });
  }, []); // useCallback sin dependencias si solo se llama al montar o manualmente

  // Ejecutar la verificación al montar el componente
  useEffect(() => {
    checkStatus();
  }, [checkStatus]); // Ejecutar cuando checkStatus cambie (solo al montar en este caso)

  // --- COMENTADO: Funciones para manejar credenciales manuales ---
  /*
  const handleSetManualCredentials = () => {
    if (manualUrl.trim() && manualKey.trim()) {
      // ESTA FUNCIÓN NO EXISTE EN supabaseClient.ts ACTUALMENTE
      // setSupabaseCredentials(manualUrl.trim(), manualKey.trim());
      console.warn("setSupabaseCredentials function is not implemented in supabaseClient.ts");
      toast.warning("Manual credential setting not implemented.");
      // Después de intentar setear, re-verificar estado
      // checkStatus();
      // setIsCredentialDialogOpen(false); // Cerrar diálogo
    } else {
      toast.error("Both URL and Key are required.");
    }
  };

  const handleResetCredentials = () => {
    // ESTA FUNCIÓN NO EXISTE EN supabaseClient.ts ACTUALMENTE
    // resetStoredCredentials();
    console.warn("resetStoredCredentials function is not implemented in supabaseClient.ts");
    toast.info("Stored credentials reset functionality not implemented.");
    // Después de intentar resetear, re-verificar estado
    // checkStatus();
  };
  */
  // --- FIN COMENTADO ---


  // Ocultar el componente completo
  const dismissStatus = () => {
    setShowStatus(false);
  };

  // Si no se debe mostrar el estado, no renderizar nada
  if (!showStatus) {
    return null;
  }

  // Determinar la variante del Alert basada en el estado general
  const alertVariant: "default" | "destructive" = status.loading || !status.connection || !status.connection.success
    ? "destructive"
    : "default";
  const statusTitle = status.loading ? "Checking Status..." :
                      status.connection?.success ? "Supabase Connected" : "Supabase Connection Failed";

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-xs"> {/* Posición fija */}
      <Alert variant={alertVariant}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 pt-0.5">
            {status.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status.connection?.success ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="flex-1">
            <AlertTitle className="text-sm font-semibold">{statusTitle}</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {/* Mostrar mensaje principal */}
              <span>{status.connection?.message || status.message}</span>

              {/* Mostrar estado detallado de tablas si la conexión fue exitosa o si hay error */}
              {!status.loading && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  {status.tables.map((table, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span className="flex items-center">
                        <Database className="w-3 h-3 mr-1.5 text-muted-foreground" />
                        {table.name}
                      </span>
                      <span className={table.accessible ? 'text-green-600' : 'text-red-600'}>
                        {table.accessible ? 'Accessible' : 'Error'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* --- COMENTADO: Botón para abrir diálogo de credenciales --- */}
              {/* Si la conexión falla, mostrar botón para intentar configurar manualmente */}
              {/* {!status.loading && !status.connection?.success && (
                <Dialog open={isCredentialDialogOpen} onOpenChange={setIsCredentialDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-2">
                      <Settings className="w-3 h-3 mr-1"/> Set Credentials Manually
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Set Supabase Credentials</DialogTitle>
                      <DialogDescription>
                        Enter your Supabase Project URL and Public Anon Key. These will be stored locally.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="supabase-url" className="text-right">
                          Project URL
                        </Label>
                        <Input
                          id="supabase-url"
                          value={manualUrl}
                          onChange={(e) => setManualUrl(e.target.value)}
                          className="col-span-3"
                          placeholder="https://your-project-url.supabase.co"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="supabase-key" className="text-right">
                          Anon Key
                        </Label>
                        <Input
                          id="supabase-key"
                          value={manualKey}
                          onChange={(e) => setManualKey(e.target.value)}
                          className="col-span-3"
                          placeholder="your-public-anon-key"
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex justify-between sm:justify-between w-full">
                      <Button variant="ghost" size="sm" onClick={handleResetCredentials}>
                        <Trash className="w-3 h-3 mr-1"/> Reset Stored
                      </Button>
                      <Button onClick={handleSetManualCredentials} disabled={!manualUrl || !manualKey}>
                         <Key className="w-3 h-3 mr-1"/> Save & Retry
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )} */}
              {/* --- FIN COMENTADO --- */}

            </AlertDescription>
            {/* Botón para refrescar */}
            <div className="mt-2 pt-2 border-t border-border/50 flex justify-between items-center">
                 <Button
                   variant="ghost"
                   size="sm"
                   className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                   onClick={checkStatus}
                   disabled={status.loading}
                 >
                   <RefreshCw className={`w-3 h-3 mr-1 ${status.loading ? 'animate-spin' : ''}`} />
                   Refresh Status
                 </Button>
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