import { useState, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from 'lucide-react';
import type { StudySession } from '@focusforge/shared';
import { useStudySessions } from '../hooks/useStudySessions';
import { useSettings } from '../hooks/useSettings';
import { getDaysOfWeek } from '../utils/dates';
import { DayAgenda } from '../components/planner/DayAgenda';
import { WeekCalendar } from '../components/planner/WeekCalendar';
import { SessionFormModal } from '../components/planner/SessionFormModal';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

export default function StudyPlannerPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<StudySession | null>(null);

  const { data: settings } = useSettings();
  const weekStartsOnMonday = settings?.weekStartDay !== 'sunday';

  const { data: allSessions = [], isLoading } = useStudySessions();

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Days in current selected week
  const weekDays = useMemo(() => {
    return getDaysOfWeek(selectedDate, weekStartsOnMonday);
  }, [selectedDate, weekStartsOnMonday]);

  // Filter sessions for selected day (for Day view)
  const daySessions = useMemo(() => {
    return allSessions.filter((s) => s.date === selectedDateStr);
  }, [allSessions, selectedDateStr]);

  const handlePrev = () => {
    setSelectedDate((curr) => (viewMode === 'day' ? subDays(curr, 1) : subDays(curr, 7)));
  };

  const handleNext = () => {
    setSelectedDate((curr) => (viewMode === 'day' ? addDays(curr, 1) : addDays(curr, 7)));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleAddSession = () => {
    setSessionToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditSession = (session: StudySession) => {
    setSessionToEdit(session);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Study Planner
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Schedule dedicated focus blocks and manage your study calendar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Day / Week Switcher */}
          <div className="inline-flex p-1 bg-surface-2 border border-border rounded-button text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-button transition-colors ${
                viewMode === 'day'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Day View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-button transition-colors ${
                viewMode === 'week'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Week View
            </button>
          </div>

          <Button onClick={handleAddSession} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            <span>Schedule</span>
          </Button>
        </div>
      </div>

      {/* Date Navigation Toolbar */}
      <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-card">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleToday}>
            Today
          </Button>
          <div className="flex items-center">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-sm font-semibold text-text">
          {viewMode === 'day'
            ? format(selectedDate, 'EEEE, MMMM d, yyyy')
            : `${format(weekDays[0] || selectedDate, 'MMM d')} – ${format(
                weekDays[weekDays.length - 1] || selectedDate,
                'MMM d, yyyy'
              )}`}
        </div>
      </div>

      {/* Main View Area */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      ) : viewMode === 'day' ? (
        <DayAgenda
          dateStr={selectedDateStr}
          sessions={daySessions}
          onAddSession={handleAddSession}
          onEditSession={handleEditSession}
        />
      ) : (
        <WeekCalendar
          days={weekDays}
          selectedDate={selectedDate}
          onSelectDate={(d) => {
            setSelectedDate(d);
            setViewMode('day'); // clicking a day jumps into that day's agenda
          }}
          sessions={allSessions}
          onEditSession={handleEditSession}
        />
      )}

      {/* Session Modal */}
      <SessionFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sessionToEdit={sessionToEdit}
        defaultDate={selectedDateStr}
      />
    </div>
  );
}
