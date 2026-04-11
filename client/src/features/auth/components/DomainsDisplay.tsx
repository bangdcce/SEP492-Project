/**
 * DomainsDisplay Component
 * Display and edit user domains in profile page
 */
import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Edit2, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { getUserDomains } from '../api';
import { DomainSelectionModal } from './DomainSelectionModal';

interface Domain {
  id: string;
  domainId: string;
  domainName: string;
  domainSlug: string;
  domainDescription: string | null;
  domainIcon: string | null;
  createdAt: string;
}

interface DomainsDisplayProps {
  userRole?: string;
}

export function DomainsDisplay({ userRole }: DomainsDisplayProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const normalizedRole = (userRole || '').toUpperCase();
  const isDomainEditableRole =
    normalizedRole === 'FREELANCER' || normalizedRole === 'BROKER' || normalizedRole === 'STAFF';

  const loadDomains = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }
      const response = await getUserDomains();
      setDomains(response.domains || []);
    } catch (error) {
      console.error('[DomainsDisplay] Failed to load domains:', error);
      toast.error('Failed to load domains');
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  const handleDomainsUpdated = useCallback(() => {
    void loadDomains(false);
  }, [loadDomains]);

  useEffect(() => {
    if (isDomainEditableRole) {
      void loadDomains(true);
    }
  }, [isDomainEditableRole, loadDomains]);

  if (!isDomainEditableRole) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Domains</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">Your professional domains/industries</p>

        {domains.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {domains.map((domain) => (
              <span
                key={domain.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
              >
                <Tag className="w-3 h-3" />
                {domain.domainName}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Briefcase className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No domains selected yet</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Select your domains
            </button>
          </div>
        )}
      </div>

      <DomainSelectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        currentDomainIds={domains.map((d) => d.domainId)}
        onDomainsUpdated={handleDomainsUpdated}
      />
    </>
  );
}
