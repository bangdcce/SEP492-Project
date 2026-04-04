import paypalLogo from "@/assets/brands/paypal-logo.svg";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";

interface SubscriptionPayPalSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payPalEmail: string;
  onPayPalEmailChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  saveLabel?: string;
  cancelLabel?: string;
}

export function SubscriptionPayPalSetupDialog({
  open,
  onOpenChange,
  payPalEmail,
  onPayPalEmailChange,
  onSave,
  saving,
  error,
  title = "Set up PayPal for subscription checkout",
  description = "Save the PayPal buyer account you want to use for premium purchases before starting checkout.",
  saveLabel = "Save PayPal",
  cancelLabel = "Not now",
}: SubscriptionPayPalSetupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                <img src={paypalLogo} alt="PayPal" className="h-5 w-auto" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Saved PayPal funding method</p>
                <p className="text-sm leading-6 text-slate-600">
                  This buyer account is used to approve subscription payments. It is separate from your payout wallet setup, although the same PayPal email can be used for both.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">PayPal buyer email</p>
              <p className="text-sm text-slate-500">
                Save the PayPal account that should appear during subscription approval.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="subscription-paypal-email" className="text-sm font-medium text-slate-800">
                PayPal email
              </label>
              <Input
                id="subscription-paypal-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="buyer@example.com"
                value={payPalEmail}
                onChange={(event) => onPayPalEmailChange(event.target.value)}
              />
              <p className="text-xs leading-5 text-slate-500">
                The first successful PayPal approval will verify and vault this buyer for faster future subscription checkout.
              </p>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {cancelLabel}
          </Button>
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving..." : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SubscriptionPayPalSetupDialog;
