
import { User, Resource, ResourceType, ExamType, ForumPost, Notification, NotificationType, Conversation, DirectMessage, MessageStatus, SemesterIntake, ResourceRequest, ResourceRequestStatus } from './types';

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
    users: ['user-2'], // Following Ari
    lecturers: ['V NITTIYA'],
    courseCodes: ['BCCS2033'],
  },
  savedResourceIds: ['res-2', 'res-7'],
  savedPostIds: [],
  savedRequestIds: [],
  role: 'admin', // Make the main mock user an Admin for easy testing
  status: 'active',
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
  savedPostIds: [],
  savedRequestIds: [],
  role: 'student',
  status: 'active',
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
  savedPostIds: [],
  savedRequestIds: [],
  role: 'student',
  status: 'active',
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
  savedPostIds: [],
  savedRequestIds: [],
  role: 'student',
  status: 'active',
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
  savedPostIds: [],
  savedRequestIds: [],
  role: 'student',
  status: 'active',
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
  savedPostIds: [],
  savedRequestIds: [],
  role: 'student',
  status: 'active',
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
    contentForAI: `
    Industrial Workshop (BCCS2033) - Project Guidelines

    1. Introduction
    - Objectives of the workshop.
    - Safety protocols.

    2. Project Deliverables
    - Requirement Analysis Document.
    - System Design Document (SDD).
    - Source Code (GitHub Repository).
    - Final Report (PDF).

    3. Evaluation Rubric
    - Functionality (40%)
    - Documentation (30%)
    - Presentation (30%)

    4. Submission Deadline
    - Week 14, Friday 5 PM.
    `
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
    contentForAI: `
    Thermodynamics I Cheat Sheet

    - First Law: Q - W = Delta U
    - Enthalpy: H = U + PV
    - Ideal Gas Law: PV = mRT
    `
  },
    {
    id: 'res-3',
    type: ResourceType.PastPaper,
    title: 'Compiler Analysis Midterm 2024',
    courseCode: 'BCCS2093',
    courseName: 'Compiler & Program Analysis',
    lecturer: 'ROSLAILY',
    year: 2024,
    semester: SemesterIntake.May,
    examType: ExamType.Midterm,
    description: 'Midterm exam covering lexical analysis, regex to NFA conversion, and parsing trees.',
    fileUrl: '#',
    fileName: 'BCCS2093_Midterm_2024.pdf',
    previewImageUrl: 'https://picsum.photos/seed/compiler/400/500',
    author: mockUser4,
    uploadDate: '2024-04-05T11:20:00Z',
    upvotes: 98,
    downvotes: 1,
    upvotedBy: [],
    downvotedBy: [],
    comments: [],
    contentForAI: `
    Compiler & Program Analysis (BCCS2093) - Midterm

    Question 1: Lexical Analysis
    Convert the following Regular Expression to an NFA: (a|b)*abb

    Question 2: Context-Free Grammars
    Eliminate left recursion from the following grammar:
    E -> E + T | T
    T -> T * F | F
    F -> (E) | id

    Question 3: Parsing
    Construct the LL(1) parsing table for the grammar in Question 2.
    `
  },
  {
    id: 'res-4',
    type: ResourceType.Notes,
    title: 'Professional Communication Slides',
    courseCode: 'BGEN2012',
    courseName: 'Professional Communication',
    lecturer: 'MAHALINGAM',
    year: 2023,
    semester: SemesterIntake.Sep,
    description: 'Lecture slides on effective email writing and business presentation skills.',
    fileUrl: '#',
    fileName: 'BGEN2012_Slides.pdf',
    previewImageUrl: 'https://picsum.photos/seed/communication/400/500',
    author: mockUser4,
    uploadDate: '2023-11-15T14:00:00Z',
    upvotes: 75,
    downvotes: 0,
    upvotedBy: [],
    downvotedBy: [],
    comments: [],
    contentForAI: `
    Professional Communication (BGEN2012) - Key Concepts

    1. Effective Email Writing:
    - Subject lines matters.
    - Be concise and clear.
    - Proper salutations and sign-offs.

    2. Business Presentations:
    - Know your audience.
    - The 10-20-30 Rule (Guy Kawasaki).
    - Non-verbal communication (Body language, Eye contact).

    3. Meeting Minutes:
    - Recording decisions and action items.
    `
  },
  {
    id: 'res-5',
    type: ResourceType.PastPaper,
    title: 'New Venture Creation Final Exam',
    courseCode: 'MPU3233',
    courseName: 'New Venture Creation',
    lecturer: 'MUHAMMAD FAIZOL',
    year: 2023,
    semester: SemesterIntake.May,
    examType: ExamType.Final,
    description: 'Final exam questions involving Business Model Canvas creation and financial projections.',
    fileUrl: '#',
    fileName: 'MPU3233_Final_2023.pdf',
    previewImageUrl: 'https://picsum.photos/seed/venture/400/500',
    author: mockUser6,
    uploadDate: '2023-06-01T09:00:00Z',
    upvotes: 130,
    downvotes: 2,
    upvotedBy: [],
    downvotedBy: [],
    comments: [],
    contentForAI: `
    New Venture Creation (MPU3233) Final Exam

    1. Business Model Canvas (40 marks)
    Create a BMC for a subscription-based coffee delivery service. Detail the Value Proposition, Customer Segments, and Revenue Streams.

    2. Financial Plan (30 marks)
    Calculate the break-even point given the fixed costs, variable costs per unit, and selling price.

    3. Marketing Strategy (30 marks)
    Propose a go-to-market strategy for the service above using social media channels.
    `
  },
  {
    id: 'res-6',
    type: ResourceType.Notes,
    title: 'Mathematics II - Multivariable Calculus Notes',
    courseCode: 'BGMT2033',
    courseName: 'Mathematics II',
    lecturer: 'NOOR FADZILLAH',
    year: 2024,
    semester: SemesterIntake.Feb,
    description: 'Comprehensive notes covering partial derivatives, multiple integrals, and vector calculus.',
    fileUrl: '#',
    fileName: 'BGMT2033_Calc_Notes.pdf',
    previewImageUrl: 'https://picsum.photos/seed/maths/400/500',
    author: mockUser3,
    uploadDate: '2024-03-10T16:20:00Z',
    upvotes: 88,
    downvotes: 1,
    upvotedBy: [],
    downvotedBy: [],
    comments: [],
    contentForAI: `
    Mathematics II (BGMT2033) - Chapter Summaries

    Chapter 1: Partial Derivatives
    - Functions of several variables.
    - The Chain Rule.
    - Directional derivatives and the gradient vector.

    Chapter 2: Multiple Integrals
    - Double integrals over rectangles and general regions.
    - Double integrals in polar coordinates.
    - Triple integrals.

    Chapter 3: Vector Calculus
    - Vector fields.
    - Line integrals.
    - Green's Theorem.
    `
  },
  {
    id: 'res-7',
    type: ResourceType.PastPaper,
    title: 'Artificial Intelligence Midterm',
    courseCode: 'BCCS3033',
    courseName: 'Artificial Intelligence',
    lecturer: 'HABIBOLLAH',
    year: 2023,
    semester: SemesterIntake.Sep,
    examType: ExamType.Midterm,
    description: 'Midterm covering Search Algorithms (BFS, DFS, A*), Heuristics, and Logic.',
    fileUrl: '#',
    fileName: 'BCCS3033_Midterm_2023.pdf',
    previewImageUrl: 'https://picsum.photos/seed/ai/400/500',
    author: mockUser,
    uploadDate: '2023-10-25T11:00:00Z',
    upvotes: 115,
    downvotes: 4,
    upvotedBy: [],
    downvotedBy: [],
    comments: [],
    contentForAI: `
    Artificial Intelligence (BCCS3033) Midterm Exam

    1. Search Algorithms
    Compare and contrast Depth-First Search (DFS) and Breadth-First Search (BFS) in terms of completeness and optimality.

    2. A* Search
    Given a graph with heuristic values, trace the A* search algorithm to find the shortest path.

    3. Logic
    Convert the following sentence into First-Order Logic: "Everyone who loves all animals is loved by someone."

    4. Minimax Algorithm
    Explain how the Minimax algorithm works in a two-player zero-sum game.
    `
  }
];

