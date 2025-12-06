
import React from 'react';

// A simple inline parser for bold, italic, etc.
const parseInline = (text: string) => {
    let html = text;
    // Important: process strong/bold first
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    // Then em/italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    // Then other formats
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-slate-200 font-mono px-1.5 py-1 rounded-md text-sm">$1</code>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const elements = React.useMemo(() => {
    if (!content) return [];
    const lines = content.split('\n');
    const result: React.ReactNode[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length > 0) {
        const ListComponent = listType === 'ul' ? 'ul' : 'ol';
        const listClasses = listType === 'ul' 
            ? "list-disc list-outside pl-6 space-y-1 my-3" 
            : "list-decimal list-outside pl-6 space-y-1 my-3";
        
        result.push(
            <ListComponent key={`list-${result.length}`} className={listClasses}>
              {listItems.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
            </ListComponent>
        );
        listItems = [];
        listType = null;
      }
    };

    lines.forEach((line, index) => {
      // Blockquotes
      if (line.startsWith('> ')) {
        flushList();
        result.push(
          <blockquote key={index} className="border-l-4 border-slate-200 dark:border-zinc-600 pl-4 my-2 text-slate-600 dark:text-slate-300 italic">
            {parseInline(line.substring(2))}
          </blockquote>
        );
        return;
      }
      
      // Unordered list
      const ulMatch = line.match(/^\s*[\-*]\s+(.*)/);
      if (ulMatch) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(ulMatch[1]);
        return;
      }

       // Ordered list
      const olMatch = line.match(/^\s*\d+\.\s+(.*)/);
       if (olMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(olMatch[1]);
        return;
      }

      // If it's not a special line, it's a paragraph
      flushList();
      if (line.trim() || (!line.trim() && result.length > 0 && !(result[result.length-1] as any)?.type?.toString().includes('p'))){
        result.push(<p key={index} className="my-2 min-h-[1em]">{parseInline(line)}</p>);
      }
    });

    flushList(); // Flush any remaining list
    return result;
  }, [content]);

  return <div className="prose-like max-w-none text-slate-700 dark:text-slate-200">{elements}</div>;
};

export default MarkdownRenderer;