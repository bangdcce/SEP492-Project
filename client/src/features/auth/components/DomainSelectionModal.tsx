/**
 * DomainSelectionModal Component
 * Modal for selecting/editing user domains
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getSkillDomains, type SkillDomain } from '../skills-api';
import { deleteCustomUserDomain, updateUserDomains } from '../api';

const CUSTOM_DOMAIN_PREFIX = '__other_domain__:';
const MAX_TOTAL_DOMAINS = 10;
const MAX_CUSTOM_DOMAINS = 10;

interface DomainSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDomainIds: string[];
  onDomainsUpdated: () => void;
}

export function DomainSelectionModal({
  isOpen,
  onClose,
  currentDomainIds,
  onDomainsUpdated,
}: DomainSelectionModalProps) {
  const [availableDomains, setAvailableDomains] = useState<SkillDomain[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>(currentDomainIds);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [customDomains, setCustomDomains] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      void loadDomains();
      setSelectedDomains(currentDomainIds);
      setCustomDomains([]);
      setCustomDomainInput('');
    }
  }, [isOpen]);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const domains = await getSkillDomains();
      setAvailableDomains(domains || []);
    } catch (error) {
      console.error('[DomainSelectionModal] Failed to load domains:', error);
      toast.error('Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  const toggleDomain = (domainId: string) => {
    const isAdding = !selectedDomains.includes(domainId);
    if (isAdding && selectedDomains.length + customDomains.length >= MAX_TOTAL_DOMAINS) {
      toast.error(`You can select up to ${MAX_TOTAL_DOMAINS} domains in total`);
      return;
    }

    setSelectedDomains((prev) =>
      prev.includes(domainId)
        ? prev.filter((id) => id !== domainId)
        : [...prev, domainId],
    );
  };

  const handleSave = async () => {
    const mergedDomains = [
      ...selectedDomains,
      ...customDomains.map((value) => `${CUSTOM_DOMAIN_PREFIX}${value}`),
    ];

    if (mergedDomains.length === 0) {
      toast.error('Please select at least one domain');
      return;
    }

    if (mergedDomains.length > MAX_TOTAL_DOMAINS) {
      toast.error(`You can select up to ${MAX_TOTAL_DOMAINS} domains in total`);
      return;
    }

    try {
      setSaving(true);
      await updateUserDomains(mergedDomains);
      toast.success('Domains updated successfully');
      onDomainsUpdated();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update domains');
    } finally {
      setSaving(false);
    }
  };

  const sanitizeCustomLabel = (value: string) =>
    value
      .replace(/\s+/g, ' ')
      .trim();

  const addCustomDomain = () => {
    const value = sanitizeCustomLabel(customDomainInput);
    if (!value) {
      return;
    }

    if (value.length < 2) {
      toast.error('Custom domain must be at least 2 characters');
      return;
    }

    if (customDomains.length >= MAX_CUSTOM_DOMAINS) {
      toast.error(`You can add up to ${MAX_CUSTOM_DOMAINS} custom domains`);
      return;
    }

    if (selectedDomains.length + customDomains.length >= MAX_TOTAL_DOMAINS) {
      toast.error(`You can select up to ${MAX_TOTAL_DOMAINS} domains in total`);
      return;
    }

    const normalizedValue = value.toLowerCase();
    const duplicateInMaster = availableDomains.some(
      (domain) => domain.name.toLowerCase() === normalizedValue,
    );
    const duplicateInCustom = customDomains.some(
      (domainName) => domainName.toLowerCase() === normalizedValue,
    );

    if (duplicateInMaster || duplicateInCustom) {
      toast.error('This domain already exists');
      return;
    }

    setCustomDomains((prev) => [...prev, value]);
    setCustomDomainInput('');
  };

  const removeCustomDomain = (domainName: string) => {
    setCustomDomains((prev) => prev.filter((domain) => domain !== domainName));
  };

  const isCustomDomain = (domain: SkillDomain) =>
    (domain.description || '').toLowerCase().startsWith('user-added');

  const handleDeletePersistedCustomDomain = async (domainId: string) => {
    try {
      setSaving(true);
      await deleteCustomUserDomain(domainId);
      setAvailableDomains((prev) => prev.filter((domain) => domain.id !== domainId));
      setSelectedDomains((prev) => prev.filter((id) => id !== domainId));
      toast.success('Custom domain deleted successfully');
      onDomainsUpdated();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete custom domain');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Select Your Domains</h3>
            <p className="text-sm text-gray-600 mt-1">
              Choose the domains/industries you work in
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={saving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Selected: <span className="font-semibold text-blue-600">{selectedDomains.length + customDomains.length}</span> domain{selectedDomains.length + customDomains.length !== 1 ? 's' : ''}
                </p>
                {(selectedDomains.length > 0 || customDomains.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDomains([]);
                      setCustomDomains([]);
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableDomains.map((domain) => {
                  const isSelected = selectedDomains.includes(domain.id);
                  return (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => toggleDomain(domain.id)}
                      className={`
                        p-3 rounded-lg border-2 text-left
                        transition-all duration-200
                        ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">{domain.name}</div>
                          {domain.description && (
                            <div className="text-xs text-gray-500 mt-1">{domain.description}</div>
                          )}
                        </div>
                        {isCustomDomain(domain) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeletePersistedCustomDomain(domain.id);
                            }}
                            className="ml-2 text-red-500 hover:text-red-700 font-bold text-sm"
                            aria-label={`Delete ${domain.name}`}
                            disabled={saving}
                          >
                            x
                          </button>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {availableDomains.length === 0 && !loading && (
                <p className="text-center text-gray-500 py-8">No domains available</p>
              )}

              <div className="mt-5 border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Can&apos;t find your domain? Add your own
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customDomainInput}
                    onChange={(e) => setCustomDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomDomain();
                      }
                    }}
                    placeholder="Type custom domain..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomDomain}
                    className="px-3 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-md text-sm font-medium"
                  >
                    Add
                  </button>
                </div>

                {customDomains.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customDomains.map((domainName) => (
                      <span
                        key={domainName}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"
                      >
                        {domainName}
                        <button
                          type="button"
                          onClick={() => removeCustomDomain(domainName)}
                          className="text-blue-700 hover:text-blue-900"
                          aria-label={`Remove ${domainName}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selectedDomains.length + customDomains.length === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Domains
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
