import { forwardRef, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { common, createLowlight } from "lowlight";
import "highlight.js/styles/github.css";
import {
  AtSign,
  Bold,
  CheckSquare,
  Code,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  Link as LinkIcon,
  Loader2,
  List,
  ListOrdered,
  MoreHorizontal,
  Smile,
  Type as TypeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CodeBlockComponent from "./CodeBlockComponent";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { uploadImageToServer } from "../../utils/file-upload.service";

const lowlight = createLowlight(common);
const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});

type RichTextEditorProps = {
  placeholder?: string;
  onChange?: (html: string) => void;
  onSave?: (html: string) => Promise<void> | void;
  onCancel?: () => void;
  isSaving?: boolean;
  className?: string;
};

type ToolbarButtonProps = {
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ label, isActive, disabled, onClick, children }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded text-gray-600 transition",
          "hover:bg-gray-200 hover:text-gray-900",
          "disabled:cursor-not-allowed disabled:opacity-40",
          isActive && "bg-white text-gray-900 shadow-sm"
        )}
      >
        {children}
      </button>
    );
  }
);

ToolbarButton.displayName = "ToolbarButton";

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-gray-200" />;
}

export default function RichTextEditor({
  placeholder = "Add a comment...",
  onChange,
  onSave,
  onCancel,
  isSaving = false,
  className,
}: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlock.configure({ lowlight }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-blue-600 underline underline-offset-2",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList.configure({
        HTMLAttributes: {
          class: "task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:float-left before:text-gray-400 before:pointer-events-none before:h-0",
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[140px] w-full bg-white p-3 text-sm text-gray-900 focus:outline-none",
          "[&_p]:my-2 [&_p]:leading-relaxed",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
          "[&_li]:my-1",
          "[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2",
          "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-gray-100 [&_pre]:p-3",
          "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
          "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_img]:border [&_img]:border-gray-200",
          "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
          "[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold",
          "[&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs",
          "[&_[data-type=taskList]]:my-2 [&_[data-type=taskList]]:list-none [&_[data-type=taskList]]:pl-2",
          "[&_[data-type=taskItem]]:flex [&_[data-type=taskItem]]:items-start [&_[data-type=taskItem]]:gap-2",
          "[&_[data-type=taskItem]_input]:mt-1 [&_[data-type=taskItem]_input]:accent-blue-600"
        ),
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHasContent(!editor.isEmpty);
      onChange?.(html);
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  });

  const showActions = isFocused || hasContent;

  const handleSave = async () => {
    if (!editor || !onSave || editor.isEmpty) return;
    const html = editor.getHTML();
    try {
      await onSave(html);
      editor.commands.clearContent(true);
    } catch (error) {
      console.error("Failed to save comment:", error);
    }
  };

  const handleCancel = () => {
    if (!editor) return;
    editor.commands.clearContent(true);
    onCancel?.();
  };

  const handleOpenLinkPopover = () => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const selectedText = empty
      ? ""
      : editor.state.doc.textBetween(from, to, " ");
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previousUrl ?? "");
    setLinkText(selectedText);
    setLinkError(null);
    setLinkOpen(true);
  };

  const handleApplyLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    const url = linkUrl.trim();
    if (!url) {
      setLinkError("Please enter a valid URL.");
      return;
    }

    const selection = editor.state.selection;
    const displayText = linkText.trim();

    if (displayText) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: displayText,
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run();
    } else if (!selection.empty) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: url,
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run();
    }

    setLinkOpen(false);
    setLinkUrl("");
    setLinkText("");
    setLinkError(null);
  };

  const handleAddImage = () => {
    if (isUploadingImage) return;
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!editor) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const url = await uploadImageToServer(file, {
        bucket: "task-attachments",
        pathPrefix: "comments",
      });
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      console.error("Failed to upload image:", error);
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleInsertTable = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const handleToggleHeading = () => {
    if (!editor) return;
    if (editor.isActive("heading", { level: 3 })) {
      editor.chain().focus().setParagraph().run();
      return;
    }
    editor.chain().focus().toggleHeading({ level: 3 }).run();
  };

  if (!editor) {
    return (
      <div className={cn("rounded-md border border-gray-200 bg-white", className)}>
        <div className="h-10 border-b border-gray-200 bg-gray-50" />
        <div className="min-h-[140px] p-3 text-sm text-gray-400">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm",
        "focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30",
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <ToolbarButton
          label="Text style"
          onClick={handleToggleHeading}
          isActive={editor.isActive("heading", { level: 3 })}
        >
          <TypeIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Checklist"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive("taskList")}
        >
          <CheckSquare className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <ToolbarButton
              label="Link"
              onClick={handleOpenLinkPopover}
              isActive={editor.isActive("link") || linkOpen}
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <form onSubmit={handleApplyLink} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">
                  URL
                </label>
                <input
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://example.com"
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">
                  Display text (optional)
                </label>
                <input
                  value={linkText}
                  onChange={(event) => setLinkText(event.target.value)}
                  placeholder="Click here"
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              {linkError && (
                <p className="text-xs text-red-600">{linkError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLinkOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
        <ToolbarButton
          label={isUploadingImage ? "Uploading image" : "Image"}
          onClick={handleAddImage}
          disabled={isUploadingImage}
        >
          {isUploadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </ToolbarButton>
        <ToolbarButton
          label="Mention"
          onClick={() => editor.chain().focus().insertContent("@").run()}
        >
          <AtSign className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Emoji"
          onClick={() => editor.chain().focus().insertContent(":").run()}
        >
          <Smile className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Table" onClick={handleInsertTable}>
          <LayoutGrid className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <div className="ml-auto">
          <ToolbarButton label="More">
            <MoreHorizontal className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      <EditorContent editor={editor} />

      {showActions && (
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!onSave || !editor || editor.isEmpty || isSaving}
            className={cn(
              "rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm",
              "hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            )}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
