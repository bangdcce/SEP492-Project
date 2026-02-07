import { useState, useEffect } from 'react';
import { AlertTriangle, X, Eye, EyeOff, Loader2, Shield, CheckCircle2, XCircle, ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { checkObligations, deleteAccount } from '@/features/auth/api';
import { STORAGE_KEYS, ROUTES } from '@/constants';
import { useNavigate } from 'react-router-dom';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export function DeleteAccountModal({ isOpen, onClose, userEmail }: DeleteAccountModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'warning' | 'confirm'>('warning');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [obligations, setObligations] = useState<{
    hasObligations: boolean;
    activeProjects: number;
    walletBalance: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setStep('warning');
      setPassword('');
      setShowPassword(false);
      setObligations(null);
      
      // Check for obligations when modal opens
      checkUserObligations();
    }
  }, [isOpen]);

  const checkUserObligations = async () => {
    try {
      setChecking(true);
      const result = await checkObligations();
      setObligations(result);
    } catch (error: any) {
      toast.error('Failed to check account obligations');
    } finally {
      setChecking(false);
    }
  };

  const handleProceedToConfirm = () => {
    if (obligations?.hasObligations) {
      toast.error('Please complete active projects and withdraw balance before deleting account');
      return;
    }
    setStep('confirm');
  };

  const handleDeleteAccount = async () => {
    if (!password.trim()) {
      toast.error('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      await deleteAccount(password);
      
      // Clear local storage
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      
      toast.success('Account has been deleted successfully');
      
      // Redirect to landing page
      navigate(ROUTES.LANDING, { replace: true });
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete account. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      {/* Backdrop with blur effect */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Step Indicator */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
          <div className="flex items-center justify-center gap-3">
            <div className={`flex items-center gap-2 ${step === 'warning' ? 'text-red-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === 'warning' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {step === 'confirm' ? <CheckCircle2 className="w-5 h-5" /> : '1'}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Review</span>
            </div>
            <div className={`w-12 h-0.5 ${step === 'confirm' ? 'bg-red-400' : 'bg-gray-200'}`} />
            <div className={`flex items-center gap-2 ${step === 'confirm' ? 'text-red-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === 'confirm' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                2
              </div>
              <span className="text-sm font-medium hidden sm:inline">Confirm</span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {step === 'confirm' && (
              <button
                onClick={() => setStep('warning')}
                className="p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="p-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg shadow-red-200">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Delete Account</h2>
              <p className="text-xs text-gray-500">
                {step === 'warning' ? 'Step 1 of 2' : 'Step 2 of 2'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">
          {step === 'warning' && (
            <div className="space-y-4">
              {/* Warning Banner */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-5">
                <div className="flex gap-4">
                  <div className="shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-800 mb-2">
                      Warning: This action cannot be undone!
                    </h3>
                    <ul className="text-sm text-red-700 space-y-2">
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>All your personal data will be permanently deleted</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>You will lose access to all projects</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Transaction history and reviews will be hidden</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Your email cannot be reused for registration</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Obligations Check */}
              {checking ? (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-gray-600">Checking account status...</span>
                  </div>
                </div>
              ) : obligations?.hasObligations ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <div className="flex gap-4">
                    <div className="shrink-0">
                      <Shield className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-amber-800 mb-2">
                        Cannot delete account
                      </h3>
                      <p className="text-sm text-amber-700 mb-3">
                        Please resolve the following before proceeding:
                      </p>
                      <div className="space-y-2">
                        {obligations.activeProjects > 0 && (
                          <div className="flex items-center gap-2 text-sm bg-amber-100 rounded-lg px-3 py-2">
                            <span className="font-medium text-amber-800">
                              {obligations.activeProjects} active project(s)
                            </span>
                          </div>
                        )}
                        {obligations.walletBalance > 0 && (
                          <div className="flex items-center gap-2 text-sm bg-amber-100 rounded-lg px-3 py-2">
                            <span className="font-medium text-amber-800">
                              Wallet balance: ${obligations.walletBalance.toLocaleString('en-US')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : obligations && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <div>
                      <p className="font-medium text-emerald-800">
                        No active obligations
                      </p>
                      <p className="text-sm text-emerald-600">
                        You can proceed with account deletion.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Info */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-600 font-semibold text-sm">
                      {userEmail.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Account</p>
                    <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Confirm your identity
                </h3>
                <p className="text-sm text-gray-500">
                  Enter your password to permanently delete your account
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-12 transition-colors"
                    autoComplete="current-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">
                    <strong>Final warning:</strong> This will permanently delete all your data. 
                    You will be logged out immediately.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {step === 'warning' ? (
              <button
                onClick={handleProceedToConfirm}
                disabled={checking || obligations?.hasObligations}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-200"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleDeleteAccount}
                disabled={loading || !password.trim()}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