export const mockForumPosts: ForumPost[] = [
  {
    id: 'post-1',
    title: 'Help with A* Search heuristic in AI (BCCS3033)',
    author: mockUser,
    timestamp: '2024-05-10T14:00:00Z',
    courseCode: 'BCCS3033',
    body: 'I am struggling to understand admissable heuristics for the A* search algorithm. Can someone explain why the heuristic must never overestimate the cost to reach the goal?',
    tags: ['ai', 'algorithms', 'help-wanted'],
    upvotes: 42,
    downvotes: 0,
    upvotedBy: [],
    downvotedBy: [],
    replies: [
      { id: 'reply-1-1', author: mockUser2, text: 'If the heuristic overestimates, A* might find a path that it thinks is cheaper but is actually longer than the optimal path. Admissibility guarantees optimality!', timestamp: '2024-05-10T14:30:00Z', upvotes: 15, upvotedBy: [], isVerified: true, parentId: null },
    ]
  },
  {
    id: 'post-2',
    title: 'Study group for Compiler & Program Analysis (BCCS2093)',
    author: mockUser2,
    timestamp: '2024-05-12T11:25:00Z',
    courseCode: 'BCCS2093',
    body: 'Hi all, the final for Compilers is coming up. I want to go over parsing tables and LL(1) grammars. Anyone interested in joining a study group at the library?',
    tags: ['studying', 'final-exam'],
    upvotes: 68,
    downvotes: 0,
    upvotedBy: [],
    downvotedBy: [],
    replies: []
  },
  {
    id: 'post-3',
    title: 'Tips for New Venture Creation pitch?',
    author: mockUser5,
    timestamp: '2024-05-14T09:15:00Z',
    courseCode: 'MPU3233',
    body: 'I have my pitch next week for the New Venture Creation module. Does anyone have tips on what Sir Faizol looks for specifically in the financial slides?',
    tags: ['entrepreneurship', 'presentation'],
    upvotes: 25,
    downvotes: 0,
    upvotedBy: [],
    downvotedBy: [],
    replies: [
        { id: 'reply-3-1', author: mockUser6, text: 'Make sure your break-even analysis is solid. He loves detailed cost structures.', timestamp: '2024-05-14T10:00:00Z', upvotes: 10, upvotedBy: [], isVerified: false, parentId: null }
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
    details: "I missed the lecture on 'Intercultural Communication'. Does anyone have the slides from Dr. Mahalingam?",
    status: ResourceRequestStatus.Open,
  },
  {
    id: 'req-2',
    requester: mockUser5,
    timestamp: '2024-05-11T18:30:00Z',
    courseCode: 'BGMT2033',
    title: 'Mathematics II Practice Problems',
    details: "Looking for extra practice problems for multiple integrals. The textbook questions are a bit limited.",
    status: ResourceRequestStatus.Open,
  },
  {
    id: 'req-3',
    requester: mockUser2,
    timestamp: '2024-04-20T09:00:00Z',
    courseCode: 'BCCS2093',
    title: 'Compiler Analysis 2022 Final',
    details: 'Looking for the final exam paper from 2022 for practice.',
    status: ResourceRequestStatus.Fulfilled,
    fulfillment: {
        fulfiller: mockUser,
        resourceId: 'res-3', 
        timestamp: '2024-04-22T14:00:00Z',
    }
  },
  {
    id: 'req-4',
    requester: mockUser3,
    timestamp: '2024-05-15T14:20:00Z',
    courseCode: 'BCCS2033',
    title: 'Industrial Workshop Sample Report',
    details: 'Has anyone uploaded a sample final report for the Industrial Workshop? I need to check the expected format.',
    status: ResourceRequestStatus.Open,
  }
];


export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    recipientId: 'user-1',
    type: NotificationType.Subscription,
    message: "A new resource for 'V NITTIYA', who you follow, was uploaded: 'Industrial Workshop Final Report Guidelines'",
    resourceId: 'res-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    isRead: false,
  },
  {
    id: 'notif-2',
    recipientId: 'user-1',
    type: NotificationType.Subscription,
    message: "Ari uploaded 'Thermodynamics Cheat Sheet'",
    resourceId: 'res-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    isRead: true,
  },
   {
    id: 'notif-3',
    recipientId: 'user-1',
    type: NotificationType.NewResource,
    message: "Adema uploaded 'Compiler Analysis Midterm 2024'",
    resourceId: 'res-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    isRead: false,
  },
  {
    id: 'notif-4',
    recipientId: 'user-1',
    type: NotificationType.NewMessage,
    message: "Adema sent you a message.",
    conversationId: 'convo-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 mins ago
    isRead: false,
  },
  {
    id: 'notif-5',
    recipientId: 'user-1',
    type: NotificationType.NewReply,
    message: "Ari replied to your post about A* Search.",
    forumPostId: 'post-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    isRead: false,
  }
];

