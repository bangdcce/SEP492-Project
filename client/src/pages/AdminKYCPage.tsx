import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Check, X, Eye, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/custom/Button';
import { toast } from 'sonner';
import { apiClient } from '@/shared/api/client';

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
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Helper function to get full image URL
  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
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
      const data = response;
      setKycs(data.items || []);
    } catch (error: any) {
      console.error('Error fetching KYCs:', error);
      console.error('Error response:', error.response);
      toast.error(error.response?.data?.message || 'Failed to load KYC verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      await apiClient.patch(`/kyc/admin/${id}/approve`);
      toast.success('KYC approved successfully');
      fetchKycs();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.patch(`/kyc/admin/${id}/reject`, {
        rejectionReason,
      });
      toast.success('KYC rejected');
      fetchKycs();
      setShowModal(false);
      setRejectionReason('');
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
                        onClick={() => {
                          setSelectedKyc(kyc);
                          setShowModal(true);
                        }}
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
        {showModal && selectedKyc && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">KYC Verification Review</h2>
                    <p className="text-gray-600">{selectedKyc.user.fullName} - {selectedKyc.user.email}</p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Document Info */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">Full Name on Document</p>
                      <p className="font-medium">{selectedKyc.fullNameOnDocument}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Document Number</p>
                      <p className="font-medium">{selectedKyc.documentNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date of Birth</p>
                      <p className="font-medium">{format(new Date(selectedKyc.dateOfBirth), 'dd/MM/yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Document Type</p>
                      <p className="font-medium">{selectedKyc.documentType}</p>
                    </div>
                  </div>
                </div>

                {/* Document Images */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Uploaded Documents (Click to enlarge)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">ID Card - Front</p>
                      <img
                        src={getImageUrl(selectedKyc.documentFrontUrl)}
                        alt="ID Front"
                        className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLightboxImage(getImageUrl(selectedKyc.documentFrontUrl))}
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23ddd" width="300" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="20"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">ID Card - Back</p>
                      <img
                        src={getImageUrl(selectedKyc.documentBackUrl)}
                        alt="ID Back"
                        className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLightboxImage(getImageUrl(selectedKyc.documentBackUrl))}
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23ddd" width="300" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="20"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Selfie with ID</p>
                      <img
                        src={getImageUrl(selectedKyc.selfieUrl)}
                        alt="Selfie"
                        className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLightboxImage(getImageUrl(selectedKyc.selfieUrl))}
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23ddd" width="300" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="20"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Rejection Reason Input (if rejecting) */}
                {selectedKyc.status === 'PENDING' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason (if rejecting)
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Provide a reason if you're rejecting this KYC..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </div>
                )}

                {/* Rejection Info (if already rejected) */}
                {selectedKyc.status === 'REJECTED' && selectedKyc.rejectionReason && (
                  <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                    <p className="text-sm text-red-700">{selectedKyc.rejectionReason}</p>
                    {selectedKyc.reviewer && (
                      <p className="text-xs text-red-600 mt-2">
                        Rejected by: {selectedKyc.reviewer.fullName}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {selectedKyc.status === 'PENDING' && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleApprove(selectedKyc.id)}
                      disabled={actionLoading}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Approve KYC
                    </Button>
                    <Button
                      onClick={() => handleReject(selectedKyc.id)}
                      disabled={actionLoading || !rejectionReason.trim()}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Reject KYC
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-xl font-bold"
            >
              ✕ Close
            </button>
            <img
              src={lightboxImage}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
