import type { ChangeEvent } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
];

export default function CodeBlockComponent({
  node,
  updateAttributes,
}: NodeViewProps) {
  const currentLanguage = node.attrs.language || "auto";

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateAttributes({ language: value === "auto" ? null : value });
  };

  return (
    <NodeViewWrapper className="relative my-3 overflow-hidden rounded-md border border-gray-200 bg-gray-50 text-slate-800 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2 text-[11px] text-gray-500">
        <span className="font-semibold uppercase tracking-wide text-gray-400">
          Code
        </span>
        <select
          value={currentLanguage}
          onChange={handleLanguageChange}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 focus:border-blue-400 focus:outline-none"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <pre className="hljs overflow-x-auto p-3 text-[12px] leading-relaxed">
        <NodeViewContent
          as="code"
          className={cn(
            "font-mono",
            currentLanguage !== "auto" && `language-${currentLanguage}`
          )}
        />
      </pre>
    </NodeViewWrapper>
  );
}
