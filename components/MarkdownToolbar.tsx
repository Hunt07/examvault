
import React from 'react';
import { Bold, Italic, Strikethrough, Code, Quote } from 'lucide-react';

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onValueChange: (newValue: string) => void;
  value: string;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ textareaRef, onValueChange, value }) => {
  const applyFormat = (syntaxStart: string, syntaxEnd: string = syntaxStart, isBlock: boolean = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd } = textarea;
    const selectedText = value.substring(selectionStart, selectionEnd);

    let newText;
    let newSelectionStart;
    let newSelectionEnd;

    if (isBlock) {
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        newText = `${value.substring(0, lineStart)}${syntaxStart}${value.substring(lineStart)}`;
        newSelectionStart = selectionStart + syntaxStart.length;
        newSelectionEnd = selectionEnd + syntaxStart.length;
    } else {
        newText = `${value.substring(0, selectionStart)}${syntaxStart}${selectedText}${syntaxEnd}${value.substring(selectionEnd)}`;
        if (selectedText) {
            newSelectionStart = selectionStart;
            newSelectionEnd = selectionEnd + syntaxStart.length + syntaxEnd.length;
        } else {
            newSelectionStart = selectionStart + syntaxStart.length;
            newSelectionEnd = newSelectionStart;
        }
    }

    onValueChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    }, 0);
  };

  const ToolButton: React.FC<{ onClick: () => void; children: React.ReactNode; label: string }> = ({ onClick, children, label }) => (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-300 border-b-0 rounded-t-lg">
      <ToolButton onClick={() => applyFormat('**')} label="Bold">
        <Bold size={16} />
      </ToolButton>
      <ToolButton onClick={() => applyFormat('*')} label="Italic">
        <Italic size={16} />
      </ToolButton>
      <ToolButton onClick={() => applyFormat('~~')} label="Strikethrough">
        <Strikethrough size={16} />
      </ToolButton>
      <ToolButton onClick={() => applyFormat('`')} label="Code">
        <Code size={16} />
      </ToolButton>
      <ToolButton onClick={() => applyFormat('> ', '', true)} label="Blockquote">
        <Quote size={16} />
      </ToolButton>
    </div>
  );
};

export default MarkdownToolbar;
