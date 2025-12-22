
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  joinDate: string;
  bio: string;
  points: number;
  weeklyPoints: number;
  uploadCount: number;
  course: string;
  currentYear: number;
  currentSemester: number;
  subscriptions: UserSubscriptions;
  savedResourceIds: string[];
  status?: 'active' | 'deactivated' | 'banned';
  isAdmin?: boolean;
  lastSeen?: string;
}

export interface UserSubscriptions {
  users: string[];
  lecturers: string[];
  courseCodes: string[];
}

export enum ResourceType {
  PastPaper = 'Past Paper',
  Notes = 'Notes',
  Assignment = 'Assignment',
  Other = 'Other',
}

export enum ExamType {
    Midterm = 'Midterm',
    Final = 'Final',
    Quiz = 'Quiz',
}

export enum SemesterIntake {
    Feb = 'Feb',
    May = 'May',
    Sep = 'Sep',
}

export interface Comment {
  id: string;
  author: User;
  text: string;
  timestamp: string;
  parentId?: string | null;
  upvotes: number;
  upvotedBy: string[];
  attachment?: Attachment;
}

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  courseCode: string;
  courseName: string;
  lecturer?: string;
  year: number;
  semester: SemesterIntake;
  examType?: ExamType;
  description: string;
  fileUrl: string;
  fileName: string;
  fileBase64?: string;
  extractedText?: string;
  mimeType?: string;
  previewImageUrl: string;
  author: User;
  uploadDate: string;
  upvotes: number;
  downvotes: number;
  upvotedBy: string[];
  downvotedBy: string[];
  comments: Comment[];
  contentForAI: string;
}

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: string;
}

export interface ForumReply {
  id: string;
  author: User;
  text: string;
  timestamp: string;
  upvotes: number;
  upvotedBy: string[];
  isVerified: boolean;
  parentId?: string | null;
  attachment?: Attachment;
}

export interface ForumPost {
  id: string;
  title: string;
  author: User;
  timestamp: string;
  courseCode: string;
  body: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  upvotedBy: string[];
  downvotedBy: string[];
  replies: ForumReply[];
  attachment?: Attachment;
}

export enum NotificationType {
  NewResource = 'new_resource',
  Subscription = 'subscription',
  NewMessage = 'new_message',
  NewForumPost = 'new_forum_post',
  NewReply = 'new_reply',
  RequestFulfilled = 'request_fulfilled',
  NewRequest = 'new_request',
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  message: string;
  resourceId?: string;
  conversationId?: string;
  forumPostId?: string;
  commentId?: string;
  replyId?: string;
  requestId?: string;
  timestamp: string;
  isRead: boolean;
}

export enum MessageStatus {
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestamp: string;
  status: MessageStatus;
  isDeleted?: boolean;
  editedAt?: string;
}

export interface Conversation {
  id: string;
  participants: [string, string];
  lastMessageTimestamp: string;
}

export interface ResourceRequest {
  id: string;
  requester: User;
  timestamp: string;
  courseCode: string;
  title: string;
  details: string;
  status: ResourceRequestStatus;
  attachment?: Attachment;
  fulfillment?: {
    fulfiller: User;
    resourceId: string;
    timestamp: string;
  };
}

export enum ResourceRequestStatus {
  Open = 'Open',
  Fulfilled = 'Fulfilled',
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetType: 'resource' | 'post' | 'comment' | 'reply';
  targetTitle: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

export interface Flashcard {
  term: string;
  definition: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export type View = 'dashboard' | 'resourceDetail' | 'discussions' | 'forumDetail' | 'profile' | 'publicProfile' | 'messages' | 'leaderboard' | 'requests' | 'admin';

export interface AppContextType {
  user: User | null;
  users: User[];
  resources: Resource[];
  forumPosts: ForumPost[];
  notifications: Notification[];
  conversations: Conversation[];
  directMessages: DirectMessage[];
  resourceRequests: ResourceRequest[];
  reports: Report[];
  view: View;
  setView: (view: View, id?: string, options?: { replace?: boolean }) => void;
  logout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userRanks: Map<string, number>;
  savedResourceIds: string[];
  toggleSaveResource: (resourceId: string) => void;
  handleVote: (resourceId: string, action: 'up' | 'down') => void;
  addCommentToResource: (resourceId: string, text: string, parentId: string | null) => void;
  handleCommentVote: (resourceId: string, commentId: string) => void;
  deleteCommentFromResource: (resourceId: string, comment: Comment) => Promise<void>;
  addForumPost: (post: { title: string; courseCode: string; body: string; tags: string[] }, file?: File) => void;
  handlePostVote: (postId: string, action: 'up' | 'down') => void;
  deleteForumPost: (postId: string) => Promise<void>;
  addReplyToPost: (postId: string, text: string, parentId: string | null, file?: File) => void;
  handleReplyVote: (postId: string, replyId: string) => void;
  deleteReplyFromPost: (postId: string, reply: ForumReply) => Promise<void>;
  toggleVerifiedAnswer: (postId: string, replyId: string) => void;
  addResourceRequest: (req: { title: string; courseCode: string; details: string }, file?: File) => void;
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
  banUser: (userId: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
  toggleAdminStatus: (userId: string) => Promise<void>;
  updateReportStatus: (reportId: string, status: 'resolved' | 'dismissed') => Promise<void>;
  deleteAccount: () => Promise<void>;
  deactivateAccount: () => Promise<void>;
  hasUnreadMessages: boolean;
  hasUnreadDiscussions: boolean;
  isLoading: boolean;
  areResourcesLoading: boolean;
  scrollTargetId: string | null;
  setScrollTargetId: (id: string | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', points?: number) => void;
}
