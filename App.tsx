
import React, { useState, useEffect, createContext, useMemo, useCallback } from 'react';
import { 
  User, Resource, ForumPost, ResourceRequest, Notification, Conversation, DirectMessage, 
  ResourceType, SemesterIntake, ExamType, ResourceRequestStatus, NotificationType, MessageStatus,
  Report, LogEntry, Attachment, Comment, Flashcard, QuizQuestion
} from './types';
import { 
  mockUsers, mockResources, mockForumPosts, mockResourceRequests, mockNotifications, 
  mockConversations, mockDirectMessages 
} from './constants';
import Header from './components/Header';
import SideNav from './components/SideNav';
import AuthPage from './components/pages/AuthPage';
import DashboardPage from './components/pages/DashboardPage';
import ResourceDetailPage from './components/pages/ResourceDetailPage';
import ProfilePage from './components/pages/ProfilePage';
import ForumsPage from './components/pages/ForumsPage';
import ForumPostDetailPage from './components/pages/ForumPostDetailPage';
import ResourceRequestsPage from './components/pages/ResourceRequestsPage';
import MessagesPage from './components/pages/MessagesPage';
import LeaderboardPage from './components/pages/LeaderboardPage';
import AdminPage from './components/pages/AdminPage';
import ToastNotification from './components/ToastNotification';
import UploadModal from './components/UploadModal';
import TooltipGuide from './components/TooltipGuide';
import { db, auth } from './services/firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export type View = 'dashboard' | 'resourceDetail' | 'profile' | 'publicProfile' | 'discussions' | 'forumDetail' | 'requests' | 'messages' | 'leaderboard' | 'admin';

interface AppContextType {
  user: User | null;
  users: User[];
  resources: Resource[];
  forumPosts: ForumPost[];
  resourceRequests: ResourceRequest[];
  notifications: Notification[];
  conversations: Conversation[];
  directMessages: DirectMessage[];
  reports: Report[];
  logs: LogEntry[];
  
  view: View;
  setView: (view: View, id?: string, options?: { replace?: boolean }) => void;
  
  userRanks: Map<string, number>;
  
  logout: () => void;
  
  // Resources
  areResourcesLoading: boolean;
  savedResourceIds: string[];
  toggleSaveResource: (id: string) => void;
  deleteResource: (id: string, fileUrl: string, previewUrl: string) => Promise<void>;
  handleVote: (id: string, type: 'up' | 'down') => void;
  addCommentToResource: (resourceId: string, text: string, parentId: string | null, file?: File) => void;
  handleCommentVote: (resourceId: string, commentId: string) => void;
  deleteCommentFromResource: (resourceId: string, comment: Comment) => void;
  
  // Forums
  savedPostIds: string[];
  toggleSavePost: (id: string) => void;
  addForumPost: (postData: { title: string; courseCode: string; body: string; tags: string[] }, file?: File) => void;
  handlePostVote: (id: string, type: 'up' | 'down') => void;
  handleReplyVote: (postId: string, replyId: string) => void;
  toggleVerifiedAnswer: (postId: string, replyId: string) => void;
  addReplyToPost: (postId: string, text: string, parentId: string | null, file?: File) => void;
  deleteForumPost: (id: string) => void;
  deleteReplyFromPost: (postId: string, reply: any) => void;
  
  // Requests
  savedRequestIds: string[];
  toggleSaveRequest: (id: string) => void;
  addResourceRequest: (requestData: { title: string; courseCode: string; details: string; }, file?: File) => void;
  openUploadForRequest: (requestId: string) => void;
  deleteResourceRequest: (id: string) => void;
  
  // Messages
  hasUnreadMessages: boolean;
  sendMessage: (conversationId: string, text: string) => void;
  markMessagesAsRead: (conversationId: string) => void;
  hideConversation: (conversationId: string) => void;
  startConversation: (userId: string) => void;
  sendDirectMessageToUser: (userId: string, text: string) => void;
  deleteMessage: (messageId: string) => void;
  editMessage: (messageId: string, newText: string) => void;
  
  // Notifications
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  
  // User
  toggleLecturerSubscription: (lecturer: string) => void;
  toggleCourseCodeSubscription: (courseCode: string) => void;
  toggleUserSubscription: (userId: string) => void;
  updateUserProfile: (data: Partial<User>) => void;
  deactivateAccount: () => void;
  deleteAccount: () => void;
  
