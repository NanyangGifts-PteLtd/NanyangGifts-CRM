"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react";

type OcfRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
};

function ToolbarButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`rounded p-1.5 ${active ? "bg-[#d8f3f6] text-[#176d77]" : "text-gray-600 hover:bg-gray-100"} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export default function OcfRichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  minHeight = "12rem",
}: OcfRichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "ocf-rich-text-editor min-h-[inherit] px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none",
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const setLink = () => {
    if (!editor || disabled) return;
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", current ?? "");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  return (
    <div className={`overflow-hidden rounded-md border border-gray-300 ${disabled ? "bg-gray-100" : "bg-white focus-within:border-[#7BCBD5] focus-within:ring-1 focus-within:ring-[#7BCBD5]"}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
        <ToolbarButton title="Bold" active={editor?.isActive("bold")} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton>
        <ToolbarButton title="Italic" active={editor?.isActive("italic")} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton>
        <ToolbarButton title="Underline" active={editor?.isActive("underline")} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarButton>
        <span className="mx-1 h-5 border-l border-gray-300" />
        <ToolbarButton title="Heading" active={editor?.isActive("heading", { level: 2 })} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolbarButton>
        <ToolbarButton title="Subheading" active={editor?.isActive("heading", { level: 3 })} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></ToolbarButton>
        <span className="mx-1 h-5 border-l border-gray-300" />
        <ToolbarButton title="Bulleted list" active={editor?.isActive("bulletList")} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={16} /></ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor?.isActive("orderedList")} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarButton>
        <ToolbarButton title="Add or edit link" active={editor?.isActive("link")} disabled={disabled || !editor} onClick={setLink}><LinkIcon size={16} /></ToolbarButton>
      </div>
      <EditorContent editor={editor} style={{ minHeight }} />
    </div>
  );
}
