
import React, { useState, useMemo, useEffect } from 'react';
import type { User, Resource, ForumPost, Comment, ForumReply, Notification, Conversation, DirectMessage, ResourceRequest, Attachment } from './types';
import { NotificationType, MessageStatus, ResourceRequestStatus } from './types';
import AuthPage from './components/pages/AuthPage';
import DashboardPage from './components/pages/DashboardPage';
import ResourceDetailPage from './components/pages/ResourceDetailPage';
import DiscussionsPage from './components/pages/ForumsPage';
import ForumPostDetailPage from './components/pages/ForumPostDetailPage';
import ProfilePage from './components/pages/ProfilePage';
import MessagesPage from './components/pages/MessagesPage';
import LeaderboardPage from './components/pages/LeaderboardPage';
import ResourceRequestsPage from './components/pages/ResourceRequestsPage';
import SideNav from './components/SideNav';
import Header from './components/Header';
import UploadModal, { generateFilePreview } from './components/UploadModal';
import TooltipGuide from './components/TooltipGuide';
import ToastNotification from './components/ToastNotification';

// Firebase Imports
import { auth, db, storage } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, serverTimestamp, arrayUnion, increment, where, arrayRemove, deleteField, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Loader2 } from 'lucide-react';

export type View = 'dashboard' | 'resourceDetail' | 'discussions' | 'forumDetail' | 'profile' | 'publicProfile' | 'messages' | 'leaderboard' | 'requests';

interface AppContextType {
  user: User | null;
  users: User[];
  resources: Resource[];
  forumPosts: ForumPost[];
  notifications: Notification[];
  conversations: Conversation[];
  directMessages: DirectMessage[];
  resourceRequests: ResourceRequest[];
  view: View;
  setView: (view: View, id?: string, options?: { replace?: boolean }) => void;
  logout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userRanks: Map<string, number>;
  savedResourceIds: string[];
  toggleSaveResource: (resourceId: string) => void;
  handleVote: (resourceId: string, type: 'upvote' | 'downvote' | 'undo_upvote' | 'undo_downvote') => void;
  addCommentToResource: (resourceId: string, text: string, parentId: string | null) => void;
  handleCommentVote: (resourceId: string, commentId: string, type: 'upvote' | 'undo_upvote') => void;
  deleteCommentFromResource: (resourceId: string, comment: Comment) => Promise<void>;
  addForumPost: (post: { title: string; courseCode: string; body: string; tags: string[] }) => void;
  handlePostVote: (postId: string, type: 'upvote' | 'undo_upvote') => void;
  deleteForumPost: (postId: string) => Promise<void>;
  addReplyToPost: (postId: string, text: string, parentId: string | null, attachment?: Attachment) => void;
  handleReplyVote: (postId: string, replyId: string, type: 'upvote' | 'undo_upvote') => void;
  deleteReplyFromPost: (postId: string, reply: ForumReply) => Promise<void>;
  toggleVerifiedAnswer: (postId: string, replyId: string) => void;
  addResourceRequest: (req: { title: string; courseCode: string; details: string }) => void;
  deleteResourceRequest: (requestId: string) => Promise<void>;
  openUploadForRequest: (requestId: string) => void;
  toggleUserSubscription: (userId: string) => void;
  toggleLecturerSubscription: (lecturerName: string) => void;
  toggleCourseCodeSubscription: (courseCode: string) => void;
  updateUserProfile: (data: Partial<User>) => void;
  sendMessage: (conversationId: string, text: string) => void;
  editMessage: (messageId: string, newText: string) => void;
  deleteMessage: (messageId: string) => void;
  startConversation: (userId: string, initialMessage?: string) => void;
  sendDirectMessageToUser: (userId: string, text: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  markMessagesAsRead: (conversationId: string) => void;
  goBack: () => void;
  deleteResource: (resourceId: string, fileUrl: string, previewUrl?: string) => Promise<void>;
  hasUnreadMessages: boolean;
  hasUnreadDiscussions: boolean;
  isLoading: boolean;
  areResourcesLoading: boolean;
  scrollTargetId: string | null;
  setScrollTargetId: (id: string | null) => void;
}

export const AppContext = React.createContext<AppContextType>({} as AppContextType);

// Helper to remove undefined values which Firestore hates
const sanitizeForFirestore = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj));
};