  // UI
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', points?: number) => void;
  scrollTargetId: string | null;
  setScrollTargetId: (id: string | null) => void;
  goBack: () => void;
  
  // Admin
  toggleUserRole: (uid: string, role: 'student' | 'admin') => Promise<void>;
  toggleUserStatus: (uid: string, status: 'active' | 'banned') => Promise<void>;
  resolveReport: (rid: string, status: 'resolved' | 'dismissed') => Promise<void>;
  
  hasUnreadDiscussions: boolean;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

// Helper to convert file to Base64 for AI processing
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const App: React.FC = () => {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [view, setViewState] = useState<View>('dashboard');
  const [viewId, setViewId] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<{view: View, id?: string}[]>([]);
  
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [resources, setResources] = useState<Resource[]>(mockResources);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>(mockForumPosts);
  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>(mockResourceRequests);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>(mockDirectMessages);
  
  const [reports, setReports] = useState<Report[]>([]); // Mock empty for now
  const [logs, setLogs] = useState<LogEntry[]>([]); // Mock empty for now

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info', points?: number } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [requestToFulfill, setRequestToFulfill] = useState<ResourceRequest | undefined>(undefined);
  
  const [areResourcesLoading, setAreResourcesLoading] = useState(false);

  // Derived State
  const userRanks = useMemo(() => {
      const sortedByPoints = [...users].sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
      const r = new Map<string, number>();
      sortedByPoints.forEach((u, i) => r.set(u.id, i));
      return r;
  }, [users]);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser && firebaseUser.email) {
            const existingUser = users.find(u => u.email === firebaseUser.email);
            if (existingUser) {
                setUser(existingUser);
            } else {
                // Create new user (simplified)
                const newUser: User = {
                    id: firebaseUser.uid,
                    name: firebaseUser.displayName || 'New User',
                    email: firebaseUser.email,
                    avatarUrl: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${firebaseUser.displayName}`,
                    joinDate: new Date().toISOString(),
                    bio: 'Student at UNIMY',
                    points: 0,
                    weeklyPoints: 0,
                    uploadCount: 0,
                    course: 'Foundation',
                    currentYear: 1,
                    currentSemester: 1,
                    subscriptions: { users: [], lecturers: [], courseCodes: [] },
                    savedResourceIds: [],
                    savedPostIds: [],
                    savedRequestIds: [],
                    role: 'student',
                    status: 'active'
                };
                setUsers(prev => [...prev, newUser]);
                setUser(newUser);
            }
        } else {
            setUser(null);
        }
    });
    return () => unsubscribe();
  }, [users]);

  // View Navigation
  const setView = useCallback((newView: View, id?: string, options?: { replace?: boolean }) => {
      setViewState(newView);
      setViewId(id);
      if (!options?.replace) {
          setHistory(prev => [...prev, { view: newView, id }]);
      }
      window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
      if (history.length > 1) {
          const newHistory = [...history];
          newHistory.pop(); // Current
          const prev = newHistory[newHistory.length - 1];
          setHistory(newHistory);
          setViewState(prev.view);
          setViewId(prev.id);
      } else {
          setViewState('dashboard');
          setViewId(undefined);
      }
  }, [history]);

  // Helper Functions
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', points?: number) => {
      setToast({ message, type, points });
  };

  const logout = async () => {
      await signOut(auth);
      setUser(null);
      setView('dashboard');
  };

  const toggleDarkMode = () => {
      setIsDarkMode(!isDarkMode);
      if (!isDarkMode) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  };

  // --- Resource Logic ---
  const toggleSaveResource = (id: string) => {
      if (!user) return;
      const saved = user.savedResourceIds.includes(id);
      const newSavedIds = saved 
          ? user.savedResourceIds.filter(rid => rid !== id)
          : [...user.savedResourceIds, id];
      
      setUser({ ...user, savedResourceIds: newSavedIds });
      // Update in users array
      setUsers(users.map(u => u.id === user.id ? { ...u, savedResourceIds: newSavedIds } : u));
      showToast(saved ? "Resource removed from saved." : "Resource saved.", "info");
  };

  const handleVote = (id: string, type: 'up' | 'down') => {
      if (!user) return;
      setResources(prev => prev.map(res => {
          if (res.id !== id) return res;
          
          const hasUpvoted = res.upvotedBy.includes(user.id);
          const hasDownvoted = res.downvotedBy.includes(user.id);
          
          let newUpvotes = res.upvotes;
          let newDownvotes = res.downvotes;
          let newUpvotedBy = [...res.upvotedBy];
          let newDownvotedBy = [...res.downvotedBy];

          if (type === 'up') {
              if (hasUpvoted) {
                  newUpvotes--;
                  newUpvotedBy = newUpvotedBy.filter(uid => uid !== user.id);
              } else {
                  newUpvotes++;
                  newUpvotedBy.push(user.id);
                  if (hasDownvoted) {
                      newDownvotes--;
                      newDownvotedBy = newDownvotedBy.filter(uid => uid !== user.id);
                  }
              }
          } else {
              if (hasDownvoted) {
                  newDownvotes--;
                  newDownvotedBy = newDownvotedBy.filter(uid => uid !== user.id);
              } else {
                  newDownvotes++;
                  newDownvotedBy.push(user.id);
                  if (hasUpvoted) {
                      newUpvotes--;
                      newUpvotedBy = newUpvotedBy.filter(uid => uid !== user.id);
                  }
              }
          }
          return { ...res, upvotes: newUpvotes, downvotes: newDownvotes, upvotedBy: newUpvotedBy, downvotedBy: newDownvotedBy };
      }));
  };

  const deleteResource = async (id: string) => {
      setResources(prev => prev.filter(r => r.id !== id));
      setView('dashboard');
      showToast("Resource deleted.", "success");
  };

  const addCommentToResource = (resourceId: string, text: string, parentId: string | null, file?: File) => {
      if (!user) return;
      const newComment: Comment = {
          id: `c-${Date.now()}`,
          author: user,
          text,
          timestamp: new Date().toISOString(),
          parentId,
          upvotes: 0,
          upvotedBy: [],
          attachment: file ? { type: (file.type.startsWith('image') ? 'image' : 'file') as 'image' | 'file', name: file.name, url: URL.createObjectURL(file), size: '1MB' } : undefined
      };
      
      setResources(prev => prev.map(r => {
          if (r.id === resourceId) {
              return { ...r, comments: [...r.comments, newComment] };
          }
          return r;
      }));
      showToast("Comment added!", "success", 5);
  };

  const handleCommentVote = (resourceId: string, commentId: string) => {
      if (!user) return;
      setResources(prev => prev.map(r => {
          if (r.id === resourceId) {
              const updatedComments = r.comments.map(c => {
                  if (c.id === commentId) {
                      const hasUpvoted = c.upvotedBy.includes(user.id);
                      return {
                          ...c,
                          upvotes: hasUpvoted ? c.upvotes - 1 : c.upvotes + 1,
                          upvotedBy: hasUpvoted ? c.upvotedBy.filter(uid => uid !== user.id) : [...c.upvotedBy, user.id]
                      };
                  }
                  return c;
              });
              return { ...r, comments: updatedComments };
          }
          return r;
      }));
  };

  const deleteCommentFromResource = (resourceId: string, comment: Comment) => {
      setResources(prev => prev.map(r => {
          if (r.id === resourceId) {
              return { ...r, comments: r.comments.filter(c => c.id !== comment.id && c.parentId !== comment.id) };
          }
          return r;
      }));
      showToast("Comment deleted.", "info");
  };

  // --- Forum Logic ---
  const toggleSavePost = (id: string) => {
      if (!user) return;
      const saved = user.savedPostIds.includes(id);
      const newSaved = saved ? user.savedPostIds.filter(pid => pid !== id) : [...user.savedPostIds, id];
      setUser({ ...user, savedPostIds: newSaved });
      setUsers(users.map(u => u.id === user.id ? { ...u, savedPostIds: newSaved } : u));
      showToast(saved ? "Post unsaved." : "Post saved.", "info");
  };

  const addForumPost = (postData: any, file?: File) => {
      if (!user) return;
      const newPost: ForumPost = {
          id: `post-${Date.now()}`,
          ...postData,
          author: user,
          timestamp: new Date().toISOString(),
          upvotes: 0,
          downvotes: 0,
          upvotedBy: [],
          downvotedBy: [],
          replies: [],
          attachment: file ? { type: (file.type.startsWith('image') ? 'image' : 'file') as 'image' | 'file', name: file.name, url: URL.createObjectURL(file), size: '1MB' } : undefined
      };
      setForumPosts([newPost, ...forumPosts]);
      showToast("Discussion created!", "success", 10);
  };

  const handlePostVote = (id: string, type: 'up' | 'down') => {
      if (!user) return;
      setForumPosts(prev => prev.map(p => {
          if (p.id !== id) return p;
          // Logic identical to resource vote (simplified here)
          const hasUpvoted = p.upvotedBy.includes(user.id);
          const hasDownvoted = p.downvotedBy.includes(user.id);
          let { upvotes, downvotes, upvotedBy, downvotedBy } = p;

          if (type === 'up') {
              if (hasUpvoted) { upvotes--; upvotedBy = upvotedBy.filter(uid => uid !== user.id); }
              else { upvotes++; upvotedBy = [...upvotedBy, user.id]; if(hasDownvoted){ downvotes--; downvotedBy = downvotedBy.filter(uid => uid !== user.id); } }
          } else {
              if (hasDownvoted) { downvotes--; downvotedBy = downvotedBy.filter(uid => uid !== user.id); }
              else { downvotes++; downvotedBy = [...downvotedBy, user.id]; if(hasUpvoted){ upvotes--; upvotedBy = upvotedBy.filter(uid => uid !== user.id); } }
          }
          return { ...p, upvotes, downvotes, upvotedBy, downvotedBy };
      }));
  };

  const handleReplyVote = (postId: string, replyId: string) => {
      if (!user) return;
      setForumPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          const replies = p.replies.map(r => {
              if (r.id !== replyId) return r;
              const hasUpvoted = r.upvotedBy.includes(user.id);
              return { 
                  ...r, 
                  upvotes: hasUpvoted ? r.upvotes - 1 : r.upvotes + 1,
                  upvotedBy: hasUpvoted ? r.upvotedBy.filter(uid => uid !== user.id) : [...r.upvotedBy, user.id]
              };
          });
          return { ...p, replies };
      }));
  };

  const toggleVerifiedAnswer = (postId: string, replyId: string) => {
      setForumPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          const replies = p.replies.map(r => r.id === replyId ? { ...r, isVerified: !r.isVerified } : r);
          return { ...p, replies };
      }));
      showToast("Answer status updated.", "success", 15);
  };

  const addReplyToPost = (postId: string, text: string, parentId: string | null, file?: File) => {
      if (!user) return;
      const newReply = {
          id: `reply-${Date.now()}`,
          author: user,
          text,
          timestamp: new Date().toISOString(),
          parentId,
          upvotes: 0,
          upvotedBy: [],
          isVerified: false,
          attachment: file ? { type: (file.type.startsWith('image') ? 'image' : 'file') as 'image' | 'file', name: file.name, url: URL.createObjectURL(file), size: '1MB' } : undefined
      };
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, replies: [...p.replies, newReply] } : p));
      showToast("Reply posted!", "success", 5);
  };

  const deleteForumPost = (id: string) => {
      setForumPosts(prev => prev.filter(p => p.id !== id));
      setView('discussions');
      showToast("Post deleted.", "success");
  };

  const deleteReplyFromPost = (postId: string, reply: any) => {
      setForumPosts(prev => prev.map(p => {
          if (p.id === postId) {
              return { ...p, replies: p.replies.filter(r => r.id !== reply.id) };
          }
          return p;
      }));
      showToast("Reply deleted.", "info");
  };

  // --- Requests Logic ---
  const toggleSaveRequest = (id: string) => {
      if (!user) return;
      const saved = user.savedRequestIds.includes(id);
      const newSaved = saved ? user.savedRequestIds.filter(rid => rid !== id) : [...user.savedRequestIds, id];
      setUser({ ...user, savedRequestIds: newSaved });
      showToast(saved ? "Request unsaved." : "Request saved.", "info");
  };

  const addResourceRequest = (data: any, file?: File) => {
      if (!user) return;
      const newReq: ResourceRequest = {
          id: `req-${Date.now()}`,
          requester: user,
          timestamp: new Date().toISOString(),
          status: ResourceRequestStatus.Open,
          ...data,
          attachment: file ? { type: 'file', name: file.name, url: URL.createObjectURL(file), size: '1MB' } : undefined
      };
      setResourceRequests([newReq, ...resourceRequests]);
      showToast("Request posted!", "success", 5);
  };

  const openUploadForRequest = (requestId: string) => {
      const req = resourceRequests.find(r => r.id === requestId);
      if (req) {
          setRequestToFulfill(req);
          setIsUploadModalOpen(true);
      }
  };

  const deleteResourceRequest = (id: string) => {
      setResourceRequests(prev => prev.filter(r => r.id !== id));
      showToast("Request deleted.", "success");
  };

  // --- Messages Logic ---
  const sendMessage = (conversationId: string, text: string) => {
      if (!user) return;
      const msg: DirectMessage = {
          id: `msg-${Date.now()}`,
          conversationId,
          senderId: user.id,
          recipientId: conversations.find(c => c.id === conversationId)?.participants.find(p => p !== user.id) || '',
          text,
          timestamp: new Date().toISOString(),
          status: MessageStatus.Sent,
          isDeleted: false
      };
      setDirectMessages([...directMessages, msg]);
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, lastMessageTimestamp: msg.timestamp } : c));
  };

  const markMessagesAsRead = (conversationId: string) => {
      if (!user) return;
      setDirectMessages(prev => prev.map(m => m.conversationId === conversationId && m.recipientId === user.id ? { ...m, status: MessageStatus.Read } : m));
  };

  const hideConversation = (id: string) => {
      if (!user) return;
      setConversations(prev => prev.map(c => c.id === id ? { ...c, hiddenBy: [...(c.hiddenBy || []), user.id] } : c));
  };

  const startConversation = (userId: string) => {
      if (!user) return;
      const existing = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(userId));
      if (existing) {
          // Unhide if hidden
          if (existing.hiddenBy?.includes(user.id)) {
              setConversations(prev => prev.map(c => c.id === existing.id ? { ...c, hiddenBy: c.hiddenBy?.filter(uid => uid !== user.id) } : c));
          }
          setView('messages', existing.id);
      } else {
          const newConvo: Conversation = {
              id: `convo-${Date.now()}`,
              participants: [user.id, userId],
              lastMessageTimestamp: new Date().toISOString(),
              hiddenBy: []
          };
          setConversations([newConvo, ...conversations]);
          setView('messages', newConvo.id);
      }
  };

  const sendDirectMessageToUser = (userId: string, text: string) => {
      if (!user) return;
      startConversation(userId);
      // Hack: Wait for state update or find the new convo immediately
      setTimeout(() => {
          const convo = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(userId)) 
                        || { id: `convo-${Date.now()}`, participants: [user.id, userId] }; // fallback
          sendMessage(convo.id, text);
          showToast("Message sent!", "success");
      }, 100);
  };

  const deleteMessage = (id: string) => {
      setDirectMessages(prev => prev.map(m => m.id === id ? { ...m, isDeleted: true, text: '' } : m));
  };

  const editMessage = (id: string, text: string) => {
      setDirectMessages(prev => prev.map(m => m.id === id ? { ...m, text, editedAt: new Date().toISOString() } : m));
  };

  // --- Notifications ---
  const markNotificationAsRead = (id: string) => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };
  const markAllNotificationsAsRead = () => {
      if (!user) return;
      setNotifications(prev => prev.map(n => n.recipientId === user.id ? { ...n, isRead: true } : n));
  };
  const clearAllNotifications = () => {
      if (!user) return;
      setNotifications(prev => prev.filter(n => n.recipientId !== user.id));
  };

  // --- User Settings ---
  const toggleLecturerSubscription = (lecturer: string) => {
      if (!user) return;
      const subs = user.subscriptions.lecturers.includes(lecturer) 
          ? user.subscriptions.lecturers.filter(l => l !== lecturer)
          : [...user.subscriptions.lecturers, lecturer];
      setUser({ ...user, subscriptions: { ...user.subscriptions, lecturers: subs } });
      showToast("Subscription updated.", "info");
  };
  const toggleCourseCodeSubscription = (code: string) => {
      if (!user) return;
      const subs = user.subscriptions.courseCodes.includes(code)
          ? user.subscriptions.courseCodes.filter(c => c !== code)
          : [...user.subscriptions.courseCodes, code];
      setUser({ ...user, subscriptions: { ...user.subscriptions, courseCodes: subs } });
      showToast("Subscription updated.", "info");
  };
  const toggleUserSubscription = (uid: string) => {
      if (!user) return;
      const subs = user.subscriptions.users.includes(uid)
          ? user.subscriptions.users.filter(u => u !== uid)
          : [...user.subscriptions.users, uid];
      setUser({ ...user, subscriptions: { ...user.subscriptions, users: subs } });
      showToast(user.subscriptions.users.includes(uid) ? "Unfollowed user." : "Following user.", "info");
  };
  const updateUserProfile = (data: Partial<User>) => {
      if (!user) return;
      const updated = { ...user, ...data };
      setUser(updated);
      setUsers(users.map(u => u.id === user.id ? updated : u));
      showToast("Profile updated!", "success");
  };
  const deactivateAccount = () => {
      if (!user) return;
      setUsers(users.map(u => u.id === user.id ? { ...u, status: 'deactivated' } : u));
      logout();
  };
  const deleteAccount = () => {
      if (!user) return;
      setUsers(users.filter(u => u.id !== user.id));
      logout();
  };

  // --- Admin ---
  const logAction = async (type: LogEntry['actionType'], desc: string, targetId?: string) => {
      if (!user) return;
      const newLog: LogEntry = {
          id: `log-${Date.now()}`,
          actorId: user.id,
          actorName: user.name,
          actorAvatar: user.avatarUrl,
          actionType: type,
          description: desc,
          targetId,
          timestamp: new Date().toISOString()
      };
      setLogs([newLog, ...logs]);
  };

  const toggleUserRole = async (uid: string, role: 'student' | 'admin') => {
      if (user?.role === 'admin') {
          // Local update + mock DB call
          setUsers(prev => prev.map(u => u.id === uid ? { ...u, role } : u));
          logAction('admin', `Changed role of ${uid} to ${role}`, uid);
      }
  };
  const toggleUserStatus = async (uid: string, status: 'active' | 'banned') => {
      if (user?.role === 'admin') {
          setUsers(prev => prev.map(u => u.id === uid ? { ...u, status } : u));
          logAction('admin', `Changed status of ${uid} to ${status}`, uid);
      }
  };
  const resolveReport = async (rid: string, status: 'resolved' | 'dismissed') => {
      if (user?.role === 'admin') {
          setReports(prev => prev.filter(r => r.id !== rid));
          logAction('admin', `Report ${rid} resolved as ${status}`, rid);
      }
  };

  // --- Upload ---
  const handleUpload = async (newResourceData: any, file: File, coverImageFile: File | null) => {
      if (!user) return;
      setAreResourcesLoading(true);
      
      try {
          // Convert file to Base64 immediately for AI
          const fileBase64 = await fileToBase64(file);
          
          // Robustly determine MIME type in case file.type is empty or generic
          let mimeType = file.type;
          if (!mimeType) {
             const ext = file.name.split('.').pop()?.toLowerCase();
             if (ext === 'pdf') mimeType = 'application/pdf';
             else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
             else if (ext === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
             else if (ext === 'txt') mimeType = 'text/plain';
          }

          setTimeout(() => {
              const newResource: Resource = {
                  id: `res-${Date.now()}`,
                  ...newResourceData,
                  author: user,
                  uploadDate: new Date().toISOString(),
                  upvotes: 0,
                  downvotes: 0,
                  upvotedBy: [],
                  downvotedBy: [],
                  comments: [],
                  contentForAI: 'Content available for AI analysis.', 
                  fileUrl: URL.createObjectURL(file), // For download link
                  fileBase64: fileBase64, // Store actual content for AI to access
                  fileName: file.name,
                  previewImageUrl: coverImageFile ? URL.createObjectURL(coverImageFile) : 'https://picsum.photos/seed/new/400/500', // Fallback or generated in modal
                  mimeType: mimeType || 'application/octet-stream'
              };
              
              setResources([newResource, ...resources]);
              
              // Fulfill request if applicable
              if (requestToFulfill) {
                  setResourceRequests(prev => prev.map(req => req.id === requestToFulfill.id ? { 
                      ...req, 
                      status: ResourceRequestStatus.Fulfilled,
                      fulfillment: { fulfiller: user, resourceId: newResource.id, timestamp: new Date().toISOString() }
                  } : req));
                  setRequestToFulfill(undefined);
                  showToast("Resource uploaded & Request Fulfilled! (+75 points)", "success", 75);
              } else {
                  showToast("Resource uploaded successfully! (+25 points)", "success", 25);
              }
              
              setAreResourcesLoading(false);
              setIsUploadModalOpen(false);
          }, 1500);
      } catch (error) {
          console.error("Error reading file:", error);
          showToast("Failed to process file.", "error");
          setAreResourcesLoading(false);
      }
  };

  if (!user) {
      return (
          <AuthPage onLogin={(email) => {
              // Simulating login fetch
              const existing = users.find(u => u.email === email);
              if (existing) setUser(existing);
              else {
                  // Fallback for demo
                  const newUser: User = { ...mockUsers[0], id: `user-${Date.now()}`, email, name: email.split('@')[0], role: 'student' };
                  setUsers([...users, newUser]);
                  setUser(newUser);
              }
          }} />
      );
  }

  return (
    <AppContext.Provider value={{
        user, users, resources, forumPosts, resourceRequests, notifications, conversations, directMessages, reports, logs,
        view, setView, userRanks, logout,
        areResourcesLoading, savedResourceIds: user.savedResourceIds, toggleSaveResource, deleteResource, handleVote, addCommentToResource, handleCommentVote, deleteCommentFromResource,
        savedPostIds: user.savedPostIds, toggleSavePost, addForumPost, handlePostVote, handleReplyVote, toggleVerifiedAnswer, addReplyToPost, deleteForumPost, deleteReplyFromPost,
        savedRequestIds: user.savedRequestIds, toggleSaveRequest, addResourceRequest, openUploadForRequest, deleteResourceRequest,
        hasUnreadMessages: directMessages.some(m => m.recipientId === user.id && m.status !== MessageStatus.Read),
        sendMessage, markMessagesAsRead, hideConversation, startConversation, sendDirectMessageToUser, deleteMessage, editMessage,
        markNotificationAsRead, markAllNotificationsAsRead, clearAllNotifications,
        toggleLecturerSubscription, toggleCourseCodeSubscription, toggleUserSubscription, updateUserProfile, deactivateAccount, deleteAccount,
        isDarkMode, toggleDarkMode, showToast, scrollTargetId, setScrollTargetId, goBack,
        toggleUserRole, toggleUserStatus, resolveReport,
        hasUnreadDiscussions: false // Placeholder
    }}>
        <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-dark-bg text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
            <Header onUploadClick={() => { setRequestToFulfill(undefined); setIsUploadModalOpen(true); }} />
            <SideNav />
            
            <main className="pt-20 pl-20 transition-all duration-300 p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {view === 'dashboard' && <DashboardPage />}
                    {view === 'resourceDetail' && viewId && (
                        (() => {
                            const r = resources.find(r => r.id === viewId);
                            return r ? <ResourceDetailPage resource={r} /> : <div className="p-8 text-center">Resource not found</div>;
                        })()
                    )}
                    {view === 'profile' && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
                    {view === 'publicProfile' && viewId && (
                        (() => {
                            const u = users.find(u => u.id === viewId);
                            return u ? <ProfilePage user={u} allResources={resources} isCurrentUser={u.id === user.id} /> : <div className="p-8 text-center">User not found</div>;
                        })()
                    )}
                    {view === 'discussions' && <ForumsPage />}
                    {view === 'forumDetail' && viewId && (
                        (() => {
                            const p = forumPosts.find(post => post.id === viewId);
                            return p ? <ForumPostDetailPage post={p} /> : <div className="p-8 text-center">Post not found</div>;
                        })()
                    )}
                    {view === 'requests' && <ResourceRequestsPage />}
                    {view === 'messages' && <MessagesPage activeConversationId={viewId || null} />}
                    {view === 'leaderboard' && <LeaderboardPage />}
                    {view === 'admin' && <AdminPage />}
                </div>
            </main>

            {toast && <ToastNotification message={toast.message} type={toast.type} points={toast.points} onClose={() => setToast(null)} />}
            
            {isUploadModalOpen && (
                <UploadModal 
                    onClose={() => setIsUploadModalOpen(false)} 
                    onUpload={handleUpload}
                    fulfillingRequest={requestToFulfill}
                    isLoading={areResourcesLoading}
                />
            )}
            
            <TooltipGuide 
                targetSelector="#tour-upload-button"
                content="Click here to contribute resources and earn points!"
                currentStep={1}
                totalSteps={1}
                onNext={() => {}}
                onPrev={() => {}}
                onSkip={() => {}}
            />
        </div>
    </AppContext.Provider>
  );
};

export default App;
