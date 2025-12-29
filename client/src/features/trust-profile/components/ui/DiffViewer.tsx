/**
 * DiffViewer Component
 * Displays text differences between two versions
 * Uses simple word-level diff with color highlighting
 */

interface DiffViewerProps {
  oldText: string;
  newText: string;
  label?: string;
}

export function DiffViewer({ oldText, newText, label }: DiffViewerProps) {
  // Simple word-level diff algorithm
  const getDiff = () => {
    const oldWords = oldText.split(/(\s+)/);
    const newWords = newText.split(/(\s+)/);

    const changes: Array<{
      type: "added" | "removed" | "unchanged";
      text: string;
    }> = [];

    let i = 0;
    let j = 0;

    while (i < oldWords.length || j < newWords.length) {
      if (i >= oldWords.length) {
        // Only new words remaining
        changes.push({ type: "added", text: newWords[j] });
        j++;
      } else if (j >= newWords.length) {
        // Only old words remaining
        changes.push({ type: "removed", text: oldWords[i] });
        i++;
      } else if (oldWords[i] === newWords[j]) {
        // Words match
        changes.push({ type: "unchanged", text: oldWords[i] });
        i++;
        j++;
      } else {
        // Words differ - simple approach: mark old as removed, new as added
        changes.push({ type: "removed", text: oldWords[i] });
        changes.push({ type: "added", text: newWords[j] });
        i++;
        j++;
      }
    }

    return changes;
  };

  const diff = getDiff();
  const hasChanges = diff.some((d) => d.type !== "unchanged");

  if (!hasChanges) {
    return (
      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200">
        {label && <div className="text-xs text-gray-500 mb-2">{label}</div>}
        <div className="text-gray-700">{newText}</div>
      </div>
    );
  }

  return (
    <div className="text-sm bg-white rounded-lg p-4 border border-gray-200">
      {label && <div className="text-xs text-gray-500 mb-2">{label}</div>}
      <div className="space-y-2">
        {/* Old Version (Removed) */}
        <div className="bg-red-50 rounded p-3 border border-red-200">
          <div className="text-xs text-red-600 mb-1">Original:</div>
          <div className="text-gray-700 leading-relaxed">
            {diff.map((change, idx) => {
              if (change.type === "removed") {
                return (
                  <span
                    key={idx}
                    className="bg-red-200 text-red-900 line-through"
                  >
                    {change.text}
                  </span>
                );
              } else if (change.type === "unchanged") {
                return <span key={idx}>{change.text}</span>;
              }
              return null;
            })}
          </div>
        </div>

        {/* New Version (Added) */}
        <div className="bg-teal-50 rounded p-3 border border-teal-200">
          <div className="text-xs text-teal-600 mb-1">Updated:</div>
          <div className="text-gray-700 leading-relaxed">
            {diff.map((change, idx) => {
              if (change.type === "added") {
                return (
                  <span key={idx} className="bg-teal-200 text-teal-900">
                    {change.text}
                  </span>
                );
              } else if (change.type === "unchanged") {
                return <span key={idx}>{change.text}</span>;
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
