import React, { memo } from "react";
import {
  Download,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  FileSpreadsheet,
  FileAudio,
  FileVideo,
  File,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import { isImage, isPdf } from "./constants";
import type { DisputeEvidence } from "@/features/disputes/types/dispute.types";

interface EvidencePreviewProps {
  evidence: DisputeEvidence;
  onClose: () => void;
  onDownload: () => void;
}

const fileIcon = (mimeType?: string | null) => {
  if (!mimeType) return <File className="h-8 w-8 text-slate-400" />;
  if (mimeType.startsWith("audio/"))
    return <FileAudio className="h-8 w-8 text-purple-500" />;
  if (mimeType.startsWith("video/"))
    return <FileVideo className="h-8 w-8 text-blue-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="h-8 w-8 text-sky-500" />;
  return <File className="h-8 w-8 text-slate-400" />;
};

export const EvidencePreview = memo(function EvidencePreview({
  evidence,
  onClose,
  onDownload,
}: EvidencePreviewProps) {
  const [zoom, setZoom] = React.useState(1);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleReset = () => setZoom(1);

  return (
    <div className="flex flex-col border-b border-slate-200 bg-slate-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {evidence.fileName}
          </p>
          <p className="text-xs text-slate-500">
            {evidence.mimeType} ·{" "}
            {Math.max(1, Math.round(evidence.fileSize / 1024))} KB
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isImage(evidence.mimeType) && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleZoomOut}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-200 transition-colors"
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4 text-slate-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
              <button
                onClick={handleReset}
                className="h-8 px-2 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              >
                {Math.round(zoom * 100)}%
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleZoomIn}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-200 transition-colors"
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4 text-slate-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
              <div className="mx-1 h-5 w-px bg-slate-300" />
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDownload}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-200 transition-colors"
                aria-label="Download evidence"
              >
                <Download className="h-4 w-4 text-slate-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
          {evidence.signedUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={evidence.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-200 transition-colors"
                  aria-label="Open in new tab"
                >
                  <Maximize2 className="h-4 w-4 text-slate-600" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Open full-screen</TooltipContent>
            </Tooltip>
          )}
          <div className="mx-1 h-5 w-px bg-slate-300" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClose}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-rose-100 text-rose-600 transition-colors"
                aria-label="Close evidence preview"
              >
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Close preview</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Preview area — reduced from 42% to 30%, max-h capped */}
      <div className="h-[30vh] max-h-80 min-h-45 overflow-hidden">
        {isImage(evidence.mimeType) && evidence.signedUrl ? (
          <div className="h-full w-full overflow-auto flex items-center justify-center bg-slate-100/50 cursor-grab active:cursor-grabbing">
            <img
              src={evidence.signedUrl}
              alt={evidence.fileName}
              className="max-h-full transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          </div>
        ) : isPdf(evidence.mimeType) && evidence.signedUrl ? (
          <iframe
            src={evidence.signedUrl}
            title={evidence.fileName}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-100/50">
            {fileIcon(evidence.mimeType)}
            <p className="text-sm text-slate-600">
              Preview not available for this file type
            </p>
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download to view
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
