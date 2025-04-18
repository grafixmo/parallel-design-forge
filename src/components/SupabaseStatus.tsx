// src/components/SupabaseStatus.tsx

import React, { useState, useEffect, useCallback } from 'react';
// --- ¡ASEGÚRATE QUE LA IMPORTACIÓN SEA ESTA! ---
import { verifySupabaseConnection } from '@/services/supabaseClient'; // Ajusta la ruta si es necesario
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Asumiendo shadcn/ui
import { Loader2, CheckCircle2, XCircle, Database } from 'lucide-react'; // Iconos para estado
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Importar Alert
import { RefreshCw } from 'lucide-react'; // Icono Refresh

// (Las importaciones comentadas para Dialog, Input, Label, Key, Trash, Settings
//  se mantienen comentadas ya que la funcionalidad asociada no está implementada
//  en supabaseClient.ts)
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Settings, Key, Trash } from 'lucide-react';


// Definir una interfaz para el estado del componente
interface ConnectionStatusState {
  loading: boolean;
  connected: boolean;
  designsOk?: boolean;
  templatesOk?: boolean;
  message: string;
}

const SupabaseStatus: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatusState>({
    loading: true,
    connected: false,
    designsOk: undefined, // Indeterminado inicialmente
    templatesOk: undefined,
    message: 'Checking connection...',
  });

  // Estado para mostrar/ocultar el panel
  const [showStatus, setShowStatus] = useState(true);

  // --- Funcionalidad de credenciales manuales comentada ---
  // const [showVerboseDetails, setShowVerboseDetails] = useState(false);
  // const [manualUrl, setManualUrl] = useState('');
  // const [manualKey, setManualKey] = useState('');
  // const [isCredentialDialogOpen, setIsCredentialDialogOpen] = useState(false);
  // ---------------------------------------------------------

  // Función para verificar el estado
  const checkStatus = useCallback(async () => {
    console.log("SupabaseStatus: Checking status...");
    setStatus(prev => ({ ...prev, loading: true })); // Indicar carga

    // Llamar a la función de verificación correcta
    const result = await verifySupabaseConnection();

    console.log("SupabaseStatus: Received result:", result);

    // Crear el array de estado de tablas basado en el resultado
    const newTableStatuses: { name: string; accessible: boolean }[] = [
      { name: 'designs', accessible: result.tableAccess?.designs ?? false },
      { name: 'templates', accessible: result.tableAccess?.templates ?? false },
      // Añadir otras tablas si se verifican en verifySupabaseConnection
    ];

    // Actualizar el estado unificado
    setStatus({
      loading: false,
      connected: result.success,
      designsOk: result.tableAccess?.designs ?? false, // Guardar directamente
      templatesOk: result.tableAccess?.templates ?? false, // Guardar directamente
      message: result.message,
    });
  }, []); // useCallback sin dependencias

  // Ejecutar la verificación al montar el componente
  useEffect(() => {
    let isMounted = true;
    const performCheck = async () => {
      if (isMounted) {
        await checkStatus();
      }
    };
    performCheck();
    return () => { isMounted = false; }; // Cleanup para evitar setear estado si se desmonta
  }, [checkStatus]); // Ejecutar cuando checkStatus cambie (solo al montar)

  // --- Funciones para credenciales manuales COMENTADAS ---
  /*
  const handleSetManualCredentials = () => { ... };
  const handleResetCredentials = () => { ... };
  */
  // ----------------------------------------------------

  // Ocultar el componente completo
  const dismissStatus = () => {
    setShowStatus(false);
  };

  // Si no se debe mostrar el estado, no renderizar nada
  if (!showStatus) {
    return null;
  }

  // Determinar la variante del Alert basada en el estado general
  const alertVariant: "default" | "destructive" = status.loading || !status.connected
    ? "destructive"
    : "default";
  const statusTitle = status.loading ? "Checking Status..." :
                      status.connected ? "Supabase Connected" : "Supabase Connection Failed";

  // Helper para renderizar el icono de estado
  const renderStatusIcon = (isOk: boolean | undefined, isLoading: boolean = false) => {
     if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
     if (isOk === true) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
     if (isOk === false) return <XCircle className="w-4 h-4 text-red-600" />;
     return null; // Indeterminado
   };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-xs">
      <Alert variant={alertVariant}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 pt-0.5">
             {/* Icono principal basado en conexión general o carga */}
             {renderStatusIcon(status.loading ? undefined : status.connected, status.loading)}
          </div>
          <div className="flex-1">
            <AlertTitle className="text-sm font-semibold">{statusTitle}</AlertTitle>
            <AlertDescription className="text-xs mt-1 space-y-2">
              {/* Mensaje principal */}
              <span>{status.message}</span>

              {/* Mostrar estado detallado de tablas si no está cargando */}
              {!status.loading && (
                <div className="mt-2 pt-2 border-t border-border/50">
                   <div className="flex items-center justify-between text-xs mb-1">
                     <span className="flex items-center text-muted-foreground">
                       <Database className="w-3 h-3 mr-1.5" /> Designs Table:
                     </span>
                     <span className={status.designsOk ? 'text-green-600' : 'text-red-600'}>
                       {renderStatusIcon(status.designsOk)} {status.designsOk ? 'Accessible' : 'Error'}
                     </span>
                   </div>
                   <div className="flex items-center justify-between text-xs">
                     <span className="flex items-center text-muted-foreground">
                       <Database className="w-3 h-3 mr-1.5" /> Templates Table:
                     </span>
                      <span className={status.templatesOk ? 'text-green-600' : 'text-red-600'}>
                       {renderStatusIcon(status.templatesOk)} {status.templatesOk ? 'Accessible' : 'Error'}
                     </span>
                   </div>
                </div>
              )}

               {/* --- Botón para configurar credenciales COMENTADO --- */}
               {/* ... (JSX del diálogo y trigger comentado) ... */}
               {/* ---------------------------------------------------- */}

            </AlertDescription>
            {/* Botones de acción */}
            <div className="mt-2 pt-2 border-t border-border/50 flex justify-between items-center">
                 <Button
                   variant="ghost"
                   size="sm"
                   className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                   onClick={checkStatus} // Llama a la función para refrescar
                   disabled={status.loading}
                 >
                   <RefreshCw className={`w-3 h-3 mr-1 ${status.loading ? 'animate-spin' : ''}`} />
                   Refresh
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