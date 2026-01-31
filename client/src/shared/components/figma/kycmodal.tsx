import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  ZoomIn, 
  Mail, 
  Briefcase, 
  Calendar,
  AlertCircle,
  Shield
} from 'lucide-react';

interface KYCData {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'sme' | 'broker' | 'freelancer';
  avatarImage?: string;
  idCardFront: string;
  idCardBack: string;
  selfieImage: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

interface KYCVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  kycData: KYCData;
  onApprove: (userId: string) => void;
  onReject: (userId: string, reason?: string) => void;
}

export const KYCVerificationModal: React.FC<KYCVerificationModalProps> = ({
  isOpen,
  onClose,
  kycData,
  onApprove,
  onReject,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectError, setRejectError] = useState('');
  const isPending = kycData.status === 'pending';
  const avatarSrc = kycData.avatarImage;

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleApprove = () => {
    if (!isPending) return;
    onApprove(kycData.userId);
  };

  const handleReject = () => {
    if (!isPending) return;
    if (showRejectInput) {
      if (!rejectReason.trim()) {
        setRejectError('Please provide a reason for rejection.');
        return;
      }
      setRejectError('');
      onReject(kycData.userId, rejectReason);
      setShowRejectInput(false);
      setRejectReason('');
      return;
    }
    setRejectError('');
    setShowRejectInput(true);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'sme':
        return 'Business Owner (SME)';
      case 'broker':
        return 'Broker';
      case 'freelancer':
        return 'Freelancer';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'sme':
        return 'from-teal-500 to-teal-600';
      case 'broker':
        return 'from-teal-500 to-teal-600';
      case 'freelancer':
        return 'from-teal-500 to-teal-600';
      default:
        return 'from-teal-500 to-teal-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-gradient-to-r from-green-500 to-emerald-500';
      case 'rejected':
        return 'bg-gradient-to-r from-red-500 to-rose-500';
      default:
        return 'bg-gradient-to-r from-yellow-500 to-amber-500';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-br from-slate-900/80 to-blue-900/80 backdrop-blur-md z-50"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Gradient */}
              <div className={`bg-gradient-to-r ${getRoleColor(kycData.userRole)} px-8 py-6 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">KYC Verification</h2>
                      <p className="text-white/90 text-sm mt-1">
                        Review identity documents and verification
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-md"
                    aria-label="Close modal"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* User Profile Card */}
                <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-slate-200/50 shadow-sm">
                  <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={`absolute inset-0 bg-gradient-to-r ${getRoleColor(kycData.userRole)} rounded-2xl blur-lg opacity-30`}></div>
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={kycData.userName}
                          className="relative w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg"
                        />
                      ) : (
                        <div className="relative w-24 h-24 rounded-2xl bg-blue-500 border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl font-bold">
                          {getInitials(kycData.userName)}
                        </div>
                      )}
                    </div>

                    {/* User Details */}
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-bold text-slate-900">{kycData.userName}</h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${getRoleColor(
                            kycData.userRole
                          )} text-white text-sm rounded-full shadow-sm`}
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          {getRoleLabel(kycData.userRole)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Mail className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Email Address</p>
                            <p className="text-sm text-slate-900 font-medium">{kycData.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Calendar className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Submitted At</p>
                            <p className="text-sm text-slate-900 font-medium">{kycData.submittedAt}</p>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(kycData.status)}`}></div>
                        <span className="text-sm text-slate-700">
                          Status: <span className="font-semibold">{kycData.status.charAt(0).toUpperCase() + kycData.status.slice(1)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ID Documents Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                    <h3 className="text-lg font-semibold text-slate-900">Identity Documents</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Front ID */}
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                        <p className="text-sm font-semibold text-slate-700">ID Card - Front Side</p>
                      </div>
                      <div
                        className="relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 aspect-[16/10] bg-gradient-to-br from-slate-100 to-slate-200"
                        onClick={() => setSelectedImage(kycData.idCardFront)}
                      >
                        <img
                          src={kycData.idCardFront}
                          alt="ID Card Front"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                          <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <ZoomIn className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 px-3 py-1 bg-blue-600 text-white text-xs rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          Click to enlarge
                        </div>
                      </div>
                    </motion.div>

                    {/* Back ID */}
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
                        <p className="text-sm font-semibold text-slate-700">ID Card - Back Side</p>
                      </div>
                      <div
                        className="relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 aspect-[16/10] bg-gradient-to-br from-slate-100 to-slate-200"
                        onClick={() => setSelectedImage(kycData.idCardBack)}
                      >
                        <img
                          src={kycData.idCardBack}
                          alt="ID Card Back"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                          <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <ZoomIn className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 px-3 py-1 bg-purple-600 text-white text-xs rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          Click to enlarge
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Selfie Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                    <h3 className="text-lg font-semibold text-slate-900">Selfie Verification</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                  </div>

                  <div className="max-w-sm mx-auto">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-1 h-4 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
                        <p className="text-sm font-semibold text-slate-700">Selfie with ID Card</p>
                      </div>
                      <div
                        className="relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200"
                        onClick={() => setSelectedImage(kycData.selfieImage)}
                      >
                        <img
                          src={kycData.selfieImage}
                          alt="Selfie Verification"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                          <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <ZoomIn className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 px-3 py-1 bg-green-600 text-white text-xs rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          Click to enlarge
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Reject Reason Input */}
                <AnimatePresence>
                  {showRejectInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <label htmlFor="reject-reason" className="font-semibold text-red-900">
                          Rejection Reason
                        </label>
                      </div>
                      <textarea
                        id="reject-reason"
                        value={rejectReason}
                        onChange={(e) => {
                          setRejectReason(e.target.value);
                          if (rejectError) setRejectError('');
                        }}
                        placeholder="Please provide a reason for rejection..."
                        className="w-full px-4 py-3 border-2 border-red-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none bg-white text-slate-900 placeholder-slate-400"
                        rows={3}
                        autoFocus
                      />
                      {rejectError && (
                        <p className="text-sm text-red-600">{rejectError}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rejection Reason (if already rejected) */}
                {kycData.status === 'rejected' && kycData.rejectionReason && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-semibold text-red-900">Rejection Reason</span>
                    </div>
                    <p className="text-sm text-red-700">{kycData.rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Footer - Action Buttons */}
              <div className="px-8 py-6 bg-gradient-to-br from-slate-50 to-slate-100 border-t border-slate-200">
                {isPending ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    {!showRejectInput && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        className="flex-1 px-6 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 shadow-sm"
                      >
                        Cancel
                      </motion.button>
                    )}
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleReject}
                      className="flex-1 px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      <XCircle className="w-5 h-5" />
                      {showRejectInput ? 'Confirm Rejection' : 'Reject KYC'}
                    </motion.button>

                    {!showRejectInput && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleApprove}
                        className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Approve KYC
                      </motion.button>
                    )}

                    {showRejectInput && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setShowRejectInput(false);
                          setRejectReason('');
                        }}
                        className="flex-1 px-6 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 shadow-sm"
                      >
                        Cancel Rejection
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onClose}
                      className="px-6 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 shadow-sm"
                    >
                      Close
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Image Zoom Modal */}
          <AnimatePresence>
            {selectedImage && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60]"
                  onClick={() => setSelectedImage(null)}
                />
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative max-w-6xl max-h-[90vh] w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-16 right-0 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all duration-200 group"
                      aria-label="Close zoom"
                    >
                      <X className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-2 shadow-2xl">
                      <img
                        src={selectedImage}
                        alt="Zoomed view"
                        className="w-full h-full object-contain rounded-xl max-h-[85vh]"
                      />
                    </div>
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};
