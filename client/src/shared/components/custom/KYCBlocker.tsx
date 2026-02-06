import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/components/custom/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ROUTES } from '@/constants';

interface KYCBlockerProps {
  kycStatus: string | null;
  role: 'client' | 'freelancer' | 'broker';
  action: string; // e.g., "create project requests", "apply to projects", "accept invitations"
}

/**
 * KYC Blocker Component
 * Shows a full-page block when user hasn't completed KYC verification
 */
export function KYCBlocker({ kycStatus, role, action }: KYCBlockerProps) {
  const navigate = useNavigate();

  const getKycStatusRoute = () => {
    switch (role) {
      case 'client':
        return ROUTES.CLIENT_KYC_STATUS || '/client/kyc-status';
      case 'freelancer':
        return ROUTES.FREELANCER_KYC_STATUS || '/freelancer/kyc-status';
      case 'broker':
        return ROUTES.BROKER_KYC_STATUS || '/broker/kyc-status';
      default:
        return '/kyc';
    }
  };

  const isPending = kycStatus === 'PENDING';
  const isRejected = kycStatus === 'REJECTED';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-2 border-slate-200">
        <CardHeader className={`text-center pb-4 ${isPending ? 'bg-yellow-50' : 'bg-slate-50'}`}>
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isPending ? 'bg-yellow-100' : isRejected ? 'bg-red-100' : 'bg-slate-100'
          }`}>
            {isPending ? (
              <Clock className="w-8 h-8 text-yellow-600" />
            ) : isRejected ? (
              <AlertTriangle className="w-8 h-8 text-red-600" />
            ) : (
              <ShieldX className="w-8 h-8 text-slate-600" />
            )}
          </div>
          <CardTitle className={`text-xl ${
            isPending ? 'text-yellow-800' : isRejected ? 'text-red-800' : 'text-slate-800'
          }`}>
            {isPending
              ? 'KYC Verification Pending'
              : isRejected
              ? 'KYC Verification Failed'
              : 'KYC Verification Required'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-muted-foreground">
            {isPending ? (
              <>
                Your identity verification is being reviewed. Please wait for approval before you can <strong>{action}</strong>.
                This usually takes 1-2 business days.
              </>
            ) : isRejected ? (
              <>
                Your KYC verification was not successful. Please resubmit your documents to <strong>{action}</strong>.
              </>
            ) : (
              <>
                To <strong>{action}</strong>, you need to verify your identity first.
                This helps us maintain a secure and trusted platform.
              </>
            )}
          </p>

          <div className="space-y-3 pt-4">
            {!isPending && (
              <Button
                onClick={() => navigate(ROUTES.KYC_VERIFICATION || '/kyc')}
                className="w-full"
              >
                {isRejected ? 'Resubmit Verification' : 'Start Verification'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => navigate(getKycStatusRoute())}
              className="w-full"
            >
              {isPending ? 'Check Status' : 'View KYC Status'}
            </Button>
          </div>

          {isPending && (
            <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3 mt-4">
              💡 <strong>Tip:</strong> You'll be notified once your verification is complete.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Hook to check KYC status
 */
export function useKYCStatus() {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const checkKycStatus = async (): Promise<string> => {
    try {
      const response = await fetch(`${baseUrl}/kyc/me`, {
        credentials: 'include',
      });
      
      if (response.status === 404) {
        return 'NOT_SUBMITTED';
      }
      
      if (!response.ok) {
        return 'NOT_SUBMITTED';
      }
      
      const data = await response.json();
      return data.status || 'NOT_SUBMITTED';
    } catch (error) {
      console.error('Error checking KYC status:', error);
      return 'NOT_SUBMITTED';
    }
  };

  return { checkKycStatus };
}