// Generate a default SVG avatar with the user's first initial
const generateDefaultAvatar = (name: string): string => {
  const initial = name.charAt(0).toUpperCase();
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#2563eb"/>
      <text x="50" y="65" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [areResourcesLoading, setAreResourcesLoading] = useState(true);
  const [view, setViewState] = useState<View>('dashboard');
  const [viewHistory, setViewHistory] = useState<{ view: View; id?: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  
  // Initialize dark mode from local storage or system preference
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('examvault_theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // Real Data Containers
  const [users, setUsers] = useState<User[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>([]);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [fulfillingRequest, setFulfillingRequest] = useState<ResourceRequest | undefined>(undefined);

  // Toast State
  const [toast, setToast] = useState<{ message: string; points?: number; type?: 'success' | 'error' | 'info' } | null>(null);

  // Tour State
  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // ------------------------------------------------------------------
  // 1. AUTHENTICATION PERSISTENCE & USER CREATION
  // ------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            // Existing user - load profile
            const userData = userSnap.data() as User;
            
            // Auto-repair missing fields in Firestore if they don't exist
            let hasUpdates = false;
            const updates: any = {};

            if (!userData.joinDate) {
                const now = new Date().toISOString();
                userData.joinDate = now;
                updates.joinDate = now;
                hasUpdates = true;
            }
            if (!userData.savedResourceIds) {
                userData.savedResourceIds = [];
                updates.savedResourceIds = [];
                hasUpdates = true;
            }
            if (!userData.subscriptions) {
                userData.subscriptions = { users: [], lecturers: [], courseCodes: [] };
                updates.subscriptions = { users: [], lecturers: [], courseCodes: [] };
                hasUpdates = true;
            }

            if (hasUpdates) {
                await updateDoc(userRef, updates);
            }

            setUser(userData);
          } else {
            // New user - Create profile in Firestore
            const displayName = firebaseUser.displayName || "Student";
            const defaultAvatar = generateDefaultAvatar(displayName);

            const newUser: User = {
              id: firebaseUser.uid,
              name: displayName,
              email: firebaseUser.email || "",
              avatarUrl: defaultAvatar, // Use Initial-based SVG
              joinDate: new Date().toISOString(),
              bio: "I am a student at UNIMY.",
              points: 0,
              weeklyPoints: 0,
              uploadCount: 0,
              course: "Student",
              currentYear: 1,
              currentSemester: 1,
              subscriptions: { users: [], lecturers: [], courseCodes: [] },
              savedResourceIds: []
            };
            
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
        setViewState('dashboard');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ------------------------------------------------------------------
  // 2. REAL-TIME DATA LISTENERS (FIRESTORE)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    setAreResourcesLoading(true);

    // Listen to Users
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(d => d.data() as User);
      setUsers(fetchedUsers);
      if (user) {
        const me = fetchedUsers.find(u => u.id === user.id);
        if (me) setUser(me);
      }
    });

    // Listen to Resources
    const unsubResources = onSnapshot(query(collection(db, "resources"), orderBy("uploadDate", "desc")), (snapshot) => {
      setResources(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
      setAreResourcesLoading(false);
    });

    // Listen to Forum Posts
    const unsubPosts = onSnapshot(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")), (snapshot) => {
      setForumPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost)));
    });

    // Listen to Requests
    const unsubRequests = onSnapshot(query(collection(db, "resourceRequests"), orderBy("timestamp", "desc")), (snapshot) => {
      setResourceRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ResourceRequest)));
    });

    // Listen to Conversations
    const unsubConvos = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", user.id)), (snapshot) => {
      setConversations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation)));
    });

    // Listen to Direct Messages
    const unsubMessages = onSnapshot(query(collection(db, "directMessages"), orderBy("timestamp", "asc")), (snapshot) => {
        setDirectMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage)));
    });

    // Listen to Notifications
    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("recipientId", "==", user.id)), (snapshot) => {
      const fetchedNotifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      // Sort client-side
      fetchedNotifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(fetchedNotifs);
    });

    return () => {
      unsubUsers();
      unsubResources();
      unsubPosts();
      unsubRequests();
      unsubConvos();
      unsubMessages();
      unsubNotifs();
    };
  }, [user?.id]);

  // ------------------------------------------------------------------
  // HELPER: CREATE NOTIFICATION
  // ------------------------------------------------------------------
  const sendNotification = async (recipientId: string, senderId: string, type: NotificationType, message: string, linkIds?: { resourceId?: string, forumPostId?: string, conversationId?: string, commentId?: string, replyId?: string }) => {
      if (recipientId === user?.id) return; // Don't notify self

      // Check for duplicates in client-side state to avoid spamming
      const isDuplicate = notifications.some(n => 
          n.recipientId === recipientId &&
          n.senderId === senderId &&
          n.type === type &&
          !n.isRead && 
          (linkIds?.resourceId ? n.resourceId === linkIds.resourceId : true) &&
          (linkIds?.forumPostId ? n.forumPostId === linkIds.forumPostId : true) &&
          (linkIds?.commentId ? n.commentId === linkIds.commentId : true) &&
          (linkIds?.replyId ? n.replyId === linkIds.replyId : true)
      );

      if (isDuplicate) return;

      await addDoc(collection(db, "notifications"), {
          recipientId,
          senderId,
          type,
          message,
          timestamp: new Date().toISOString(),
          isRead: false,
          ...linkIds
      });
  };

  // ------------------------------------------------------------------
  // MESSAGE DELIVERY LOGIC (Sent -> Delivered)
  // ------------------------------------------------------------------
  useEffect(() => {
      if (!user) return;
      // Find messages sent TO the current user that are still 'Sent'
      const incomingSentMessages = directMessages.filter(m => m.recipientId === user.id && m.status === MessageStatus.Sent);
      
      if (incomingSentMessages.length > 0) {
          const batch = writeBatch(db);
          incomingSentMessages.forEach(msg => {
              const msgRef = doc(db, "directMessages", msg.id);
              batch.update(msgRef, { status: MessageStatus.Delivered });
          });
          batch.commit();
      }
  }, [directMessages, user]);

  // ------------------------------------------------------------------
  // TOUR LOGIC
  // ------------------------------------------------------------------
  useEffect(() => {
    if (user && !isLoading) {
      const hasSeenTour = localStorage.getItem(`examvault_tour_${user.id}`);
      if (!hasSeenTour) {
        setRunTour(true);
        setTourStep(1);
      }
    }
  }, [user, isLoading]);

  const finishTour = () => {
    setRunTour(false);
    if (user) {
      localStorage.setItem(`examvault_tour_${user.id}`, 'true');
    }
  };

  const tourSteps = [
    { selector: 'body', content: "Welcome to ExamVault! Let's take a quick tour of your new study hub." },
    { selector: '#tour-sidenav', content: "Use the sidebar to navigate between the Dashboard, Discussions, Requests, Messages, and Leaderboard." },
    { selector: '#tour-search-bar', content: "Quickly find resources, users, or courses using the global search." },
    { selector: '#tour-filter-button', content: "Use filters to narrow down resources by year, semester, lecturer, or type." },
    { selector: '#tour-requests', content: "Can't find what you need? Check the Requests page to ask the community or help others." },
    { selector: '#tour-upload-button', content: "Contribute to the community by uploading your own past papers and notes." },
    { selector: '#tour-saved-items', content: "Access your bookmarked resources quickly from here." },
    { selector: '#tour-notifications', content: "Stay updated with new uploads, replies, and messages." },
    { selector: '#tour-dark-mode', content: "Toggle between Light and Dark mode for comfortable reading." },
    { selector: '#tour-profile-menu', content: "Manage your profile and settings here." },
    { selector: 'body', content: "You're all set! Happy Studying!" },
  ];

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('examvault_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('examvault_theme', 'light');
    }
  }, [isDarkMode]);

  // ------------------------------------------------------------------
  // NAVIGATION
  // ------------------------------------------------------------------
  const setView = (newView: View, id?: string, options?: { replace?: boolean }) => {
    if (!options?.replace) {
        setViewHistory(prev => [...prev, { view: newView, id }]);
    }
    setViewState(newView);
    setSelectedId(id);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop(); 
      const previous = newHistory[newHistory.length - 1];
      setViewHistory(newHistory);
      setViewState(previous.view);
      setSelectedId(previous.id);
    } else {
      setViewState('dashboard');
      setSelectedId(undefined);
    }
  };

  const handleLogin = (email: string) => {
    // Handled by AuthPage
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setViewState('dashboard');
    setViewHistory([]);
  };

  const toggleSaveResource = async (resourceId: string) => {
    if (!user) return;
    const isSaved = user.savedResourceIds?.includes(resourceId);
    const userRef = doc(db, "users", user.id);
    
    if (isSaved) {
        await updateDoc(userRef, {
            savedResourceIds: arrayRemove(resourceId)
        });
    } else {
        await updateDoc(userRef, {
            savedResourceIds: arrayUnion(resourceId)
        });
    }
  };

  // Helper to award points
  const earnPoints = async (amount: number, message: string) => {
    if (!user) return;
    const userRef = doc(db, "users", user.id);
    await updateDoc(userRef, {
        points: increment(amount),
        weeklyPoints: increment(amount)
    });
    // Dynamically set toast type based on positive/negative points
    const toastType = amount > 0 ? 'success' : 'info';
    setToast({ message, points: amount, type: toastType });
  };

  const userRanks = useMemo(() => {
    const sorted = [...users].sort((a, b) => b.points - a.points);
    const ranks = new Map<string, number>();
    sorted.forEach((u, index) => ranks.set(u.id, index));
    return ranks;
  }, [users]);

  // ------------------------------------------------------------------
  // ACTIONS (UPLOADING, POSTING, DELETING)
  // ------------------------------------------------------------------

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = async (resourceData: any, file: File, coverImage: File | null) => {
      if (!user) return;

      const tempId = `temp-${Date.now()}`;
      const tempPreview = coverImage ? URL.createObjectURL(coverImage) : generateFilePreview(file.name);
      
      const optimisticResource: Resource = {
          id: tempId,
          ...resourceData,
          author: user,
          uploadDate: new Date().toISOString(),
          upvotes: 0,
          downvotes: 0,
          comments: [],
          fileUrl: '#',
          fileName: file.name,
          previewImageUrl: tempPreview,
          fileBase64: '',
          mimeType: file.type,
          contentForAI: "Processing...", 
          semester: resourceData.semester
      };

      setResources(prev => [optimisticResource, ...prev]);
      setToast({ message: "Upload started... Resource will appear shortly.", type: 'info' });
      setIsUploadModalOpen(false);

      try {
          const storageRef = ref(storage, `resources/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);

          let previewUrl = '';
          if (coverImage) {
              const coverRef = ref(storage, `covers/${Date.now()}_${coverImage.name}`);
              await uploadBytes(coverRef, coverImage);
              previewUrl = await getDownloadURL(coverRef);
          } else {
              previewUrl = generateFilePreview(file.name);
          }

          let fileBase64 = '';
          try {
            fileBase64 = await fileToBase64(file);
          } catch (e) {
            console.error("Failed to convert file to base64", e);
          }

          const newResource: Omit<Resource, 'id'> = {
              ...resourceData,
              author: sanitizeForFirestore(user), // Sanitize user object
              uploadDate: new Date().toISOString(),
              upvotes: 0,
              downvotes: 0,
              comments: [],
              fileUrl: downloadURL,
              fileName: file.name,
              previewImageUrl: previewUrl, 
              fileBase64: fileBase64,
              mimeType: file.type,
              contentForAI: "Content is in the file...", 
          };

          const docRef = await addDoc(collection(db, "resources"), sanitizeForFirestore(newResource));
          
          if (fulfillingRequest) {
               const reqRef = doc(db, "resourceRequests", fulfillingRequest.id);
               await updateDoc(reqRef, {
                   status: ResourceRequestStatus.Fulfilled,
                   fulfillment: {
                       fulfiller: sanitizeForFirestore(user),
                       resourceId: docRef.id,
                       timestamp: new Date().toISOString()
                   }
               });
               sendNotification(
                   fulfillingRequest.requester.id,
                   user.id,
                   NotificationType.RequestFulfilled,
                   `${user.name} fulfilled your request for ${fulfillingRequest.title}`,
                   { resourceId: docRef.id }
               );

               setFulfillingRequest(undefined);
               earnPoints(50, "Request fulfilled successfully!");
          } else {
               const userRef = doc(db, "users", user.id);
               await updateDoc(userRef, { uploadCount: increment(1) });
               earnPoints(25, "Resource uploaded successfully!");
               
               // Fan-out notifications to subscribers
               users.forEach(u => {
                   if (u.id === user.id) return;
                   
                   let shouldNotify = false;
                   let msg = '';

                   if (u.subscriptions?.users?.includes(user.id)) {
                       shouldNotify = true;
                       msg = `${user.name} uploaded a new resource: ${resourceData.title}`;
                   } else if (resourceData.lecturer && u.subscriptions?.lecturers?.includes(resourceData.lecturer)) {
                       shouldNotify = true;
                       msg = `New resource for ${resourceData.lecturer}: ${resourceData.title}`;
                   } else if (u.subscriptions?.courseCodes?.includes(resourceData.courseCode)) {
                       shouldNotify = true;
                       msg = `New resource for ${resourceData.courseCode}: ${resourceData.title}`;
                   }

                   if (shouldNotify) {
                       sendNotification(u.id, user.id, NotificationType.Subscription, msg, { resourceId: docRef.id });
                   }
               });
          }
      } catch (error) {
          console.error("Upload failed", error);
          setResources(prev => prev.filter(r => r.id !== tempId));
          setToast({ message: "Upload failed. Please try again.", type: 'error' });
      }
  };

  const deleteResource = async (resourceId: string, fileUrl: string, previewUrl?: string) => {
      if (!user) return;
      
      // Optimistic navigation
      setViewState('dashboard');
      setSelectedId(undefined);
      
      try {
          await deleteDoc(doc(db, "resources", resourceId));

          if (fileUrl && fileUrl.startsWith('http')) {
              try {
                  const fileRef = ref(storage, fileUrl);
                  await deleteObject(fileRef);
              } catch (e) {
                  console.warn("Could not delete file:", e);
              }
          }

          if (previewUrl && previewUrl.includes('firebasestorage')) {
              try {
                  const coverRef = ref(storage, previewUrl);
                  await deleteObject(coverRef);
              } catch (e) {
                  console.warn("Could not delete cover image:", e);
              }
          }

          const userRef = doc(db, "users", user.id);
          await updateDoc(userRef, { uploadCount: increment(-1) });

          // Deduct points based on whether it fulfilled a request
          const fulfilledReq = resourceRequests.find(req => req.fulfillment?.resourceId === resourceId);
          if (fulfilledReq) {
              const reqRef = doc(db, "resourceRequests", fulfilledReq.id);
              await updateDoc(reqRef, {
                  status: ResourceRequestStatus.Open,
                  fulfillment: deleteField()
              });
              earnPoints(-50, "Resource deleted. Reverted fulfillment bonus.");
          } else {
              earnPoints(-25, "Resource deleted. Points reverted.");
          }

      } catch (error) {
          console.error("Delete failed", error);
          setToast({ message: "Failed to delete resource.", type: 'error' });
      }
  };

  const handleVote = async (resourceId: string, type: 'upvote' | 'downvote' | 'undo_upvote' | 'undo_downvote') => {
    const resourceRef = doc(db, "resources", resourceId);
    let updates = {};
    switch (type) {
        case 'upvote': updates = { upvotes: increment(1) }; break;
        case 'undo_upvote': updates = { upvotes: increment(-1) }; break;
        case 'downvote': updates = { downvotes: increment(1) }; break;
        case 'undo_downvote': updates = { downvotes: increment(-1) }; break;
    }
    await updateDoc(resourceRef, updates);
  };

  const addCommentToResource = async (resourceId: string, text: string, parentId: string | null) => {
    if (!user) return;
    try {
        const commentId = `c-${Date.now()}`;
        const newComment: Comment = {
            id: commentId,
            author: sanitizeForFirestore(user), // Sanitize user to avoid undefined fields
            text,
            timestamp: new Date().toISOString(),
            parentId,
            upvotes: 0
        };
        
        const resRef = doc(db, "resources", resourceId);
        await updateDoc(resRef, {
            comments: arrayUnion(sanitizeForFirestore(newComment))
        });

        // 1. Notify resource author
        const resource = resources.find(r => r.id === resourceId);
        if (resource && resource.author.id !== user.id) {
            sendNotification(
                resource.author.id, 
                user.id, 
                NotificationType.NewReply, 
                `${user.name} commented on your resource: ${resource.title}`, 
                { resourceId, commentId }
            );
        }

        // 2. Notify parent comment author (if reply)
        if (parentId) {
            const parentComment = resource?.comments.find(c => c.id === parentId);
            if (parentComment && parentComment.author.id !== user.id && parentComment.author.id !== resource?.author.id) {
                 sendNotification(
                     parentComment.author.id, 
                     user.id, 
                     NotificationType.NewReply, 
                     `${user.name} replied to your comment on ${resource?.title}`, 
                     { resourceId, commentId }
                 );
            }
        }

    } catch (error) {
        console.error("Failed to add comment", error);
        setToast({ message: "Failed to post comment. Please try again.", type: 'error' });
    }
  };

  const deleteCommentFromResource = async (resourceId: string, comment: Comment) => {
      try {
          const resRef = doc(db, "resources", resourceId);
          await updateDoc(resRef, {
              comments: arrayRemove(comment)
          });
          setToast({ message: "Comment deleted.", type: 'success' });
      } catch (error) {
          console.error("Failed to delete comment", error);
          setToast({ message: "Failed to delete comment.", type: 'error' });
      }
  };

  const handleCommentVote = async (resourceId: string, commentId: string, type: 'upvote' | 'undo_upvote') => {
     const resRef = doc(db, "resources", resourceId);
     const snap = await getDoc(resRef);
     if (snap.exists()) {
         const data = snap.data() as Resource;
         const updatedComments = data.comments.map(c => {
             if (c.id === commentId) {
                 return { ...c, upvotes: c.upvotes + (type === 'upvote' ? 1 : -1) };
             }
             return c;
         });
         await updateDoc(resRef, { comments: updatedComments });
     }
  };

  const addForumPost = async (postData: { title: string; courseCode: string; body: string; tags: string[] }) => {
      if (!user) return;
      try {
          const newPost: Omit<ForumPost, 'id'> = {
              ...postData,
              author: sanitizeForFirestore(user),
              timestamp: new Date().toISOString(),
              upvotes: 0,
              replies: []
          };
          await addDoc(collection(db, "forumPosts"), sanitizeForFirestore(newPost));
          earnPoints(10, "Discussion posted successfully!");
      } catch (error) {
          console.error("Failed to add post", error);
          setToast({ message: "Failed to post discussion.", type: 'error' });
      }
  };

  const deleteForumPost = async (postId: string) => {
      setViewState('discussions');
      setSelectedId(undefined);
      try {
          await deleteDoc(doc(db, "forumPosts", postId));
          earnPoints(-10, "Post deleted. Points reverted.");
      } catch (error) {
          console.error("Delete post failed", error);
          setToast({ message: "Failed to delete post.", type: 'error' });
      }
  };

  const handlePostVote = async (postId: string, type: 'upvote' | 'undo_upvote') => {
      const postRef = doc(db, "forumPosts", postId);
      await updateDoc(postRef, {
          upvotes: increment(type === 'upvote' ? 1 : -1)
      });
  };

  const addReplyToPost = async (postId: string, text: string, parentId: string | null, attachment?: Attachment) => {
      if (!user) return;
      
      try {
          const replyId = `reply-${Date.now()}`;
          const newReply: ForumReply = {
              id: replyId,
              author: sanitizeForFirestore(user),
              text,
              timestamp: new Date().toISOString(),
              upvotes: 0,
              isVerified: false,
              parentId
          };

          if (attachment) {
              newReply.attachment = attachment;
          }

          const postRef = doc(db, "forumPosts", postId);
          await updateDoc(postRef, {
              replies: arrayUnion(sanitizeForFirestore(newReply))
          });

          // 1. Notify post author
          const post = forumPosts.find(p => p.id === postId);
          if (post && post.author.id !== user.id) {
              sendNotification(
                  post.author.id, 
                  user.id, 
                  NotificationType.NewReply, 
                  `${user.name} replied to your post: ${post.title}`, 
                  { forumPostId: postId, replyId }
              );
          }

          // 2. Notify parent reply author
          if (parentId) {
              const parentReply = post?.replies.find(r => r.id === parentId);
              if (parentReply && parentReply.author.id !== user.id && parentReply.author.id !== post?.author.id) {
                  sendNotification(
                      parentReply.author.id, 
                      user.id, 
                      NotificationType.NewReply, 
                      `${user.name} replied to your comment in ${post?.title}`, 
                      { forumPostId: postId, replyId }
                  );
              }
          }

      } catch (error) {
          console.error("Failed to add reply", error);
          setToast({ message: "Failed to post reply.", type: 'error' });
      }
  };

  const deleteReplyFromPost = async (postId: string, reply: ForumReply) => {
      try {
          const postRef = doc(db, "forumPosts", postId);
          await updateDoc(postRef, {
              replies: arrayRemove(reply)
          });
          setToast({ message: "Reply deleted.", type: 'success' });
      } catch (error) {
          console.error("Delete reply failed", error);
          setToast({ message: "Failed to delete reply.", type: 'error' });
      }
  };

  const handleReplyVote = async (postId: string, replyId: string, type: 'upvote' | 'undo_upvote') => {
      const postRef = doc(db, "forumPosts", postId);
      const snap = await getDoc(postRef);
      if (snap.exists()) {
          const data = snap.data() as ForumPost;
          const updatedReplies = data.replies.map(r => {
              if (r.id === replyId) {
                  return { ...r, upvotes: r.upvotes + (type === 'upvote' ? 1 : -1) };
              }
              return r;
          });
          await updateDoc(postRef, { replies: updatedReplies });
      }
  };

  const toggleVerifiedAnswer = async (postId: string, replyId: string) => {
      const postRef = doc(db, "forumPosts", postId);
      const snap = await getDoc(postRef);
      if (snap.exists()) {
          const data = snap.data() as ForumPost;
          const updatedReplies = data.replies.map(r => {
              if (r.id === replyId) {
                  const newState = !r.isVerified;
                  if (newState) earnPoints(15, "Marked answer as verified!");
                  return { ...r, isVerified: newState };
              }
              return r;
          });
          await updateDoc(postRef, { replies: updatedReplies });
      }
  };

  const addResourceRequest = async (reqData: { title: string; courseCode: string; details: string }) => {
      if (!user) return;
      try {
          const newReq: Omit<ResourceRequest, 'id'> = {
              requester: sanitizeForFirestore(user),
              timestamp: new Date().toISOString(),
              status: ResourceRequestStatus.Open,
              ...reqData
          };
          const docRef = await addDoc(collection(db, "resourceRequests"), sanitizeForFirestore(newReq));
          earnPoints(5, "Request posted successfully!");

          // Fan-out notification to followers
          users.forEach(u => {
              if (u.id === user.id) return;
              if (u.subscriptions?.users?.includes(user.id)) {
                  sendNotification(
                      u.id, 
                      user.id, 
                      NotificationType.Subscription, 
                      `${user.name} made a new request: ${reqData.title}`,
                      { forumPostId: undefined } 
                  );
              }
          });

      } catch (error) {
          console.error("Failed to add request", error);
          setToast({ message: "Failed to post request.", type: 'error' });
      }
  };

  const deleteResourceRequest = async (requestId: string) => {
      try {
          await deleteDoc(doc(db, "resourceRequests", requestId));
          earnPoints(-5, "Request deleted. Points reverted.");
      } catch (error) {
          console.error("Delete request failed", error);
          setToast({ message: "Failed to delete request.", type: 'error' });
      }
  };

  const openUploadForRequest = (requestId: string) => {
      const req = resourceRequests.find(r => r.id === requestId);
      if (req) {
          setFulfillingRequest(req);
          setIsUploadModalOpen(true);
      }
  };

  const toggleUserSubscription = async (targetUserId: string) => {
      if (!user) return;
      const isFollowing = user.subscriptions.users.includes(targetUserId);
      const userRef = doc(db, "users", user.id);
      
      if (isFollowing) {
          await updateDoc(userRef, { "subscriptions.users": arrayRemove(targetUserId) });
      } else {
          await updateDoc(userRef, { "subscriptions.users": arrayUnion(targetUserId) });
          sendNotification(targetUserId, user.id, NotificationType.Subscription, `${user.name} started following you.`);
      }
  };

  const toggleLecturerSubscription = async (lecturerName: string) => {
      if (!user) return;
      const isFollowing = user.subscriptions.lecturers.includes(lecturerName);
      const userRef = doc(db, "users", user.id);
      
      if (isFollowing) {
          await updateDoc(userRef, { "subscriptions.lecturers": arrayRemove(lecturerName) });
      } else {
          await updateDoc(userRef, { "subscriptions.lecturers": arrayUnion(lecturerName) });
      }
  };

  const toggleCourseCodeSubscription = async (courseCode: string) => {
      if (!user) return;
      const isFollowing = user.subscriptions.courseCodes.includes(courseCode);
      const userRef = doc(db, "users", user.id);
      
      if (isFollowing) {
          await updateDoc(userRef, { "subscriptions.courseCodes": arrayRemove(courseCode) });
      } else {
          await updateDoc(userRef, { "subscriptions.courseCodes": arrayUnion(courseCode) });
      }
  };

  const updateUserProfile = async (data: Partial<User>) => {
      if (!user) return;
      
      // 1. Update the main user document
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, data);
      
      // Optimistic update locally
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);

      const updateData = sanitizeForFirestore(data);

      // 2. Propagate updates to Resources (Author field)
      const resQuery = query(collection(db, "resources"), where("author.id", "==", user.id));
      const resSnap = await getDocs(resQuery);
      resSnap.forEach(async (docSnap) => {
           await updateDoc(docSnap.ref, { author: { ...docSnap.data().author, ...updateData } });
      });

      // 3. Propagate updates to Comments (inside Resources)
      const allResSnap = await getDocs(collection(db, "resources"));
      allResSnap.forEach(async (docSnap) => {
          const res = docSnap.data() as Resource;
          let changed = false;
          const updatedComments = res.comments.map(c => {
              if (c.author.id === user.id) {
                  changed = true;
                  return { ...c, author: { ...c.author, ...updateData } };
              }
              return c;
          });
          if (changed) {
              await updateDoc(docSnap.ref, { comments: updatedComments });
          }
      });

      // 4. Propagate updates to Forum Posts (Author field)
      const postQuery = query(collection(db, "forumPosts"), where("author.id", "==", user.id));
      const postSnap = await getDocs(postQuery);
      postSnap.forEach(async (docSnap) => {
           await updateDoc(docSnap.ref, { author: { ...docSnap.data().author, ...updateData } });
      });

      // 5. Propagate updates to Replies (inside Forum Posts)
      const allPostsSnap = await getDocs(collection(db, "forumPosts"));
      allPostsSnap.forEach(async (docSnap) => {
          const post = docSnap.data() as ForumPost;
          let changed = false;
          const updatedReplies = post.replies.map(r => {
              if (r.author.id === user.id) {
                  changed = true;
                  return { ...r, author: { ...r.author, ...updateData } };
              }
              return r;
          });
          if (changed) {
              await updateDoc(docSnap.ref, { replies: updatedReplies });
          }
      });

      // 6. Propagate updates to Requests (Requester)
      const reqQuery = query(collection(db, "resourceRequests"), where("requester.id", "==", user.id));
      const reqSnap = await getDocs(reqQuery);
      reqSnap.forEach(async (docSnap) => {
           await updateDoc(docSnap.ref, { requester: { ...docSnap.data().requester, ...updateData } });
      });
  };

  const startConversation = async (userId: string, initialMessage?: string) => {
      if (!user) return;
      
      const existing = conversations.find(c => c.participants.includes(userId) && c.participants.includes(user.id));
      
      let convoId = existing?.id;

      if (!existing) {
          const docRef = await addDoc(collection(db, "conversations"), {
              participants: [user.id, userId],
              lastMessageTimestamp: new Date().toISOString()
          });
          convoId = docRef.id;
      }

      if (initialMessage && convoId) {
          await sendMessage(convoId, initialMessage);
      } else if (convoId) {
          setView('messages', convoId);
      }
  };

  const sendMessage = async (conversationId: string, text: string) => {
      if (!user) return;
      
      const convo = conversations.find(c => c.id === conversationId);
      if (!convo) return;
      
      const recipientId = convo.participants.find(id => id !== user.id);
      if (!recipientId) return;

      await addDoc(collection(db, "directMessages"), {
          conversationId,
          senderId: user.id,
          recipientId,
          text,
          timestamp: new Date().toISOString(),
          status: MessageStatus.Sent 
      });

      const convoRef = doc(db, "conversations", conversationId);
      await updateDoc(convoRef, {
          lastMessageTimestamp: new Date().toISOString()
      });

      sendNotification(recipientId, user.id, NotificationType.NewMessage, `New message from ${user.name}`, { conversationId });
  };

  const editMessage = async (messageId: string, newText: string) => {
      const msgRef = doc(db, "directMessages", messageId);
      await updateDoc(msgRef, {
          text: newText,
          editedAt: new Date().toISOString()
      });
  };

  const deleteMessage = async (messageId: string) => {
      const msgRef = doc(db, "directMessages", messageId);
      await updateDoc(msgRef, {
          isDeleted: true,
          text: ""
      });
  };
  
  const sendDirectMessageToUser = (userId: string, text: string) => {
      startConversation(userId, text);
  };

  const markNotificationAsRead = async (id: string) => {
      const notifRef = doc(db, "notifications", id);
      await updateDoc(notifRef, { isRead: true });
  };

  const markAllNotificationsAsRead = async () => {
      // In a real app with many notifs, use a batch write
      notifications.filter(n => !n.isRead).forEach(async (n) => {
          const notifRef = doc(db, "notifications", n.id);
          await updateDoc(notifRef, { isRead: true });
      });
  };

  const clearAllNotifications = async () => {
      if (!user) return;
      // Get all user notifications
      const q = query(collection(db, "notifications"), where("recipientId", "==", user.id));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
      });
      await batch.commit();
      setNotifications([]);
  };

  const markMessagesAsRead = async (conversationId: string) => {
      if (!user) return;
      const unreadMessages = directMessages.filter(
          m => m.conversationId === conversationId && m.recipientId === user.id && m.status !== MessageStatus.Read
      );
      
      if (unreadMessages.length > 0) {
          const batch = writeBatch(db);
          unreadMessages.forEach(msg => {
              batch.update(doc(db, "directMessages", msg.id), { status: MessageStatus.Read });
          });
          await batch.commit();
      }
  };

  const hasUnreadMessages = useMemo(() => {
      return directMessages.some(m => m.recipientId === user?.id && m.status !== MessageStatus.Read);
  }, [directMessages, user]);

  const hasUnreadDiscussions = false;

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg">
            <Loader2 size={48} className="animate-spin text-primary-600" />
        </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <AppContext.Provider value={{
      user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests,
      view, setView, logout, isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
      userRanks, savedResourceIds: user.savedResourceIds || [], toggleSaveResource, handleVote, addCommentToResource, handleCommentVote, deleteCommentFromResource,
      addForumPost, handlePostVote, deleteForumPost, addReplyToPost, handleReplyVote, deleteReplyFromPost, toggleVerifiedAnswer,
      addResourceRequest, deleteResourceRequest, openUploadForRequest,
      toggleUserSubscription, toggleLecturerSubscription, toggleCourseCodeSubscription,
      updateUserProfile, sendMessage, editMessage, deleteMessage, startConversation, sendDirectMessageToUser, markNotificationAsRead, markAllNotificationsAsRead, markMessagesAsRead,
      clearAllNotifications,
      goBack, hasUnreadMessages, hasUnreadDiscussions,
      isLoading, deleteResource,
      areResourcesLoading,
      scrollTargetId, setScrollTargetId
    }}>
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
        <Header onUploadClick={() => { setFulfillingRequest(undefined); setIsUploadModalOpen(true); }} />
        <SideNav />
        
        <main className="ml-20 transition-all duration-300 pt-4 px-4 md:px-8 pb-8">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'resourceDetail' && selectedId && (
             <ResourceDetailPage 
                resource={resources.find(r => r.id === selectedId) || resources[0]} 
             />
          )}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'forumDetail' && selectedId && (
              <ForumPostDetailPage
                post={forumPosts.find(p => p.id === selectedId) || forumPosts[0]}
              />
          )}
          {view === 'profile' && user && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'publicProfile' && selectedId && (
              <ProfilePage 
                user={users.find(u => u.id === selectedId) || user} 
                allResources={resources} 
                isCurrentUser={selectedId === user.id} 
              />
          )}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
          {view === 'requests' && <ResourceRequestsPage />}
        </main>

        {isUploadModalOpen && (
            <UploadModal 
                onClose={() => { setIsUploadModalOpen(false); setFulfillingRequest(undefined); }} 
                onUpload={handleUpload}
                fulfillingRequest={fulfillingRequest}
            />
        )}
        
        {runTour && (
            <TooltipGuide
                targetSelector={tourSteps[tourStep - 1]?.selector || 'body'}
                content={tourSteps[tourStep - 1]?.content || ''}
                currentStep={tourStep}
                totalSteps={tourSteps.length}
                onNext={() => {
                    if (tourStep < tourSteps.length) {
                        setTourStep(tourStep + 1);
                    } else {
                        finishTour();
                    }
                }}
                onPrev={() => setTourStep(Math.max(1, tourStep - 1))}
                onSkip={finishTour}
            />
        )}

        {toast && (
            <ToastNotification
                message={toast.message}
                points={toast.points}
                type={toast.type}
                onClose={() => setToast(null)}
            />
        )}
      </div>
    </AppContext.Provider>
  );
};

export default App;
