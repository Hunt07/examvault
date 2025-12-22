
import { User, Resource, ResourceType, ExamType, ForumPost, Notification, NotificationType, Conversation, DirectMessage, MessageStatus, SemesterIntake, ResourceRequest, ResourceRequestStatus } from './types';

export const MASTER_ADMIN_EMAILS = ['b09220024@student.unimy.edu.my', 'Osama@unimy.edu.my', 'admin@unimy.edu.my'];

export const mockUser: User = {
  id: 'user-1',
  name: 'Osama',
  email: 'Osama@unimy.edu.my',
  avatarUrl: 'https://picsum.photos/seed/alex/100/100',
  joinDate: '2023-01-15T10:00:00Z',
  bio: 'Computer Science student passionate about AI and web development.',
  points: 1250,
  weeklyPoints: 150,
  uploadCount: 12,
  course: 'BCS',
  currentYear: 2,
  currentSemester: 3,
  subscriptions: {
    users: ['user-2'],
    lecturers: ['V NITTIYA'],
    courseCodes: ['BCCS2033'],
  },
  savedResourceIds: ['res-2', 'res-7'],
};

const mockUser2: User = {
  id: 'user-2',
  name: 'Ari',
  email: 'sam.l@unimy.edu.my',
  avatarUrl: 'https://picsum.photos/seed/sam/100/100',
  joinDate: '2022-08-20T14:30:00Z',
  bio: 'Software Engineering major. I love building things!',
  points: 850,
  weeklyPoints: 90,
  uploadCount: 7,
  course: 'BSE',
  currentYear: 3,
  currentSemester: 1,
  subscriptions: { users: [], lecturers: [], courseCodes: [] },
  savedResourceIds: [],
};

const mockUser3: User = {
  id: 'user-3',
  name: 'Ben C.',
  email: 'ben.c@unimy.edu.my',
  avatarUrl: 'https://picsum.photos/seed/ben/100/100',
  joinDate: '2023-09-01T11:00:00Z',
  bio: 'Business student focusing on marketing and analytics.',
  points: 1500,
  weeklyPoints: 200,
  uploadCount: 15,
  course: 'BBA',
  currentYear: 2,
  currentSemester: 2,
  subscriptions: { users: [], lecturers: [], courseCodes: [] },
  savedResourceIds: [],
};

const mockUser4: User = {
  id: 'user-4',
  name: 'Adema',
  email: 'maria.g@unimy.edu.my',
  avatarUrl: 'https://picsum.photos/seed/maria/100/100',
  joinDate: '2022-02-10T18:00:00Z',
  bio: 'Studying Psychology. Fascinated by human behavior.',
  points: 1100,
  weeklyPoints: 120,
  uploadCount: 9,
  course: 'BPS',
  currentYear: 3,
  currentSemester: 3,
  subscriptions: { users: [], lecturers: [], courseCodes: [] },
  savedResourceIds: [],
};

const mockUser5: User = {
  id: 'user-5',
  name: 'Ahmed',
  email: 'david.c@unimy.edu.my',
  avatarUrl: 'https://picsum.photos/seed/david/100/100',
  joinDate: '2024-01-05T09:20:00Z',
  bio: 'Future entrepreneur.',
  points: 620,
  weeklyPoints: 50,
  uploadCount: 5,
  course: 'BBA',
  currentYear: 1,
  currentSemester: 1,
  subscriptions: { users: [], lecturers: [], courseCodes: [] },
  savedResourceIds: [],
};

const mockUser6: User = {
  id: 'user-6',
  name: 'Sarah J.',
  email: 'sarah.j@unimy.edu.my',
  avatarUrl: 'https://picsum.photos/seed/sarah/100/100',
  joinDate: '2023-05-12T10:00:00Z',
  bio: 'Math enthusiast. E=mc²!',
  points: 940,
  weeklyPoints: 110,
  uploadCount: 8,
  course: 'BSc Mathematics',
  currentYear: 2,
  currentSemester: 2,
  subscriptions: { users: [], lecturers: [], courseCodes: [] },
  savedResourceIds: [],
};

export const mockUsers: User[] = [mockUser, mockUser2, mockUser3, mockUser4, mockUser5, mockUser6];

