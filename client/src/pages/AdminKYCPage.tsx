import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Eye, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/shared/api/client';
import { KYCVerificationModal } from '@/shared/components/figma/kycmodal';

interface KycVerification {
  id: string;
  fullNameOnDocument: string;
  documentNumber: string;
  documentType: string;
  dateOfBirth: string;
  documentFrontUrl: string;
  documentBackUrl: string;
  selfieUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    avatarUrl?: string;
    profile?: {
      avatarUrl?: string;
    };
  };
  reviewer?: {
    fullName: string;
  };
}

export default function AdminKYCPage() {
  const [kycs, setKycs] = useState<KycVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedKyc, setSelectedKyc] = useState<KycVerification | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Helper function to get full image URL
  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:image')) return path;
    return `${API_URL}${path}`;
  };

  useEffect(() => {
    fetchKycs();
  }, [filter]);

  const fetchKycs = async () => {
    try {
      setLoading(true);
      const statusParam = filter === 'ALL' ? '' : `?status=${filter}`;
      const response = await apiClient.get(`/kyc/admin/all${statusParam}`);
      
      // apiClient already unwraps response.data
      const data = response as { items: KycVerification[] };
      setKycs(data.items || []);
    } catch (error: any) {
      console.error('Error fetching KYCs:', error);
      console.error('Error response:', error.response);
      toast.error(error.response?.data?.message || 'Failed to load KYC verifications');
    } finally {
      setLoading(false);
    }
  };

  const openReview = async (kyc: KycVerification) => {
    setSelectedKyc(kyc);
    setShowModal(true);

    try {
      const response = await apiClient.get(`/kyc/admin/${kyc.id}/watermark`);
      setSelectedKyc(response as KycVerification);
    } catch (error: any) {
      console.error('Error loading KYC details:', error);
      toast.error(error.response?.data?.message || 'Failed to load KYC images');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedKyc(null);
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      await apiClient.patch(`/kyc/admin/${id}/approve`);
      toast.success('KYC approved successfully');
      fetchKycs();
      closeModal();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    if (!reason?.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.patch(`/kyc/admin/${id}/reject`, { rejectionReason: reason });
      toast.success('KYC rejected');
      fetchKycs();
      closeModal();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };

    const icons = {
      PENDING: <Clock className="w-4 h-4" />,
      APPROVED: <CheckCircle className="w-4 h-4" />,
      REJECTED: <XCircle className="w-4 h-4" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        {status}
      </span>
    );
  };

  const getRoleKey = (role: string): 'sme' | 'broker' | 'freelancer' => {
    const normalized = role.toLowerCase();
    if (normalized.includes('broker')) return 'broker';
    if (normalized.includes('freelancer')) return 'freelancer';
    if (normalized.includes('sme') || normalized.includes('client')) return 'sme';
    return 'sme';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">KYC Verification Management</h1>
          <p className="text-gray-600 mt-2">Review and verify user identity documents</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex gap-2">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* KYC List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : kycs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No KYC verifications found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {kycs.map((kyc) => (
                  <tr key={kyc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{kyc.user.fullName}</div>
                        <div className="text-sm text-gray-500">{kyc.user.email}</div>
                        <span className="text-xs text-gray-400">{kyc.user.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{kyc.fullNameOnDocument}</div>
                        <div className="text-sm text-gray-500">{kyc.documentType}: {kyc.documentNumber}</div>
                        <div className="text-xs text-gray-400">DOB: {format(new Date(kyc.dateOfBirth), 'dd/MM/yyyy')}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(kyc.createdAt), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(kyc.status)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => openReview(kyc)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Review Modal */}
        {selectedKyc && (
          <KYCVerificationModal
            isOpen={showModal}
            onClose={closeModal}
            kycData={{
              userId: selectedKyc.id,
              userName: selectedKyc.user.fullName,
              userEmail: selectedKyc.user.email,
              userRole: getRoleKey(selectedKyc.user.role),
              avatarImage: getImageUrl(
                selectedKyc.user.avatarUrl || selectedKyc.user.profile?.avatarUrl || ''
              ),
              idCardFront: getImageUrl(selectedKyc.documentFrontUrl),
              idCardBack: getImageUrl(selectedKyc.documentBackUrl),
              selfieImage: getImageUrl(selectedKyc.selfieUrl),
              submittedAt: format(new Date(selectedKyc.createdAt), 'dd/MM/yyyy HH:mm'),
              status: selectedKyc.status.toLowerCase() as 'pending' | 'approved' | 'rejected',
              rejectionReason: selectedKyc.rejectionReason,
            }}
            onApprove={(kycId) => {
              if (actionLoading) return;
              if (selectedKyc.status !== 'PENDING') {
                toast.info('This KYC has already been reviewed.');
                return;
              }
              handleApprove(kycId);
            }}
            onReject={(kycId, reason) => {
              if (actionLoading) return;
              if (selectedKyc.status !== 'PENDING') {
                toast.info('This KYC has already been reviewed.');
                return;
              }
              handleReject(kycId, reason);
            }}
          />
        )}
      </div>
    </div>
  );
}

