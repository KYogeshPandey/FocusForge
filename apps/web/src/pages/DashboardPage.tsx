import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  Clock,
  Flame,
  Target,
  Plus,
  Play,
  ArrowRight,
  Check,
} from 'lucide-react';
import { isSameDay, parseISO } from 'date-fns';
import { useTasks, useToggleTask } from '../hooks/useTasks';
import { useFocusSessions } from '../hooks/useFocusSessions';
import { useHabits, useHabitCompletions, useToggleHabitCompletion } from '../hooks/useHabits';
import { useStudySessions } from '../hooks/useStudySessions';
import { useGoal, useUpdateGoal } from '../hooks/useGoals';
import { useSettings } from '../hooks/useSettings';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StudyTimeBarChart } from '../components/charts/StudyTimeBarChart';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { formatDuration, getTodayDateString, isDateToday, isOverdue } from '../utils/dates';
import { calculateOverallStreak, calculateHabitStreak } from '../utils/streaks';
import { calculateWeeklyGoalProgress } from '../utils/goals';
import { aggregateStudyMinutesByDay } from '../utils/analytics';
import { PriorityBadge } from '../components/ui/Badge';
import { cn } from '../utils/cn';

export default function DashboardPage() {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [newGoalMinutes, setNewGoalMinutes] = useState(900);

  const { data: tasks = [] } = useTasks();
  const toggleTask = useToggleTask();

  const { data: focusSessions = [] } = useFocusSessions();
  const { data: habits = [] } = useHabits();
  const { data: completions = [] } = useHabitCompletions();
  const toggleHabit = useToggleHabitCompletion();

  const { data: studySessions = [] } = useStudySessions();
  const { data: goal } = useGoal();
  const updateGoal = useUpdateGoal();
  const { data: settings } = useSettings();

  const todayStr = getTodayDateString();
  const userName = settings?.userName || 'Alex';

  // Greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // 1. Tasks due today (or overdue and not done)
  const todayTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === 'done') return false;
      if (!t.dueDate) return false;
      return isDateToday(t.dueDate) || isOverdue(t.dueDate, false);
    });
  }, [tasks]);

  // 2. Focus time today (from completed focus sessions)
  const todayFocusMinutes = useMemo(() => {
    return focusSessions
      .filter((s) => s.mode === 'focus' && isDateToday(s.startedAt.slice(0, 10)))
      .reduce((acc, s) => acc + s.durationMinutes, 0);
  }, [focusSessions]);

  // 3. Current streak (global activity)
  const streakMetrics = useMemo(() => {
    const activeDates = new Set<string>();
    focusSessions.forEach((s) => {
      if (s.mode === 'focus') activeDates.add(s.startedAt.slice(0, 10));
    });
    completions.forEach((c) => {
      if (c.completed) activeDates.add(c.date);
    });
    return calculateOverallStreak(activeDates);
  }, [focusSessions, completions]);

  // 4. Weekly Goal Progress
  const goalTargetMinutes = goal?.targetMinutesWeekly || 900;
  const goalProgress = useMemo(() => {
    return calculateWeeklyGoalProgress(
      goalTargetMinutes,
      focusSessions,
      new Date(),
      settings?.weekStartDay !== 'sunday'
    );
  }, [goalTargetMinutes, focusSessions, settings?.weekStartDay]);

  // Past 7 Days Study Chart Data
  const weeklyStudyData = useMemo(() => {
    return aggregateStudyMinutesByDay(focusSessions, 7);
  }, [focusSessions]);

  // Today's Habits checklist
  const todayHabits = useMemo(() => {
    const todayComps = new Set(
      completions.filter((c) => c.date === todayStr && c.completed).map((c) => c.habitId)
    );
    return habits.map((h) => ({
      ...h,
      isCompletedToday: todayComps.has(h.id),
      streak: calculateHabitStreak(h.id, completions),
    }));
  }, [habits, completions, todayStr]);

  // Upcoming Planned Sessions (for today and tomorrow)
  const upcomingPlannedSessions = useMemo(() => {
    const todayDate = new Date();
    return studySessions
      .filter((s) => {
        const d = parseISO(s.date);
        return isSameDay(d, todayDate) || d > todayDate;
      })
      .slice(0, 3);
  }, [studySessions]);

  const handleSaveGoal = async () => {
    if (newGoalMinutes >= 30) {
      await updateGoal.mutateAsync({ targetMinutesWeekly: newGoalMinutes });
      setIsGoalModalOpen(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            {greeting}, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Here is your daily study roadmap and consistency overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/timer">
            <Button variant="secondary" size="md" className="gap-2">
              <Play className="w-4 h-4 fill-current text-primary" />
              <span>Quick Focus</span>
            </Button>
          </Link>
          <Button onClick={() => setIsTaskModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </Button>
        </div>
      </div>

      {/* Row 1: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tasks Due Today"
          value={todayTasks.length}
          icon={<CheckSquare className="w-5 h-5" />}
          subtitle={
            todayTasks.length === 0 ? 'All caught up' : `${todayTasks.length} priority items`
          }
          iconBgColor="bg-secondary/15 text-secondary"
        />

        <StatCard
          label="Focus Time Today"
          value={formatDuration(todayFocusMinutes)}
          icon={<Clock className="w-5 h-5" />}
          subtitle="Automated session logs"
          iconBgColor="bg-primary-soft text-primary"
        />

        <StatCard
          label="Current Streak"
          value={`${streakMetrics.currentStreak} Days`}
          icon={<Flame className="w-5 h-5 fill-current" />}
          subtitle={`Best: ${streakMetrics.bestStreak} days`}
          iconBgColor="bg-warning/15 text-warning"
        />

        <StatCard
          label="Weekly Goal"
          value={`${goalProgress.percentage}%`}
          icon={<Target className="w-5 h-5" />}
          subtitle={`${formatDuration(goalProgress.completedMinutes)} of ${formatDuration(
            goalProgress.targetMinutes
          )}`}
          iconBgColor="bg-success/15 text-success"
        />
      </div>

      {/* Row 2: Study Time Bar Chart (8 cols) + Today's Tasks (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Chart */}
        <div className="lg:col-span-8">
          <StudyTimeBarChart
            data={weeklyStudyData}
            title="Weekly Study Activity"
            insight={`You logged ${formatDuration(goalProgress.completedMinutes)} of focused work this week.`}
          />
        </div>

        {/* Today's Tasks */}
        <div className="lg:col-span-4">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader>
              <div>
                <CardTitle>Today's Tasks</CardTitle>
                <div className="text-xs text-text-muted mt-0.5">
                  {todayTasks.length} pending assignments
                </div>
              </div>
              <Link
                to="/tasks"
                className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>

            <div className="space-y-2 flex-1 my-2 overflow-y-auto max-h-72">
              {todayTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted">
                  <CheckSquare className="w-8 h-8 mx-auto text-success/60 mb-2" />
                  No tasks due today. Great job!
                </div>
              ) : (
                todayTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 p-2.5 bg-surface-2/60 rounded-button hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleTask.mutate(task.id)}
                        aria-label={`Complete ${task.title}`}
                        className="w-4 h-4 rounded-[4px] border border-border bg-surface flex items-center justify-center shrink-0 hover:border-primary text-transparent hover:text-text-muted"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>
                      <span className="text-xs font-medium text-text truncate">
                        {task.title}
                      </span>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </div>
                ))
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsTaskModalOpen(true)}
              className="w-full mt-3 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Quick Task</span>
            </Button>
          </Card>
        </div>
      </div>

      {/* Row 3: Goal Progress + Today's Habits + Upcoming Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weekly Goal Progress */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div>
              <CardTitle>Weekly Target</CardTitle>
              <div className="text-xs text-text-muted mt-0.5">
                {goalProgress.percentage}% achieved
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewGoalMinutes(goalTargetMinutes);
                setIsGoalModalOpen(true);
              }}
              className="text-xs text-primary hover:text-primary-hover font-semibold"
            >
              Edit Target
            </button>
          </CardHeader>

          <div className="space-y-3 my-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-text">
                {formatDuration(goalProgress.completedMinutes)}
              </span>
              <span className="text-text-muted">Target: {formatDuration(goalProgress.targetMinutes)}</span>
            </div>

            <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-normal"
                style={{ width: `${goalProgress.percentage}%` }}
              />
            </div>

            <p className="text-xs text-text-muted">
              {goalProgress.remainingMinutes > 0
                ? `${formatDuration(goalProgress.remainingMinutes)} remaining to reach your weekly study goal.`
                : '🎉 Weekly study target accomplished! Keep it up!'}
            </p>
          </div>

          <Link to="/timer" className="w-full mt-4">
            <Button variant="secondary" size="sm" className="w-full gap-2">
              <Play className="w-3.5 h-3.5 fill-current text-primary" />
              <span>Start Study Session</span>
            </Button>
          </Link>
        </Card>

        {/* Today's Habits */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div>
              <CardTitle>Today's Habits</CardTitle>
              <div className="text-xs text-text-muted mt-0.5">
                {todayHabits.filter((h) => h.isCompletedToday).length} of {todayHabits.length} checked
              </div>
            </div>
            <Link
              to="/habits"
              className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1"
            >
              Tracker <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>

          <div className="space-y-2 my-2 overflow-y-auto max-h-52">
            {todayHabits.map((habit) => (
              <div
                key={habit.id}
                onClick={() =>
                  toggleHabit.mutate({ habitId: habit.id, date: todayStr })
                }
                className={cn(
                  'flex items-center justify-between p-2 rounded-button border transition-all cursor-pointer select-none',
                  habit.isCompletedToday
                    ? 'bg-success/10 border-success/30 text-text'
                    : 'bg-surface-2/60 border-border hover:border-text-subtle'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                      habit.isCompletedToday
                        ? 'bg-success border-success text-white'
                        : 'border-border bg-surface'
                    )}
                  >
                    {habit.isCompletedToday && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium truncate',
                      habit.isCompletedToday && 'line-through text-text-muted'
                    )}
                  >
                    {habit.title}
                  </span>
                </div>
                <span className="text-[10px] text-warning font-bold shrink-0 ml-2">
                  🔥 {habit.streak.currentStreak}d
                </span>
              </div>
            ))}
          </div>

          <Link to="/habits" className="w-full mt-4">
            <Button variant="secondary" size="sm" className="w-full">
              Manage Habits
            </Button>
          </Link>
        </Card>

        {/* Upcoming Sessions */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div>
              <CardTitle>Upcoming Sessions</CardTitle>
              <div className="text-xs text-text-muted mt-0.5">Scheduled focus blocks</div>
            </div>
            <Link
              to="/planner"
              className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1"
            >
              Planner <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>

          <div className="space-y-2 my-2 overflow-y-auto max-h-52">
            {upcomingPlannedSessions.length === 0 ? (
              <div className="text-center py-6 text-xs text-text-muted">
                No sessions planned yet.
              </div>
            ) : (
              upcomingPlannedSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-2.5 rounded-button bg-surface-2/60 border border-border"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-text">
                    <span className="truncate">{session.title}</span>
                    <span className="text-[11px] text-primary shrink-0 ml-2 font-bold">
                      {session.startTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted mt-1">
                    <span>{session.subject}</span>
                    <span>{formatDuration(session.durationMinutes)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link to="/planner" className="w-full mt-4">
            <Button variant="secondary" size="sm" className="w-full">
              Open Calendar
            </Button>
          </Link>
        </Card>
      </div>

      {/* Task Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />

      {/* Goal Edit Modal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        title="Edit Weekly Study Target"
        description="Set your target study minutes for the week. Progress will be tracked from completed focus timer sessions."
      >
        <div className="space-y-4 pt-2">
          <Input
            type="number"
            label="Weekly Target (Minutes)"
            value={newGoalMinutes}
            onChange={(e) => setNewGoalMinutes(Number(e.target.value))}
            min={30}
            max={6000}
            step={30}
            hint={`Equivalent to ${(newGoalMinutes / 60).toFixed(1)} hours per week`}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsGoalModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveGoal}>
              Update Goal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
