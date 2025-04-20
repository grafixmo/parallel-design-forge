
import { toast } from "sonner";

export const customToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
    });
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
    });
  },

  loading: (message: string) => {
    toast.loading(message, {
      duration: 2000,
    });
  },

  info: (message: string) => {
    toast.info(message, {
      duration: 3000,
    });
  },

  warning: (message: string) => {
    toast.warning(message, {
      duration: 3500,
    });
  },

  promise: async <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
  },
};
