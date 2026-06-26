import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, ListOrdered, Undo, Redo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

// Configure DOMPurify to only allow safe HTML tags
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'a'];
const ALLOWED_ATTR = ['class', 'href', 'target', 'rel'];

// Convert bare URLs in text nodes to anchor tags so links are clickable.
function autoLinkifyHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
  const container = document.createElement('div');
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('a')) return NodeFilter.FILTER_REJECT;
      return URL_RE.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) targets.push(n as Text);
  for (const t of targets) {
    const frag = document.createDocumentFragment();
    const text = t.nodeValue || '';
    let last = 0;
    text.replace(URL_RE, (match, _u, offset: number) => {
      if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));
      const a = document.createElement('a');
      a.href = match;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = match;
      frag.appendChild(a);
      last = offset + match.length;
      return match;
    });
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    t.replaceWith(frag);
  }
  return container.innerHTML;
}

// Strip HTML to plain text for preview cards.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  editable = true,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync editor when external `content` changes (e.g. switching between projects).
  // Without this, tiptap keeps the initial content forever and edits leak across records.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = content || '';
    // tiptap renders empty doc as "<p></p>"
    if (current === next || (current === '<p></p>' && next === '')) return;
    editor.commands.setContent(next, false);
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== editable) editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('border border-border/50 rounded-lg overflow-hidden', className)}>
      {editable && (
        <div className="flex items-center gap-1 p-2 border-b border-border/50 bg-muted/30">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bold') && 'bg-primary/20 text-primary'
            )}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('italic') && 'bg-primary/20 text-primary'
            )}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bulletList') && 'bg-primary/20 text-primary'
            )}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('orderedList') && 'bg-primary/20 text-primary'
            )}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border/50 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8 p-0"
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>
      )}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none p-4',
          '[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
          !editable && 'bg-transparent border-none'
        )}
      />
    </div>
  );
}

export function RichTextDisplay({ content }: { content: string }) {
  // Sanitize HTML content to prevent XSS attacks
  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}
