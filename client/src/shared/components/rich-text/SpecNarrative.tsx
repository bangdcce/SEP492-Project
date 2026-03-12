import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  RotateCcw,
  RotateCw,
  Underline as UnderlineIcon,
  Unlink,
} from "lucide-react";

import { Button } from "@/shared/components/ui/Button";
import { cn } from "@/shared/utils/utils";

export type NarrativeDocument = Record<string, unknown>;

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const narrativeExtensions = [
  StarterKit.configure({
    strike: false,
    code: false,
    codeBlock: false,
    heading: {
      levels: [1, 2, 3],
    },
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    HTMLAttributes: {
      class: "text-teal-700 underline underline-offset-2",
    },
  }),
  TaskList.configure({
    HTMLAttributes: {
      class: "task-list",
    },
  }),
  TaskItem.configure({
    nested: false,
  }),
  Underline,
  Placeholder.configure({
    emptyEditorClass:
      "before:pointer-events-none before:float-left before:h-0 before:text-slate-400 before:content-[attr(data-placeholder)]",
  }),
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeNarrativeContent = (
  value: NarrativeDocument | null | undefined,
): JSONContent => {
  if (isRecord(value) && value.type === "doc") {
    return value as JSONContent;
  }
  return EMPTY_DOC;
};

const hasMeaningfulNarrativeContent = (
  value: NarrativeDocument | null | undefined,
): boolean => {
  const nodeHasMeaningfulContent = (node: unknown): boolean => {
    if (!isRecord(node)) return false;
    if (typeof node.text === "string" && node.text.trim().length > 0) {
      return true;
    }
    if (node.type === "horizontalRule") {
      return true;
    }
    if (Array.isArray(node.content)) {
      return node.content.some((child) => nodeHasMeaningfulContent(child));
    }
    return false;
  };

  const content = normalizeNarrativeContent(value).content;
  return Array.isArray(content) ? content.some((node) => nodeHasMeaningfulContent(node)) : false;
};

type ToolbarButtonProps = {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
};

function ToolbarButton({
  active = false,
  children,
  label,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition",
        "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
        active && "border-teal-200 bg-teal-50 text-teal-700",
      )}
    >
      {children}
    </button>
  );
}

interface SpecNarrativeEditorProps {
  value?: NarrativeDocument | null;
  onChange: (value: NarrativeDocument | null) => void;
  placeholder?: string;
  className?: string;
}

