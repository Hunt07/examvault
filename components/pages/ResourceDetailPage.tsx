
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Flashcard, type QuizQuestion, type Attachment } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent, generateStudySet } from '../../services/geminiService';
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Download, BrainCircuit, Loader2, FileText, Notebook, ClipboardList, Archive, Bell, BellOff, Flag, CheckCircle, MessageCircle, BookCopy, HelpCircle, Eye, X, Trash2, Bookmark, BookmarkCheck, Share2, Paperclip, ImageIcon } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import MarkdownToolbar from '../MarkdownToolbar';
import UserRankBadge from '../UserRankBadge';
import FlashcardViewer from '../FlashcardViewer';
import QuizComponent from '../QuizComponent';
import ShareModal from '../ShareModal';
import Avatar from '../Avatar';
import { db, storage } from '../../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CommentComponent: React.FC<{
  comment: Comment;
  resourceId: string;
  children: React.ReactNode;
}> = ({ comment, resourceId, children }) => {
  const { user, userRanks, setView, handleCommentVote, addCommentToResource, deleteCommentFromResource } = useContext(AppContext);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const authorRank = userRanks.get(comment.author.id);
  return (
    <div id={comment.id} className="mt-4 scroll-mt-24 p-2 rounded-lg">
      <div className="flex gap-4 items-start">
        <Avatar src={comment.author.avatarUrl} alt={comment.author.name} className="w-10 h-10" onClick={() => setView('publicProfile', comment.author.id)} />
        <div className="flex-grow bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-lg">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                 <button onClick={() => setView('publicProfile', comment.author.id)} className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary-600 text-sm">{comment.author.name}</button>
                 <UserRankBadge rank={authorRank} size={14} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{new Date(comment.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-2 dark:text-slate-200"><MarkdownRenderer content={comment.text} /></div>
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => handleCommentVote(resourceId, comment.id)} className={`flex items-center p-2 text-sm rounded-lg transition ${comment.upvotedBy?.includes(user?.id || '') ? 'bg-primary-600 text-white' : 'bg-white dark:bg-zinc-700 dark:text-white'}`}>
              <ThumbsUp size={14} /> {comment.upvotes > 0 && <span className="ml-1.5">{comment.upvotes}</span>}
            </button>
            <button onClick={() => setIsReplying(!isReplying)} className="flex items-center gap-1.5 p-2 text-sm bg-white dark:bg-zinc-700 dark:text-white rounded-lg"><MessageCircle size={14} /> Reply</button>
            {user?.id === comment.author.id && <button onClick={() => setIsDeleteConfirmOpen(true)} className="p-2 text-red-500"><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
      {isReplying && (
        <div className="ml-14 mt-4">
          <form onSubmit={(e) => { e.preventDefault(); if (replyText.trim()) { addCommentToResource(resourceId, replyText, comment.id); setReplyText(''); setIsReplying(false); } }} className="flex gap-4">
            <Avatar src={user?.avatarUrl} alt="User" className="w-8 h-8" />
            <div className="flex-grow">
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Reply..." className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white p-2 border rounded-lg focus:ring-primary-500 outline-none" rows={2} autoFocus />
              <div className="flex gap-2 mt-2"><button type="submit" className="bg-primary-600 text-white px-3 py-1 rounded text-sm">Post</button><button type="button" onClick={() => setIsReplying(false)} className="px-3 py-1 text-sm dark:text-white">Cancel</button></div>
            </div>
          </form>
        </div>
      )}
      <div className="pl-8 border-l-2 dark:border-zinc-700 ml-5">{children}</div>
    </div>
  );
};

const ResourceDetailPage: React.FC<{ resource: Resource }> = ({ resource }) => {
  const { user, userRanks, setView, handleVote, addCommentToResource, goBack, toggleLecturerSubscription, toggleCourseCodeSubscription, savedResourceIds, toggleSaveResource, deleteResource, showToast } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [studySet, setStudySet] = useState<(Flashcard[] | QuizQuestion[]) | null>(null);
  const [studySetType, setStudySetType] = useState<'flashcards' | 'quiz' | null>(null);
  const [isGeneratingStudySet, setIsGeneratingStudySet] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    setSummary('');
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}`;
    const result = await summarizeContent(textContext, resource.fileBase64, resource.mimeType, resource.extractedText);
    setSummary(result);
    setIsSummarizing(false);
  };
  
  const handleGenerateStudySet = async (type: 'flashcards' | 'quiz') => {
    setIsGeneratingStudySet(true);
    setStudySetType(type);
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}`;
    const result = await generateStudySet(textContext, type, resource.fileBase64, resource.mimeType, resource.extractedText);
    setStudySet(result);
    setIsGeneratingStudySet(false);
  };

  const commentsByParentId = useMemo(() => {
    const group: Record<string, Comment[]> = {};
    for (const c of resource.comments || []) {
        const pId = c.parentId || 'root';
        if (!group[pId]) group[pId] = [];
        group[pId].push(c);
    }
    return group;
  }, [resource.comments]);

  const renderComments = (parentId: string | null) => (commentsByParentId[parentId || 'root'] || []).map(c => <CommentComponent key={c.id} comment={c} resourceId={resource.id}>{renderComments(c.id)}</CommentComponent>);

  return (
    <div>
      <button onClick={goBack} className="flex items-center gap-2 text-primary-600 font-semibold mb-6 hover:underline"><ArrowLeft size={20} /> Back</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border dark:border-zinc-700">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`}>{resource.type}</span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-4">{resource.title}</h1>
            <p className="text-slate-500 dark:text-slate-300 mt-2">{resource.description}</p>
            <div className="mt-6 flex flex-col gap-3">
                <button onClick={() => setIsPreviewOpen(true)} className="w-full py-3 bg-slate-100 dark:bg-zinc-800 dark:text-white rounded-lg font-bold border dark:border-zinc-700 hover:bg-slate-200 transition flex items-center justify-center gap-2"><Eye size={18}/> Preview File</button>
                <a href={resource.fileUrl} download={resource.fileName} className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition shadow-md flex items-center justify-center gap-2"><Download size={18}/> Download</a>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md mt-8 border dark:border-zinc-700">
            <h3 className="text-xl font-bold dark:text-white mb-4">AI Summary</h3>
            {!summary && !isSummarizing && (
              <div className="border-2 border-dashed dark:border-zinc-700 rounded-lg p-6 text-center">
                  <button onClick={handleGenerateSummary} className="inline-flex items-center gap-2 bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition"><BrainCircuit size={18} /> Generate with Gemini 3</button>
              </div>
            )}
            {isSummarizing && <div className="p-6 text-center"><Loader2 className="mx-auto h-12 w-12 text-primary-500 animate-spin" /><p className="mt-4 dark:text-white">Gemini is analyzing file data...</p></div>}
            {summary && <div className="bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-lg border dark:border-zinc-700"><MarkdownRenderer content={summary} /></div>}
          </div>

          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md mt-8 border dark:border-zinc-700">
            <h3 className="text-xl font-bold dark:text-white mb-4">AI Study Tools</h3>
            {isGeneratingStudySet ? <div className="text-center py-6"><Loader2 className="animate-spin mx-auto text-primary-500" /><p className="mt-2 dark:text-white">Generating {studySetType}...</p></div> : !studySet ? (
                <div className="flex gap-4">
                    <button onClick={() => handleGenerateStudySet('flashcards')} className="flex-1 py-4 bg-slate-50 dark:bg-zinc-800 dark:text-white rounded-lg border font-bold hover:bg-slate-100 transition flex flex-col items-center gap-2"><BookCopy size={20}/> Flashcards</button>
                    <button onClick={() => handleGenerateStudySet('quiz')} className="flex-1 py-4 bg-slate-50 dark:bg-zinc-800 dark:text-white rounded-lg border font-bold hover:bg-slate-100 transition flex flex-col items-center gap-2"><HelpCircle size={20}/> Quiz</button>
                </div>
            ) : <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border dark:border-zinc-700">{studySetType === 'flashcards' ? <FlashcardViewer flashcards={studySet as Flashcard[]} onReset={() => setStudySet(null)} /> : <QuizComponent questions={studySet as QuizQuestion[]} onReset={() => setStudySet(null)} />}</div>}
          </div>

          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md mt-8 border dark:border-zinc-700">
            <h3 className="text-xl font-bold dark:text-white mb-6">Discussion</h3>
            <form onSubmit={(e) => { e.preventDefault(); if (newComment.trim()) { addCommentToResource(resource.id, newComment, null); setNewComment(''); } }} className="mb-8">
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="w-full bg-slate-50 dark:bg-zinc-800 dark:text-white p-4 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" rows={3} />
              <div className="mt-2 flex justify-end"><button type="submit" className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition">Post Comment</button></div>
            </form>
            {renderComments(null)}
          </div>
        </div>

        <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md lg:sticky top-24 border dark:border-zinc-700">
                <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-80 object-cover rounded-lg mb-6" />
                <div className="flex items-center gap-2">
                    <button onClick={() => handleVote(resource.id, 'up')} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg font-bold transition ${resource.upvotedBy?.includes(user?.id || '') ? 'bg-green-600 text-white' : 'bg-green-50 dark:bg-green-900/20 text-green-700'}`}><ThumbsUp size={18}/> {resource.upvotes}</button>
                    <button onClick={() => toggleSaveResource(resource.id)} className={`p-3 rounded-lg transition ${savedResourceIds.includes(resource.id) ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>{savedResourceIds.includes(resource.id) ? <BookmarkCheck size={20}/> : <Bookmark size={20}/>}</button>
                </div>
            </div>
        </div>
      </div>
      {isPreviewOpen && <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"><div className="bg-white dark:bg-dark-surface rounded-xl w-full max-w-5xl h-[85vh] flex flex-col"><div className="p-4 border-b flex justify-between items-center dark:border-zinc-700 dark:bg-zinc-800"><h3 className="font-bold dark:text-white">{resource.title}</h3><button onClick={() => setIsPreviewOpen(false)} className="text-slate-500"><X size={24}/></button></div><div className="flex-grow bg-slate-100 dark:bg-zinc-900 overflow-hidden"><iframe src={resource.fileUrl} className="w-full h-full border-none"></iframe></div></div></div>}
    </div>
  );
};
export default ResourceDetailPage;
