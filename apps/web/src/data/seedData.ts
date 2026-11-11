import { subDays, format } from 'date-fns';
import type {
  Task,
  Habit,
  HabitCompletion,
  StudySession,
  FocusSession,
  Goal,
  Settings,
} from '@focusforge/shared';

const USER_ID = 'demo-user-101';

export function generateSeedData() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
  const tomorrowStr = format(subDays(today, -1), 'yyyy-MM-dd');
  const threeDaysLaterStr = format(subDays(today, -3), 'yyyy-MM-dd');
  const fiveDaysLaterStr = format(subDays(today, -5), 'yyyy-MM-dd');
  const overdueStr = format(subDays(today, 2), 'yyyy-MM-dd');

  // Tasks
  const tasks: Task[] = [
    {
      id: 'task-1',
      userId: USER_ID,
      title: 'Complete Distributed Systems Raft consensus paper review',
      subject: 'Computer Science',
      priority: 'high',
      status: 'in-progress',
      dueDate: todayStr,
      estimatedMinutes: 60,
      createdAt: subDays(today, 2).toISOString(),
      updatedAt: subDays(today, 1).toISOString(),
    },
    {
      id: 'task-2',
      userId: USER_ID,
      title: 'Solve LeetCode Problem of the Day: Dynamic Programming',
      subject: 'Algorithms',
      priority: 'medium',
      status: 'todo',
      dueDate: todayStr,
      estimatedMinutes: 45,
      createdAt: subDays(today, 1).toISOString(),
      updatedAt: subDays(today, 1).toISOString(),
    },
    {
      id: 'task-3',
      userId: USER_ID,
      title: 'Linear Algebra: Eigenvalues & Matrix Diagonalization problem set',
      subject: 'Mathematics',
      priority: 'high',
      status: 'todo',
      dueDate: overdueStr,
      estimatedMinutes: 90,
      createdAt: subDays(today, 4).toISOString(),
      updatedAt: subDays(today, 3).toISOString(),
    },
    {
      id: 'task-4',
      userId: USER_ID,
      title: 'Database Systems: Write B-Tree indexing query benchmark',
      subject: 'Computer Science',
      priority: 'high',
      status: 'todo',
      dueDate: tomorrowStr,
      estimatedMinutes: 75,
      createdAt: subDays(today, 2).toISOString(),
      updatedAt: subDays(today, 2).toISOString(),
    },
    {
      id: 'task-5',
      userId: USER_ID,
      title: 'Electromagnetism: Maxwell equations derivation & summary notes',
      subject: 'Physics',
      priority: 'medium',
      status: 'todo',
      dueDate: threeDaysLaterStr,
      estimatedMinutes: 60,
      createdAt: subDays(today, 3).toISOString(),
      updatedAt: subDays(today, 3).toISOString(),
    },
    {
      id: 'task-6',
      userId: USER_ID,
      title: 'Operating Systems: Kernel thread synchronization lab report',
      subject: 'Computer Science',
      priority: 'medium',
      status: 'done',
      dueDate: yesterdayStr,
      completedAt: yesterdayStr,
      estimatedMinutes: 120,
      createdAt: subDays(today, 5).toISOString(),
      updatedAt: subDays(today, 1).toISOString(),
    },
    {
      id: 'task-7',
      userId: USER_ID,
      title: 'Read Artificial Intelligence ethics and safety guidelines',
      subject: 'General',
      priority: 'low',
      status: 'done',
      dueDate: overdueStr,
      completedAt: overdueStr,
      estimatedMinutes: 30,
      createdAt: subDays(today, 6).toISOString(),
      updatedAt: subDays(today, 2).toISOString(),
    },
    {
      id: 'task-8',
      userId: USER_ID,
      title: 'Prepare flashcards for Technical Interview system design',
      subject: 'Career',
      priority: 'low',
      status: 'todo',
      dueDate: fiveDaysLaterStr,
      estimatedMinutes: 40,
      createdAt: subDays(today, 1).toISOString(),
      updatedAt: subDays(today, 1).toISOString(),
    },
    {
      id: 'task-9',
      userId: USER_ID,
      title: 'Explore compiler optimization techniques (LLVM IR pass)',
      subject: 'Computer Science',
      priority: 'low',
      status: 'todo',
      dueDate: null,
      estimatedMinutes: 90,
      createdAt: subDays(today, 5).toISOString(),
      updatedAt: subDays(today, 5).toISOString(),
    },
  ];

  // Habits
  const habits: Habit[] = [
    {
      id: 'habit-1',
      userId: USER_ID,
      title: 'Solve 1+ LeetCode or Codeforces problem',
      category: 'Coding',
      frequency: 'daily',
      targetPerDay: 1,
      color: '#8B5CF6',
      active: true,
      createdAt: subDays(today, 20).toISOString(),
      updatedAt: subDays(today, 20).toISOString(),
    },
    {
      id: 'habit-2',
      userId: USER_ID,
      title: 'Deep Focus Study Block (≥ 50 mins)',
      category: 'Academics',
      frequency: 'daily',
      targetPerDay: 1,
      color: '#3B82F6',
      active: true,
      createdAt: subDays(today, 20).toISOString(),
      updatedAt: subDays(today, 20).toISOString(),
    },
    {
      id: 'habit-3',
      userId: USER_ID,
      title: 'Read CS / Science research paper or book chapter',
      category: 'Reading',
      frequency: 'daily',
      targetPerDay: 1,
      color: '#22C55E',
      active: true,
      createdAt: subDays(today, 20).toISOString(),
      updatedAt: subDays(today, 20).toISOString(),
    },
    {
      id: 'habit-4',
      userId: USER_ID,
      title: 'Nightly Review: Plan tomorrow priorities & review goals',
      category: 'Productivity',
      frequency: 'daily',
      targetPerDay: 1,
      color: '#F59E0B',
      active: true,
      createdAt: subDays(today, 20).toISOString(),
      updatedAt: subDays(today, 20).toISOString(),
    },
  ];

  // Habit Completions for past 14 days
  const habitCompletions: HabitCompletion[] = [];
  // Habit 1: completed today, yesterday, and past 5 days (6-day streak)
  for (let i = 0; i < 6; i++) {
    habitCompletions.push({
      id: `comp-h1-${i}`,
      userId: USER_ID,
      habitId: 'habit-1',
      date: format(subDays(today, i), 'yyyy-MM-dd'),
      completed: true,
      createdAt: subDays(today, i).toISOString(),
    });
  }
  // Habit 2: completed yesterday and 4 prior days (5-day streak, pending today)
  for (let i = 1; i <= 5; i++) {
    habitCompletions.push({
      id: `comp-h2-${i}`,
      userId: USER_ID,
      habitId: 'habit-2',
      date: format(subDays(today, i), 'yyyy-MM-dd'),
      completed: true,
      createdAt: subDays(today, i).toISOString(),
    });
  }
  // Habit 3: completed today and alternating days
  [0, 2, 3, 5, 6, 7].forEach((i) => {
    habitCompletions.push({
      id: `comp-h3-${i}`,
      userId: USER_ID,
      habitId: 'habit-3',
      date: format(subDays(today, i), 'yyyy-MM-dd'),
      completed: true,
      createdAt: subDays(today, i).toISOString(),
    });
  });
  // Habit 4: completed today, yesterday, and day before (3-day streak)
  for (let i = 0; i < 3; i++) {
    habitCompletions.push({
      id: `comp-h4-${i}`,
      userId: USER_ID,
      habitId: 'habit-4',
      date: format(subDays(today, i), 'yyyy-MM-dd'),
      completed: true,
      createdAt: subDays(today, i).toISOString(),
    });
  }

  // Planned Study Sessions
  const studySessions: StudySession[] = [
    {
      id: 'session-1',
      userId: USER_ID,
      title: 'Raft Consensus Protocol Deep Dive',
      subject: 'Computer Science',
      date: todayStr,
      startTime: '10:00',
      durationMinutes: 60,
      taskId: 'task-1',
      status: 'completed',
      notes: 'Cover leader election and log replication sections',
      createdAt: subDays(today, 1).toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'session-2',
      userId: USER_ID,
      title: 'LeetCode Medium Graphs & DP',
      subject: 'Algorithms',
      date: todayStr,
      startTime: '14:30',
      durationMinutes: 45,
      taskId: 'task-2',
      status: 'scheduled',
      notes: 'Focus on topological sort patterns',
      createdAt: subDays(today, 1).toISOString(),
      updatedAt: subDays(today, 1).toISOString(),
    },
    {
      id: 'session-3',
      userId: USER_ID,
      title: 'Eigenvalues & Diagonalization Practice',
      subject: 'Mathematics',
      date: todayStr,
      startTime: '16:30',
      durationMinutes: 60,
      taskId: 'task-3',
      status: 'scheduled',
      notes: 'Solve exercises 4.1 to 4.5',
      createdAt: subDays(today, 1).toISOString(),
      updatedAt: subDays(today, 1).toISOString(),
    },
    {
      id: 'session-4',
      userId: USER_ID,
      title: 'B-Tree Database Indexing Benchmark',
      subject: 'Computer Science',
      date: tomorrowStr,
      startTime: '11:00',
      durationMinutes: 90,
      taskId: 'task-4',
      status: 'scheduled',
      notes: '',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'session-5',
      userId: USER_ID,
      title: 'Maxwell Equations & Wave Mechanics',
      subject: 'Physics',
      date: threeDaysLaterStr,
      startTime: '15:00',
      durationMinutes: 60,
      taskId: 'task-5',
      status: 'scheduled',
      notes: '',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  // ~3 weeks of realistic Focus Sessions (for rich charts in Dashboard and Analytics)
  const focusSessions: FocusSession[] = [];
  const subjectsPool = [
    'Computer Science',
    'Mathematics',
    'Algorithms',
    'Physics',
    'General',
  ];

  // Generate ~20-25 focus sessions spread across the past 21 days
  let sessId = 1;

  // Today sessions: 2 completed focus sessions totaling 75 min
  focusSessions.push({
    id: `focus-${sessId++}`,
    userId: USER_ID,
    title: 'Distributed Systems Raft Paper review',
    subject: 'Computer Science',
    durationMinutes: 50,
    startedAt: new Date(today.getTime() - 4 * 3600000).toISOString(),
    endedAt: new Date(today.getTime() - 4 * 3600000 + 50 * 60000).toISOString(),
    mode: 'focus',
    taskId: 'task-1',
    createdAt: new Date(today.getTime() - 4 * 3600000).toISOString(),
  });
  focusSessions.push({
    id: `focus-${sessId++}`,
    userId: USER_ID,
    title: 'Short Break',
    subject: 'General',
    durationMinutes: 5,
    startedAt: new Date(today.getTime() - 3 * 3600000).toISOString(),
    endedAt: new Date(today.getTime() - 3 * 3600000 + 5 * 60000).toISOString(),
    mode: 'short-break',
    taskId: null,
    createdAt: new Date(today.getTime() - 3 * 3600000).toISOString(),
  });
  focusSessions.push({
    id: `focus-${sessId++}`,
    userId: USER_ID,
    title: 'Algorithm Graph Traversal Sprint',
    subject: 'Algorithms',
    durationMinutes: 25,
    startedAt: new Date(today.getTime() - 2 * 3600000).toISOString(),
    endedAt: new Date(today.getTime() - 2 * 3600000 + 25 * 60000).toISOString(),
    mode: 'focus',
    taskId: 'task-2',
    createdAt: new Date(today.getTime() - 2 * 3600000).toISOString(),
  });

  // Past days sessions (days 1 to 20)
  for (let day = 1; day <= 20; day++) {
    const dayDate = subDays(today, day);
    // 1 to 3 sessions per day (skip a couple of rest days)
    if (day === 8 || day === 15) continue; // rest days

    const sessionCount = (day % 3) + 1;
    for (let s = 0; s < sessionCount; s++) {
      const subject = subjectsPool[(day + s) % subjectsPool.length] || 'Computer Science';
      const duration = s === 0 ? 50 : 25;
      const startHour = 9 + s * 3;
      const startTime = new Date(dayDate);
      startTime.setHours(startHour, 15, 0, 0);
      const endTime = new Date(startTime.getTime() + duration * 60000);

      focusSessions.push({
        id: `focus-${sessId++}`,
        userId: USER_ID,
        title: `${subject} Study Sprint`,
        subject,
        durationMinutes: duration,
        startedAt: startTime.toISOString(),
        endedAt: endTime.toISOString(),
        mode: 'focus',
        taskId: null,
        createdAt: startTime.toISOString(),
      });
    }
  }

  // Goal
  const goal: Goal = {
    id: 'goal-1',
    userId: USER_ID,
    targetMinutesWeekly: 900, // 15 hours / week
    targetSessionsWeekly: 18,
    weekStartDate: format(subDays(today, today.getDay() === 0 ? 6 : today.getDay() - 1), 'yyyy-MM-dd'),
    updatedAt: today.toISOString(),
  };

  // Settings
  const settings: Settings = {
    theme: 'dark',
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    soundEnabled: true,
    soundVolume: 70,
    weekStartDay: 'monday',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    demoDataLoaded: true,
    userName: 'Alex Rivera',
  };

  return {
    tasks,
    habits,
    habitCompletions,
    studySessions,
    focusSessions,
    goal,
    settings,
  };
}
