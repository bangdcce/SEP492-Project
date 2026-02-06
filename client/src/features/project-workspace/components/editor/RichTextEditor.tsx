import { forwardRef, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  FormEvent,
  ReactNode,
} from "react";
import type { NodeViewProps } from "@tiptap/react";
import {
  EditorContent,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color as TextColor } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";
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
  CheckCircle2,
  ChevronDown,
  Code,
  Calendar,
  GitMerge,
  Info,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  Link as LinkIcon,
  Loader2,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Palette,
  Quote,
  Plus,
  Search,
  Smile,
  Type as TypeIcon,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CodeBlockComponent from "./CodeBlockComponent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { uploadImageToServer } from "../../utils/file-upload.service";

const lowlight = createLowlight(common);
const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});

const InfoPanel = TiptapNode.create({
  name: "infoPanel",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="info-panel"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "info-panel",
        class: "info-panel",
      }),
      0,
    ];
  },
});

const ExpandNode = TiptapNode.create({
  name: "expand",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'details[data-type="expand"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        "data-type": "expand",
      }),
      ["summary", { "data-type": "expand-summary" }, "Expand"],
      ["div", { "data-type": "expand-content" }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ExpandNodeView);
  },
});

const DecisionNode = TiptapNode.create({
  name: "decision",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="decision"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "decision",
      }),
      ["div", { "data-type": "decision-title" }, "Decision"],
      ["div", { "data-type": "decision-body" }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DecisionNodeView);
  },
});

const DatePillNode = TiptapNode.create({
  name: "datePill",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      value: {
        default: "",
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="date-pill"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "date-pill" }),
      ["input", { type: "date", value: HTMLAttributes.value ?? "" }],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DatePillNodeView);
  },
});

function ExpandNodeView() {
  return (
    <NodeViewWrapper as="details" data-type="expand">
      <summary data-type="expand-summary" contentEditable={false}>
        Expand
      </summary>
      <NodeViewContent as="div" data-type="expand-content" />
    </NodeViewWrapper>
  );
}

function DecisionNodeView() {
  return (
    <NodeViewWrapper data-type="decision">
      <div data-type="decision-title" contentEditable={false}>
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span>Decision</span>
      </div>
      <NodeViewContent as="div" data-type="decision-body" />
    </NodeViewWrapper>
  );
}

function DatePillNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const value = node.attrs.value ?? "";

  return (
    <NodeViewWrapper as="span" data-type="date-pill">
      <input
        type="date"
        value={value}
        onChange={(event) => updateAttributes({ value: event.target.value })}
        contentEditable={false}
        disabled={!editor.isEditable}
      />
    </NodeViewWrapper>
  );
}

type RichTextEditorProps = {
  placeholder?: string;
  onChange?: (html: string) => void;
  onSave?: (html: string) => Promise<void> | void;
  onCancel?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  className?: string;
};

type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  isActive?: boolean;
  children: ReactNode;
};

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ label, isActive, children, className, type, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-label={label}
        title={label}
        {...props}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded px-1 text-gray-600 transition",
          "hover:bg-gray-200 hover:text-gray-900",
          "disabled:cursor-not-allowed disabled:opacity-40",
          isActive && "bg-white text-gray-900 shadow-sm",
          className
        )}
      >
        {children}
      </button>
    );
  }
);

ToolbarButton.displayName = "ToolbarButton";

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-gray-200" />;
}

const HEADING_OPTIONS = [
  { value: "paragraph", label: "Normal text", level: null },
  { value: "heading-1", label: "Heading 1", level: 1 },
  { value: "heading-2", label: "Heading 2", level: 2 },
  { value: "heading-3", label: "Heading 3", level: 3 },
  { value: "heading-4", label: "Heading 4", level: 4 },
  { value: "heading-5", label: "Heading 5", level: 5 },
  { value: "heading-6", label: "Heading 6", level: 6 },
] as const;

