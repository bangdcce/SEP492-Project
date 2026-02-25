/**
 * CVUpload Component
 * Allows users to upload, view, and delete their CV (PDF or DOCX)
 */
import { useState, useRef, useEffect } from 'react';
import { FileText, Upload, Download, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadCV, getCV, deleteCV } from '../api';

interface CVUploadProps {
  currentCvUrl?: string | null;
  onCVUpdated?: () => void; // Callback to refresh profile
}

export function CVUpload({ currentCvUrl, onCVUpdated }: CVUploadProps) {
  const [cvUrl, setCvUrl] = useState<string | null>(currentCvUrl || null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state with prop changes (e.g., after profile reload)
  useEffect(() => {
    console.log('[CVUpload] currentCvUrl prop changed:', currentCvUrl);
    setCvUrl(currentCvUrl || null);
  }, [currentCvUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF and DOCX files are allowed');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must not exceed 5MB');
      return;
    }

    try {
      setUploading(true);
      const response = await uploadCV(file);
      console.log('[CVUpload] Upload response:', response);
      setCvUrl(response.cvUrl);
      toast.success('CV uploaded successfully');
      onCVUpdated?.();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to upload CV';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async () => {
    if (!cvUrl) return;

    try {
      // If it's a Supabase public URL, just open it
      if (cvUrl.startsWith('http')) {
        window.open(cvUrl, '_blank');
      } else {
        // Otherwise, fetch signed URL from API
        const response = await getCV();
        if (response.cvUrl) {
          window.open(response.cvUrl, '_blank');
        }
      }
      toast.success('Opening CV...');
    } catch (error) {
      toast.error('Failed to open CV');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your CV?')) return;

    try {
      setDeleting(true);
      await deleteCV();
      setCvUrl(null);
      toast.success('CV deleted successfully');
      onCVUpdated?.();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete CV';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const getCVFileName = () => {
    if (!cvUrl) return 'CV.pdf';
    try {
      const url = new URL(cvUrl);
      const pathParts = url.pathname.split('/');
      return pathParts[pathParts.length - 1] || 'CV.pdf';
    } catch {
      return 'CV.pdf';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">Curriculum Vitae (CV)</h4>
        {!cvUrl && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload CV
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />

      {cvUrl ? (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{getCVFileName()}</p>
                <p className="text-sm text-gray-600">Your professional resume</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                title="Download CV"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors text-sm"
                title="View CV"
              >
                <ExternalLink className="w-4 h-4" />
                View
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 border border-blue-300 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors disabled:opacity-50 text-sm"
                title="Replace CV"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Replace
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-2 border border-red-300 hover:bg-red-50 text-red-600 rounded-lg transition-colors disabled:opacity-50 text-sm"
                title="Delete CV"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
          <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-2">No CV uploaded yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Upload your CV (PDF or DOCX, max 5MB)
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Choose File
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        💡 Tip: A well-formatted CV helps the AI Matching system find the best projects for you
      </p>
    </div>
  );
}
