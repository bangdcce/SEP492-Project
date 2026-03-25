import { useNavigate } from 'react-router-dom';
import { formatVND, QUOTA_ACTION_LABELS } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/custom/Button';
import { Progress } from '@/shared/components/ui/progress';
import { Sparkles, Lock, ArrowUpRight } from 'lucide-react';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotaInfo?: {
    action: string;
    limit: number;
    current: number;
    message: string;
  } | null;
  title?: string;
  description?: string;
  isPremiumOnly?: boolean;
}

export function UpgradeModal({
  isOpen,
  onClose,
  quotaInfo,
  title,
  description,
  isPremiumOnly = false,
}: UpgradeModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();

    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const rolePrefix = user.role?.toLowerCase() || 'client';
        navigate(`/${rolePrefix}/subscription`);
      } catch {
        navigate('/client/subscription');
      }
    } else {
      navigate('/client/subscription');
    }
  };

  const actionLabel = quotaInfo?.action
    ? QUOTA_ACTION_LABELS[quotaInfo.action] || quotaInfo.action
    : '';

  const progressPercent = quotaInfo && quotaInfo.limit > 0
    ? Math.min(100, (quotaInfo.current / quotaInfo.limit) * 100)
    : 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader className="gap-2">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isPremiumOnly ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
            {isPremiumOnly ? <Lock className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
          </div>
          <DialogTitle className="text-center text-xl">
            {title || (isPremiumOnly ? 'Premium Feature' : 'Free Plan Limit Reached')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description ||
              (isPremiumOnly
                ? 'This feature is available exclusively for Premium subscribers.'
                : quotaInfo?.message || "You've reached your free plan limit.")}
          </DialogDescription>
        </DialogHeader>

        {quotaInfo && !isPremiumOnly && (
          <div className="my-4 rounded-lg bg-muted p-4 space-y-3 border">
            <div className="flex justify-between text-sm font-medium">
              <span>{actionLabel}</span>
              <span className="text-destructive font-bold text-base">
                {quotaInfo.current} / {quotaInfo.limit}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2 [&>div]:bg-destructive" />
          </div>
        )}

        <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm mt-2">
          <h4 className="font-semibold text-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Why upgrade to Premium?
          </h4>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" /> Unlimited access to core features
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" /> Advanced AI Matchmaking
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" /> Priority listing & featured profile
            </li>
          </ul>
        </div>

        <DialogFooter className="sm:justify-between mt-4 gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade} className="w-full sm:w-auto">
            Get Premium Now <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
