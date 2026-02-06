import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/shared/components/custom/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Spinner } from '@/shared/components/ui';
import { ROUTES } from '@/constants';

type KYCStatus = 'NOT_SUBMITTED' | 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface KYCData {
  status: KYCStatus;
  rejectionReason?: string;
  submittedAt?: string;
  verifiedAt?: string;
}

export default function KYCStatusPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const fetchKYCStatus = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      
      const response = await fetch(`${baseUrl}/kyc/me`, {
        credentials: 'include',
      });

      if (response.status === 404) {
        // No KYC record found - not submitted yet
        setKycData({ status: 'NOT_SUBMITTED' });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch KYC status');
      }

      const data = await response.json();
      setKycData({
        status: data.status,
        rejectionReason: data.rejectionReason,
        submittedAt: data.createdAt,
        verifiedAt: data.verifiedAt,
      });
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      setKycData({ status: 'NOT_SUBMITTED' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  // Auto-refresh when pending
  useEffect(() => {
    if (kycData?.status !== 'PENDING') return;

    const interval = setInterval(() => fetchKYCStatus(), 10000);
    return () => clearInterval(interval);
  }, [kycData?.status]);

  const getStatusConfig = (status: KYCStatus) => {
    switch (status) {
      case 'APPROVED':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeVariant: 'default' as const,
          badgeClass: 'bg-green-100 text-green-800 hover:bg-green-100',
          title: 'Identity Verified',
          description: 'Your identity has been successfully verified. You have full access to all platform features.',
        };
      case 'PENDING':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badgeVariant: 'secondary' as const,
          badgeClass: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
          title: 'Verification In Progress',
          description: 'Your documents are being reviewed. This usually takes 1-2 business days.',
        };
      case 'REJECTED':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeVariant: 'destructive' as const,
          badgeClass: 'bg-red-100 text-red-800 hover:bg-red-100',
          title: 'Verification Failed',
          description: 'Your identity verification was not successful. Please review the reason below and try again.',
        };
      case 'NOT_STARTED':
      default:
        return {
          icon: ShieldCheck,
          color: 'text-slate-600',
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-200',
          badgeVariant: 'outline' as const,
          badgeClass: 'bg-slate-100 text-slate-800 hover:bg-slate-100',
          title: 'Identity Not Verified',
          description: 'Complete identity verification to unlock all platform features and build trust with other users.',
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  const status = kycData?.status || 'NOT_SUBMITTED';
  const isNotVerified = status === 'NOT_SUBMITTED' || status === 'NOT_STARTED';
  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">KYC Verification</h1>
        <p className="text-muted-foreground mt-1">
          Verify your identity to access all platform features
        </p>
      </div>

      {/* Status Card */}
      <Card className={`${config.borderColor} border-2`}>
        <CardHeader className={`${config.bgColor} rounded-t-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${config.bgColor}`}>
                <StatusIcon className={`h-8 w-8 ${config.color}`} />
              </div>
              <div>
                <CardTitle className="text-lg">{config.title}</CardTitle>
                <Badge className={config.badgeClass}>
                  {isNotVerified ? 'NOT_STARTED' : status}
                </Badge>
              </div>
            </div>
            {status === 'PENDING' && (
              <Button
                variant="outline"
                onClick={() => fetchKYCStatus(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-muted-foreground mb-6">{config.description}</p>

          {/* Rejection Reason */}
          {status === 'REJECTED' && kycData?.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Reason for Rejection</p>
                  <p className="text-red-700 text-sm mt-1">{kycData.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submission Info */}
          {kycData?.submittedAt && !isNotVerified && (
            <div className="text-sm text-muted-foreground mb-6">
              <p>
                Submitted on:{' '}
                <span className="font-medium">
                  {new Date(kycData.submittedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </p>
              {kycData?.verifiedAt && status === 'APPROVED' && (
                <p className="mt-1">
                  Verified on:{' '}
                  <span className="font-medium">
                    {new Date(kycData.verifiedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {(isNotVerified || status === 'REJECTED') && (
            <Button
              onClick={() => navigate(ROUTES.KYC_VERIFICATION)}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {status === 'REJECTED' ? 'Resubmit Verification' : 'Start Verification'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {status === 'PENDING' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-600 animate-pulse" />
                <p className="text-yellow-800 text-sm">
                  Please wait while we verify your documents. You'll be notified once the review is complete.
                </p>
              </div>
            </div>
          )}

          {status === 'APPROVED' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-800 text-sm">
                  You're all set! Your verified status helps build trust with other users on the platform.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Benefits Section */}
      {isNotVerified && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Why Verify Your Identity?</CardTitle>
            <CardDescription>Benefits of completing KYC verification</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Unlock All Features</p>
                  <p className="text-sm text-muted-foreground">
                    Access project creation, bidding, and contract features
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Build Trust</p>
                  <p className="text-sm text-muted-foreground">
                    Verified badge increases your credibility with other users
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Secure Transactions</p>
                  <p className="text-sm text-muted-foreground">
                    Participate in secure financial transactions on the platform
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