export function SpecNarrativeEditor({
  value,
  onChange,
  placeholder = "Write the detailed scope notes, assumptions, exclusions, and delivery clarifications here...",
  className,
}: SpecNarrativeEditorProps) {
  const editor = useEditor({
    extensions: narrativeExtensions.map((extension) =>
      extension.name === "placeholder"
        ? Placeholder.configure({
            placeholder,
            emptyEditorClass:
              "before:pointer-events-none before:float-left before:h-0 before:text-slate-400 before:content-[attr(data-placeholder)]",
          })
        : extension,
    ),
    content: normalizeNarrativeContent(value),
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[220px] w-full bg-white px-4 py-3 text-sm leading-7 text-slate-800 focus:outline-none",
          "[&_p]:my-2 [&_p]:leading-7",
          "[&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
          "[&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold",
          "[&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.14em] [&_h3]:text-slate-600",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
          "[&_li]:my-1",
          "[&_strong]:font-semibold [&_strong]:text-slate-950",
          "[&_em]:italic",
          "[&_u]:underline [&_u]:underline-offset-2",
          "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-teal-200 [&_blockquote]:bg-teal-50/40 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:text-slate-700",
          "[&_hr]:my-4 [&_hr]:border-slate-200",
          "[&_.task-list]:list-none [&_.task-list]:pl-0",
          "[&_.task-list_li]:flex [&_.task-list_li]:items-start [&_.task-list_li]:gap-2",
          "[&_.task-list_li>label]:mt-1",
          className,
        ),
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      const nextValue = nextEditor.getJSON() as NarrativeDocument;
      onChange(hasMeaningfulNarrativeContent(nextValue) ? nextValue : null);
    },
  });

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isBoldActive: currentEditor.isActive("bold"),
      isItalicActive: currentEditor.isActive("italic"),
      isUnderlineActive: currentEditor.isActive("underline"),
      isHeading1Active: currentEditor.isActive("heading", { level: 1 }),
      isHeading2Active: currentEditor.isActive("heading", { level: 2 }),
      isHeading3Active: currentEditor.isActive("heading", { level: 3 }),
      isBulletListActive: currentEditor.isActive("bulletList"),
      isOrderedListActive: currentEditor.isActive("orderedList"),
      isTaskListActive: currentEditor.isActive("taskList"),
      isBlockquoteActive: currentEditor.isActive("blockquote"),
      isLinkActive: currentEditor.isActive("link"),
      canUndo: currentEditor.can().undo(),
      canRedo: currentEditor.can().redo(),
    }),
  });

  useEffect(() => {
    if (!editor) return;
    const nextContent = normalizeNarrativeContent(value);
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(nextContent);
    if (current !== next) {
      editor.commands.setContent(nextContent);
    }
  }, [editor, value]);

  const normalizeLinkUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const runEditorCommand = (
    command: (
      chain: ReturnType<NonNullable<typeof editor>["chain"]>,
    ) => { run: () => boolean },
  ) => {
    if (!editor) return;
    const selection = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    command(editor.chain().focus().setTextSelection(selection)).run();
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl =
      typeof editor.getAttributes("link").href === "string"
        ? (editor.getAttributes("link").href as string)
        : "";
    const url = window.prompt("Enter a URL", previousUrl);
    if (url === null) return;
    const normalizedUrl = normalizeLinkUrl(url);
    if (!normalizedUrl) {
      runEditorCommand((chain) => chain.extendMarkRange("link").unsetLink());
      return;
    }
    runEditorCommand((chain) =>
      chain.extendMarkRange("link").setLink({ href: normalizedUrl }),
    );
  };

  if (!editor) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-3">
        <ToolbarButton
          label="Bold"
          active={toolbarState?.isBoldActive}
          onClick={() => runEditorCommand((chain) => chain.toggleBold())}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={toolbarState?.isItalicActive}
          onClick={() => runEditorCommand((chain) => chain.toggleItalic())}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={toolbarState?.isUnderlineActive}
          onClick={() => runEditorCommand((chain) => chain.toggleUnderline())}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 1"
          active={toolbarState?.isHeading1Active}
          onClick={() =>
            runEditorCommand((chain) => chain.toggleHeading({ level: 1 }))
          }
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={toolbarState?.isHeading2Active}
          onClick={() =>
            runEditorCommand((chain) => chain.toggleHeading({ level: 2 }))
          }
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={toolbarState?.isHeading3Active}
          onClick={() =>
            runEditorCommand((chain) => chain.toggleHeading({ level: 3 }))
          }
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={toolbarState?.isBulletListActive}
          onClick={() => runEditorCommand((chain) => chain.toggleBulletList())}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={toolbarState?.isOrderedListActive}
          onClick={() =>
            runEditorCommand((chain) => chain.toggleOrderedList())
          }
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Checklist"
          active={toolbarState?.isTaskListActive}
          onClick={() => runEditorCommand((chain) => chain.toggleTaskList())}
        >
          <ListChecks className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={toolbarState?.isBlockquoteActive}
          onClick={() => runEditorCommand((chain) => chain.toggleBlockquote())}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Insert divider"
          onClick={() => runEditorCommand((chain) => chain.setHorizontalRule())}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Set link"
          active={toolbarState?.isLinkActive}
          onClick={setLink}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Remove link"
          onClick={() => runEditorCommand((chain) => chain.unsetLink())}
        >
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!toolbarState?.canUndo}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!toolbarState?.canRedo}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Redo
          </Button>
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

interface SpecNarrativeRendererProps {
  value?: NarrativeDocument | null;
  className?: string;
  emptyState?: string;
}

export function SpecNarrativeRenderer({
  value,
  className,
  emptyState = "No detailed scope notes were captured for this record.",
}: SpecNarrativeRendererProps) {
  const editor = useEditor({
    extensions: narrativeExtensions,
    content: normalizeNarrativeContent(value),
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-slate max-w-none text-sm leading-7 text-slate-700",
          "prose-headings:tracking-tight prose-headings:text-slate-950",
          "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-sm prose-h3:uppercase prose-h3:tracking-[0.18em] prose-h3:text-slate-500",
          "prose-p:my-2 prose-p:text-slate-700",
          "prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
          "prose-strong:text-slate-950",
          "prose-em:text-slate-700",
          "prose-a:text-teal-700 prose-a:underline prose-a:underline-offset-2",
          "prose-blockquote:border-l-4 prose-blockquote:border-teal-200 prose-blockquote:bg-teal-50/40 prose-blockquote:py-2 prose-blockquote:text-slate-700",
          "prose-hr:my-5 prose-hr:border-slate-200",
          "[&_.task-list]:list-none [&_.task-list]:pl-0",
          "[&_.task-list_li]:flex [&_.task-list_li]:items-start [&_.task-list_li]:gap-2",
          "[&_u]:underline [&_u]:underline-offset-2",
          className,
        ),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextContent = normalizeNarrativeContent(value);
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(nextContent);
    if (current !== next) {
      editor.commands.setContent(nextContent);
    }
  }, [editor, value]);

  if (!hasMeaningfulNarrativeContent(value)) {
    return <p className="text-sm leading-7 text-slate-500">{emptyState}</p>;
  }

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} />;
}

export function narrativeHasContent(value?: NarrativeDocument | null) {
  return hasMeaningfulNarrativeContent(value);
}