const TEXT_COLOR_OPTIONS = [
  { label: "Default", value: null, swatch: "transparent" },
  { label: "Gray", value: "#374151", swatch: "#374151" },
  { label: "Red", value: "#dc2626", swatch: "#dc2626" },
  { label: "Orange", value: "#ea580c", swatch: "#ea580c" },
  { label: "Green", value: "#16a34a", swatch: "#16a34a" },
  { label: "Blue", value: "#2563eb", swatch: "#2563eb" },
  { label: "Purple", value: "#7c3aed", swatch: "#7c3aed" },
] as const;

export default function RichTextEditor({
  placeholder = "Add a comment...",
  onChange,
  onSave,
  onCancel,
  isSaving = false,
  saveLabel = "Save",
  className,
}: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [insertSearch, setInsertSearch] = useState("");
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      TextStyle,
      TextColor.configure({ types: ["textStyle"] }),
      Underline,
      Subscript,
      Superscript,
      InfoPanel,
      ExpandNode,
      DecisionNode,
      DatePillNode,
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
          "[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600",
          "[&_[data-type=info-panel]]:my-2 [&_[data-type=info-panel]]:rounded-md [&_[data-type=info-panel]]:border [&_[data-type=info-panel]]:border-blue-200 [&_[data-type=info-panel]]:bg-blue-50 [&_[data-type=info-panel]]:px-3 [&_[data-type=info-panel]]:py-2 [&_[data-type=info-panel]]:text-blue-900",
          "[&_[data-type=info-panel]_p]:my-1",
          "[&_[data-type=decision]]:my-2 [&_[data-type=decision]]:rounded-md [&_[data-type=decision]]:border [&_[data-type=decision]]:border-emerald-200 [&_[data-type=decision]]:bg-emerald-50",
          "[&_[data-type=decision-title]]:flex [&_[data-type=decision-title]]:items-center [&_[data-type=decision-title]]:gap-2 [&_[data-type=decision-title]]:px-3 [&_[data-type=decision-title]]:py-2 [&_[data-type=decision-title]]:text-xs [&_[data-type=decision-title]]:font-semibold [&_[data-type=decision-title]]:text-emerald-700",
          "[&_[data-type=decision-body]]:px-3 [&_[data-type=decision-body]]:pb-3 [&_[data-type=decision-body]]:text-emerald-900",
          "[&_[data-type=expand]]:my-2 [&_[data-type=expand]]:rounded-md [&_[data-type=expand]]:border [&_[data-type=expand]]:border-slate-200 [&_[data-type=expand]]:bg-white",
          "[&_[data-type=expand-summary]]:cursor-pointer [&_[data-type=expand-summary]]:px-3 [&_[data-type=expand-summary]]:py-2 [&_[data-type=expand-summary]]:text-xs [&_[data-type=expand-summary]]:font-semibold [&_[data-type=expand-summary]]:text-slate-600 [&_[data-type=expand-summary]]:list-none",
          "[&_[data-type=expand-content]]:px-3 [&_[data-type=expand-content]]:pb-3",
          "[&_[data-type=date-pill]]:inline-flex [&_[data-type=date-pill]]:items-center [&_[data-type=date-pill]]:rounded-full [&_[data-type=date-pill]]:border [&_[data-type=date-pill]]:border-gray-200 [&_[data-type=date-pill]]:bg-gray-100 [&_[data-type=date-pill]]:px-2 [&_[data-type=date-pill]]:py-0.5",
          "[&_[data-type=date-pill]_input]:bg-transparent [&_[data-type=date-pill]_input]:text-xs [&_[data-type=date-pill]_input]:text-gray-700 [&_[data-type=date-pill]_input]:outline-none [&_[data-type=date-pill]_input]:cursor-pointer",
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

  const handleSetHeading = (value: string) => {
    if (!editor) return;
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
      return;
    }
    const level = Number(value.split("-")[1]);
    if (!Number.isNaN(level)) {
      editor.chain().focus().setHeading({ level }).run();
    }
  };

  const handleSetTextColor = (value: string | null) => {
    if (!editor) return;
    if (!value) {
      editor.chain().focus().unsetColor().run();
      return;
    }
    editor.chain().focus().setColor(value).run();
  };

  const handleInsertInfoPanel = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "infoPanel",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Info panel" }],
          },
        ],
      })
      .run();
  };

  const handleToggleUnderline = () => {
    if (!editor) return;
    editor.chain().focus().toggleUnderline().run();
  };

  const handleToggleStrikethrough = () => {
    if (!editor) return;
    editor.chain().focus().toggleStrike().run();
  };

  const handleToggleInlineCode = () => {
    if (!editor) return;
    editor.chain().focus().toggleCode().run();
  };

  const handleToggleSubscript = () => {
    if (!editor) return;
    editor.chain().focus().toggleSubscript().run();
  };

  const handleToggleSuperscript = () => {
    if (!editor) return;
    editor.chain().focus().toggleSuperscript().run();
  };

  const handleClearFormatting = () => {
    if (!editor) return;
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  };

  const handleInsertQuote = () => {
    if (!editor) return;
    editor.chain().focus().toggleBlockquote().run();
  };

  const handleInsertDivider = () => {
    if (!editor) return;
    editor.chain().focus().setHorizontalRule().run();
  };

  const handleInsertCodeBlock = () => {
    if (!editor) return;
    editor.chain().focus().toggleCodeBlock().run();
  };

  const handleInsertDecision = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "decision",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Decision details..." }],
          },
        ],
      })
      .run();
  };

  const handleInsertExpand = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "expand",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Details..." }],
          },
        ],
      })
      .run();
  };

  const handleInsertDate = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "datePill",
        attrs: { value: "" },
      })
      .run();
  };

  const INSERT_ITEMS = [
    {
      id: "info",
      title: "Info panel",
      description: "Highlight important context or guidance.",
      icon: Info,
      iconClassName: "text-blue-600",
      shortcut: "i",
      action: handleInsertInfoPanel,
    },
    {
      id: "quote",
      title: "Quote",
      description: "Call out a quote or reference block.",
      icon: Quote,
      iconClassName: "text-slate-500",
      shortcut: '" "',
      action: handleInsertQuote,
    },
    {
      id: "divider",
      title: "Divider",
      description: "Separate sections with a clean line.",
      icon: Minus,
      iconClassName: "text-slate-500",
      shortcut: "—",
      action: handleInsertDivider,
    },
    {
      id: "code",
      title: "Code block",
      description: "Insert a formatted code snippet.",
      icon: Code,
      iconClassName: "text-indigo-500",
      shortcut: "</>",
      action: handleInsertCodeBlock,
    },
    {
      id: "decision",
      title: "Decision",
      description: "Capture a decision with context.",
      icon: GitMerge,
      iconClassName: "text-emerald-600",
      shortcut: "<>",
      action: handleInsertDecision,
    },
    {
      id: "expand",
      title: "Expand",
      description: "Hide details inside a collapsible section.",
      icon: ChevronRight,
      iconClassName: "text-slate-500",
      shortcut: ">",
      action: handleInsertExpand,
    },
    {
      id: "date",
      title: "Date",
      description: "Insert a date pill with a picker.",
      icon: Calendar,
      iconClassName: "text-amber-500",
      shortcut: "//",
      action: handleInsertDate,
    },
  ] as const;

  const normalizedInsertSearch = insertSearch.trim().toLowerCase();
  const filteredInsertItems = normalizedInsertSearch
    ? INSERT_ITEMS.filter((item) =>
        `${item.title} ${item.description}`.toLowerCase().includes(normalizedInsertSearch)
      )
    : INSERT_ITEMS;

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

  const activeHeadingValue = (() => {
    for (let level = 1; level <= 6; level += 1) {
      if (editor.isActive("heading", { level })) return `heading-${level}`;
    }
    return "paragraph";
  })();
  const activeHeadingLabel =
    HEADING_OPTIONS.find((option) => option.value === activeHeadingValue)?.label ??
    "Normal text";
  const activeTextColor = editor.getAttributes("textStyle").color as
    | string
    | undefined;

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
      <div className="flex flex-nowrap items-center gap-0.5 overflow-x-auto border-b border-gray-200 bg-gray-50 px-1 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-28 min-w-0 items-center justify-between gap-1 rounded px-1 text-xs font-medium text-gray-700 transition",
                "hover:bg-gray-200 hover:text-gray-900",
                activeHeadingValue !== "paragraph" && "bg-white text-gray-900 shadow-sm"
              )}
            >
              <TypeIcon className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate text-left">
                {activeHeadingLabel}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuRadioGroup
              value={activeHeadingValue}
              onValueChange={handleSetHeading}
            >
              {HEADING_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarButton label="Text color" isActive={!!activeTextColor}>
              <Palette className="h-4 w-4" />
            </ToolbarButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {TEXT_COLOR_OPTIONS.map((option) => {
              const isActive =
                option.value !== null
                  ? option.value === activeTextColor
                  : !activeTextColor;
              return (
                <DropdownMenuItem
                  key={option.label}
                  onSelect={() => handleSetTextColor(option.value)}
                  className={cn("flex items-center gap-2", isActive && "bg-gray-100")}
                >
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full border",
                      option.value ? "border-transparent" : "border-gray-300"
                    )}
                    style={{ backgroundColor: option.swatch }}
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu
          open={insertMenuOpen}
          onOpenChange={(open) => {
            setInsertMenuOpen(open);
            if (!open) setInsertSearch("");
          }}
        >
          <DropdownMenuTrigger asChild>
            <ToolbarButton label="Insert">
              <Plus className="h-4 w-4" />
            </ToolbarButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="flex w-80 max-h-[360px] flex-col overflow-hidden bg-popover p-0"
          >
            <div className="shrink-0 border-b border-gray-100 bg-popover px-3 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={insertSearch}
                  onChange={(event) => setInsertSearch(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  placeholder="Search insert options..."
                  className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-xs text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
              <div className="py-2 pb-4">
                {filteredInsertItems.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-gray-500">
                    No results found.
                  </div>
                ) : (
                  filteredInsertItems.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() => item.action()}
                      className="group flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-left text-sm"
                    >
                      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-gray-100/80">
                        <item.icon className={cn("h-4 w-4", item.iconClassName)} />
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.description}
                        </div>
                      </div>
                      {item.shortcut ? (
                        <span className="mt-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                          {item.shortcut}
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="shrink-0 border-t border-gray-100 bg-popover px-3 py-2 relative z-10">
              <button
                type="button"
                className="w-full rounded-md border border-gray-200 bg-popover px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                View more
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarDivider />
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
          onClick={handleInsertCodeBlock}
          isActive={editor.isActive("codeBlock")}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton label="More">
                <MoreHorizontal className="h-4 w-4" />
              </ToolbarButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem
                onSelect={handleToggleUnderline}
                className={cn(
                  "flex items-center justify-between gap-3",
                  editor.isActive("underline") && "bg-gray-100"
                )}
              >
                <span>Underline</span>
                <span className="text-[10px] font-semibold text-gray-400">
                  Ctrl+U
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleToggleStrikethrough}
                className={cn(
                  "flex items-center justify-between gap-3",
                  editor.isActive("strike") && "bg-gray-100"
                )}
              >
                <span>Strikethrough</span>
                <span className="text-[10px] font-semibold text-gray-400">
                  Ctrl+Shift+S
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleToggleInlineCode}
                className={cn(
                  "flex items-center justify-between gap-3",
                  editor.isActive("code") && "bg-gray-100"
                )}
              >
                <span>Code</span>
                <span className="text-[10px] font-semibold text-gray-400">
                  Ctrl+Shift+M
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleToggleSubscript}
                className={cn(
                  "flex items-center justify-between gap-3",
                  editor.isActive("subscript") && "bg-gray-100"
                )}
              >
                <span>Subscript</span>
                <span className="text-[10px] font-semibold text-gray-400">
                  Ctrl+Shift+,
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleToggleSuperscript}
                className={cn(
                  "flex items-center justify-between gap-3",
                  editor.isActive("superscript") && "bg-gray-100"
                )}
              >
                <span>Superscript</span>
                <span className="text-[10px] font-semibold text-gray-400">
                  Ctrl+Shift+.
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleClearFormatting}
                className="flex items-center justify-between gap-3"
              >
                <span>Clear formatting</span>
                <span className="text-[10px] font-semibold text-gray-400">
                  Ctrl+\
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}