export const mockConversations: Conversation[] = [
  {
    id: 'convo-1',
    participants: ['user-1', 'user-2'],
    lastMessageTimestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(), // 3 mins ago
  },
  {
    id: 'convo-2',
    participants: ['user-1', 'user-4'],
    lastMessageTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(), // 25 hours ago
  },
];

export const mockDirectMessages: DirectMessage[] = [
  {
    id: 'msg-1',
    conversationId: 'convo-1',
    senderId: 'user-2',
    recipientId: 'user-1',
    text: 'Hey! Did you see the new AI notes?',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: MessageStatus.Read,
    isDeleted: false
  },
  {
    id: 'msg-2',
    conversationId: 'convo-1',
    senderId: 'user-1',
    recipientId: 'user-2',
    text: 'Yeah, I just downloaded them. Thanks!',
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    status: MessageStatus.Read,
    isDeleted: false
  },
  {
    id: 'msg-3',
    conversationId: 'convo-1',
    senderId: 'user-2',
    recipientId: 'user-1',
    text: 'No problem!',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    status: MessageStatus.Delivered,
    isDeleted: false
  },
  {
    id: 'msg-4',
    conversationId: 'convo-2',
    senderId: 'user-4',
    recipientId: 'user-1',
    text: 'Do you have the slides for Professional Communication?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
    status: MessageStatus.Read,
    isDeleted: false
  },
];
