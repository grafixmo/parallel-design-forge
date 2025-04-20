import { toast as sonnerToast } from '@/components/ui/sonner';

// Create a custom toast wrapper that works with sonner's type definitions
const toast = (message: string, options?: { variant?: 'default' | 'destructive' | 'success' }) => {
  // Base toast options
  const toastOptions: any = {};
  
  // Map our variant to appropriate sonner properties
  if (options?.variant) {
    // Different sonner implementations might use different properties
    // Check sonner's documentation for the correct way to style toasts
    if (options.variant === 'destructive') {
      // For destructive variant, use a common approach
      toastOptions.className = 'bg-red-500 text-white';
    } else if (options.variant === 'success') {
      toastOptions.className = 'bg-green-500 text-white';
    }
  }
  
  // Call sonner toast with the right parameters
  return sonnerToast(message, toastOptions);
};

export { toast };