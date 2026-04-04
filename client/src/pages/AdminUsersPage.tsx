import { useState, useEffect } from 'react';
import { Search, Ban, UserCheck, Shield, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phoneNumber?: string;
  isVerified: boolean;
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  currentTrustScore: number;
  totalProjectsFinished: number;
  totalDisputesLost: number;
  createdAt: string;
}

interface UserStats {
  total: number;
  banned: number;
  verified: number;
  byRole: Record<string, number>;
}

interface UserDetail extends User {
  kyc?: {
    id?: string;
    status?: string;
    documentFrontUrl?: string;
    documentBackUrl?: string;
    rejectionReason?: string;
    createdAt?: string;
    reviewedAt?: string;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [banFilter, setBanFilter] = useState<string>('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modals
  const [showBanModal, setShowBanModal] = useState(false);
  const [showUnbanModal, setShowUnbanModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [unbanReason, setUnbanReason] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Fetch users
  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [page, roleFilter, searchQuery, banFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      
      if (roleFilter) params.append('role', roleFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (banFilter) params.append('isBanned', banFilter);

      const response = await fetch(`${API_URL}/users?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users);
      setTotalPages(data.totalPages);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/users/admin/statistics`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const openUserDetail = async (user: User) => {
    try {
      setDetailLoading(true);
      setShowDetailModal(true);
      const response = await fetch(`${API_URL}/users/${user.id}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to load user detail');
      const data = await response.json();
      const baseDetail = data as UserDetail;

      if (baseDetail.kyc?.id) {
        try {
          const kycResponse = await fetch(
            `${API_URL}/kyc/admin/${baseDetail.kyc.id}/watermark`,
            { credentials: 'include' }
          );
          if (kycResponse.ok) {
            const kycData = await kycResponse.json();
            setDetailUser({
              ...baseDetail,
              kyc: {
                ...baseDetail.kyc,
                status: kycData.status,
                rejectionReason: kycData.rejectionReason,
                documentFrontUrl: kycData.documentFrontUrl,
                documentBackUrl: kycData.documentBackUrl,
              },
            });
          } else {
            setDetailUser(baseDetail);
          }
        } catch {
          setDetailUser(baseDetail);
        }
      } else {
        setDetailUser(baseDetail);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load user detail');
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeUserDetail = () => {
    setShowDetailModal(false);
    setDetailUser(null);
  };

  const handleBanUser = async () => {
    if (!selectedUser || !banReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/${selectedUser.id}/ban`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: banReason }),
      });

      if (!response.ok) throw new Error('Failed to ban user');

      toast.success('User banned successfully');
      setShowBanModal(false);
      setBanReason('');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to ban user');
    }
  };

  const handleUnbanUser = async () => {
    if (!selectedUser || !unbanReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/${selectedUser.id}/unban`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: unbanReason }),
      });

      if (!response.ok) throw new Error('Failed to unban user');

      toast.success('User unbanned successfully');
      setShowUnbanModal(false);
      setUnbanReason('');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unban user');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-800',
      STAFF: 'bg-purple-100 text-purple-800',
      CLIENT: 'bg-blue-100 text-blue-800',
      FREELANCER: 'bg-green-100 text-green-800',
      BROKER: 'bg-yellow-100 text-yellow-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (user: User) => {
    if (user.isBanned) return 'Banned';
    return 'Active';
  };

  const getKycStatusText = (status?: string, isVerified?: boolean) => {
    if (status) return status;
    return isVerified ? 'APPROVED' : 'NOT_STARTED';
  };

  const getPermissionLabel = (role: string) => {
    if (role === 'ADMIN' || role === 'STAFF') return 'Admin privileges';
    return 'Standard user permissions';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Manage users and ban/unban access</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Total Users</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Verified</div>
              <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Banned</div>
              <div className="text-2xl font-bold text-red-600">{stats.banned}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Freelancers</div>
              <div className="text-2xl font-bold text-blue-600">{stats.byRole.FREELANCER || 0}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Email or name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Roles</option>
                <option value="CLIENT">Client</option>
                <option value="FREELANCER">Freelancer</option>
                <option value="BROKER">Broker</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={banFilter}
                onChange={(e) => {
                  setBanFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Status</option>
                <option value="false">Active</option>
                <option value="true">Banned</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trust Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projects</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openUserDetail(user)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{user.fullName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Shield className="w-4 h-4 text-yellow-500 mr-1" />
                        <span className="font-semibold">{Number(user.currentTrustScore).toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.totalProjectsFinished} finished
                      {user.totalDisputesLost > 0 && (
                        <span className="ml-2 text-red-600">({user.totalDisputesLost} disputes)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isBanned ? (
                        <div className="flex items-center text-red-600">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          <span className="text-sm font-medium">Banned</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          {user.isVerified && (
                            <UserCheck className="w-4 h-4 text-green-600 mr-1" />
                          )}
                          <span className="text-sm text-green-600">Active</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      {user.isBanned ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setShowUnbanModal(true);
                          }}
                          className="inline-flex items-center justify-center text-green-600 hover:text-green-900"
                          title="Unban User"
                        >
                          <UserCheck className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setShowBanModal(true);
                          }}
                          className="inline-flex items-center justify-center text-red-600 hover:text-red-900"
                          title="Ban User"
                        >
                          <Ban className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* User Detail Modal */}
        {showDetailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">User Details</h3>
                  <p className="text-sm text-gray-500">
                    {detailUser?.fullName || 'Loading user...'}
                  </p>
                </div>
                <button
                  onClick={closeUserDetail}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
              </div>

              <div className="p-6">
                {detailLoading ? (
                  <div className="text-center text-gray-500 py-12">Loading details...</div>
                ) : detailUser ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Basic Info</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-gray-500">Name:</span> {detailUser.fullName}</div>
                        <div><span className="text-gray-500">Email:</span> {detailUser.email}</div>
                        <div><span className="text-gray-500">Phone:</span> {detailUser.phoneNumber || 'N/A'}</div>
                        <div>
                          <span className="text-gray-500">Created At:</span>{' '}
                          {detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* KYC */}
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">KYC</h4>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            getKycStatusText(detailUser.kyc?.status, detailUser.isVerified) === 'APPROVED'
                              ? 'bg-green-100 text-green-700'
                              : getKycStatusText(detailUser.kyc?.status, detailUser.isVerified) === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : getKycStatusText(detailUser.kyc?.status, detailUser.isVerified) === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {getKycStatusText(detailUser.kyc?.status, detailUser.isVerified)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="text-xs text-gray-500">ID Card Front</div>
                        <div className="text-xs text-gray-500">ID Card Back</div>
                        <div className="bg-white border rounded-md p-2 flex items-center justify-center min-h-[140px]">
                          {detailUser.kyc?.documentFrontUrl ? (
                            <img
                              src={detailUser.kyc.documentFrontUrl}
                              alt="ID Card Front"
                              className="max-h-32 object-contain"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">No image</span>
                          )}
                        </div>
                        <div className="bg-white border rounded-md p-2 flex items-center justify-center min-h-[140px]">
                          {detailUser.kyc?.documentBackUrl ? (
                            <img
                              src={detailUser.kyc.documentBackUrl}
                              alt="ID Card Back"
                              className="max-h-32 object-contain"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">No image</span>
                          )}
                        </div>
                        {detailUser.kyc?.rejectionReason && (
                          <div className="sm:col-span-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md p-2">
                            Rejection Reason: {detailUser.kyc.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Roles & Permissions */}
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Roles & Permissions</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(detailUser.role)}`}>
                            {detailUser.role}
                          </span>
                        </div>
                        <div className="text-gray-600">{getPermissionLabel(detailUser.role)}</div>
                      </div>
                    </div>

                    {/* Trust Score Metrics */}
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Trust Score Metrics</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Trust Score</div>
                          <div className="font-semibold">{Number(detailUser.currentTrustScore).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Projects Completed</div>
                          <div className="font-semibold">{detailUser.totalProjectsFinished}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Disputes Lost</div>
                          <div className="font-semibold">{detailUser.totalDisputesLost}</div>
                        </div>
                      </div>
                    </div>

                    {/* Status Information */}
                    <div className="bg-gray-50 rounded-lg p-4 border lg:col-span-2">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Status Information</h4>
                      <div className="text-sm">
                        <div>
                          <span className="text-gray-500">Account Status:</span>{' '}
                          <span className={detailUser.isBanned ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                            {getStatusText(detailUser)}
                          </span>
                        </div>
                        {detailUser.isBanned && detailUser.banReason && (
                          <div className="mt-2 text-red-600">
                            Ban Reason: {detailUser.banReason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">No detail found</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ban Modal */}
        {showBanModal && selectedUser && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Ban className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Ban User</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowBanModal(false);
                      setBanReason('');
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-900">You are about to ban this user</p>
                      <p className="text-sm text-red-700 mt-1">
                        <strong>{selectedUser.fullName}</strong>
                        <span className="text-red-600"> ({selectedUser.email})</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for ban <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                    placeholder="Enter the reason for banning this user..."
                    rows={4}
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowBanModal(false);
                    setBanReason('');
                  }}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBanUser}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg hover:shadow-xl"
                >
                  Ban User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unban Modal */}
        {showUnbanModal && selectedUser && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <UserCheck className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Unban User</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowUnbanModal(false);
                      setUnbanReason('');
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <UserCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Restore user access</p>
                      <p className="text-sm text-green-700 mt-1">
                        <strong>{selectedUser.fullName}</strong>
                        <span className="text-green-600"> ({selectedUser.email})</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for unban <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                    placeholder="Enter the reason for unbanning this user..."
                    rows={4}
                    value={unbanReason}
                    onChange={(e) => setUnbanReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowUnbanModal(false);
                    setUnbanReason('');
                  }}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnbanUser}
                  className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all font-medium shadow-lg hover:shadow-xl"
                >
                  Unban User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
