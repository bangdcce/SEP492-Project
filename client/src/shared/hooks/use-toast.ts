import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

export const useToast = () => {
  const toast = ({ title, description, variant = "default" }: ToastInput) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
      return;
    }
    sonnerToast(title, { description });
  };

  return { toast };
};