export const mockResources: Resource[] = [
  {
    id: 'res-1',
    type: ResourceType.PastPaper,
    title: 'Industrial Workshop Final Report Guidelines',
    courseCode: 'BCCS2033',
    courseName: 'Industrial Workshop',
    lecturer: 'V NITTIYA',
    year: 2023,
    semester: SemesterIntake.Sep,
    examType: ExamType.Final,
    description: 'Documentation guidelines and rubric for the final Industrial Workshop project submission.',
    fileUrl: '#',
    fileName: 'BCCS2033_Industrial_Workshop_Guidelines_2023.pdf',
    previewImageUrl: 'https://picsum.photos/seed/workshop/400/500',
    author: mockUser3,
    uploadDate: '2024-01-10T09:00:00Z',
    upvotes: 152,
    downvotes: 5,
    upvotedBy: [],
    downvotedBy: [],
    comments: [
        { id: 'c-1', author: mockUser2, text: 'This was a lifesaver for the formatting!', timestamp: '2024-01-11T12:00:00Z', parentId: null, upvotes: 15, upvotedBy: [] },
        { id: 'c-1-1', author: mockUser3, text: "Glad I could help!", timestamp: '2024-01-11T12:35:00Z', parentId: 'c-1', upvotes: 5, upvotedBy: [] },
    ],
    contentForAI: `Industrial Workshop Guidelines Content...`
  },
  {
    id: 'res-2',
    type: ResourceType.Notes,
    title: 'Thermodynamics Cheat Sheet',
    courseCode: 'ME310',
    courseName: 'Thermodynamics I',
    year: 2024,
    semester: SemesterIntake.Feb,
    description: 'Condensed cheat sheet for the first law of thermodynamics.',
    fileUrl: '#',
    fileName: 'ME310_Cheat_Sheet.pdf',
    previewImageUrl: 'https://picsum.photos/seed/thermo-notes/400/500',
    author: mockUser2,
    uploadDate: '2024-03-22T15:45:00Z',
    upvotes: 210,
    downvotes: 3,
    upvotedBy: [],
    downvotedBy: [],
    comments: [],
    contentForAI: `Thermodynamics Content...`
  }
];

export const mockForumPosts: ForumPost[] = [
  {
    id: 'post-1',
    title: 'Help with A* Search heuristic in AI (BCCS3033)',
    author: mockUser,
    timestamp: '2024-05-10T14:00:00Z',
    courseCode: 'BCCS3033',
    body: 'I am struggling to understand admissable heuristics for the A* search algorithm.',
    tags: ['ai', 'algorithms', 'help-wanted'],
    upvotes: 42,
    downvotes: 0,
    upvotedBy: [],
    downvotedBy: [],
    replies: [
      { id: 'reply-1-1', author: mockUser2, text: 'Optimality guarantees...', timestamp: '2024-05-10T14:30:00Z', upvotes: 15, upvotedBy: [], isVerified: true },
    ]
  }
];

export const mockResourceRequests: ResourceRequest[] = [
  {
    id: 'req-1',
    requester: mockUser4,
    timestamp: '2024-05-13T10:00:00Z',
    courseCode: 'BGEN2012',
    title: 'Professional Communication Past Slides',
    details: "I missed the lecture on 'Intercultural Communication'.",
    status: ResourceRequestStatus.Open,
  }
];

export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    recipientId: 'user-1',
    type: NotificationType.Subscription,
    message: "A new resource for 'V NITTIYA' was uploaded.",
    resourceId: 'res-1',
    timestamp: new Date().toISOString(),
    isRead: false,
  }
];

export const mockConversations: Conversation[] = [
  {
    id: 'convo-1',
    participants: ['user-1', 'user-2'],
    lastMessageTimestamp: new Date().toISOString(),
  },
];

export const mockDirectMessages: DirectMessage[] = [
  {
    id: 'msg-1',
    conversationId: 'convo-1',
    senderId: 'user-2',
    recipientId: 'user-1',
    text: 'Hey! Did you see the new AI notes?',
    timestamp: new Date().toISOString(),
    status: MessageStatus.Read,
  },
];
