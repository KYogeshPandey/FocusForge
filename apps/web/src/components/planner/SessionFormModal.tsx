import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateStudySessionInputSchema,
  type CreateStudySessionInput,
  type StudySession,
} from '@focusforge/shared';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useCreateStudySession, useUpdateStudySession } from '../../hooks/useStudySessions';
import { useTasks } from '../../hooks/useTasks';
import { useToastStore } from '../../stores/useToastStore';
import { getTodayDateString } from '../../utils/dates';

export interface SessionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToEdit?: StudySession | null;
  defaultDate?: string;
}

export function SessionFormModal({
  isOpen,
  onClose,
  sessionToEdit,
  defaultDate,
}: SessionFormModalProps) {
  const isEditing = Boolean(sessionToEdit);
  const createMutation = useCreateStudySession();
  const updateMutation = useUpdateStudySession();
  const { data: tasks = [] } = useTasks();
  const { addToast } = useToastStore();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudySessionInput>({
    resolver: zodResolver(CreateStudySessionInputSchema),
    defaultValues: {
      title: '',
      subject: 'Computer Science',
      date: defaultDate || getTodayDateString(),
      startTime: '14:00',
      durationMinutes: 45,
      taskId: null,
      status: 'scheduled',
      notes: '',
    },
  });

  const selectedTaskId = watch('taskId');

  // Auto-fill title & subject if a task is linked
  useEffect(() => {
    if (selectedTaskId) {
      const task = tasks.find((t) => t.id === selectedTaskId);
      if (task) {
        setValue('title', `Study: ${task.title}`);
        setValue('subject', task.subject);
        if (task.estimatedMinutes) {
          setValue('durationMinutes', task.estimatedMinutes);
        }
      }
    }
  }, [selectedTaskId, tasks, setValue]);

  useEffect(() => {
    if (sessionToEdit) {
      reset({
        title: sessionToEdit.title,
        subject: sessionToEdit.subject,
        date: sessionToEdit.date,
        startTime: sessionToEdit.startTime,
        durationMinutes: sessionToEdit.durationMinutes,
        taskId: sessionToEdit.taskId || null,
        status: sessionToEdit.status,
        notes: sessionToEdit.notes || '',
      });
    } else {
      reset({
        title: '',
        subject: 'Computer Science',
        date: defaultDate || getTodayDateString(),
        startTime: '14:00',
        durationMinutes: 45,
        taskId: null,
        status: 'scheduled',
        notes: '',
      });
    }
  }, [sessionToEdit, isOpen, defaultDate, reset]);

  const onSubmit = async (data: CreateStudySessionInput) => {
    try {
      const payload: CreateStudySessionInput = {
        ...data,
        durationMinutes: Number(data.durationMinutes),
        taskId: data.taskId || null,
      };

      if (isEditing && sessionToEdit) {
        await updateMutation.mutateAsync({ id: sessionToEdit.id, patch: payload });
        addToast({
          type: 'success',
          title: 'Session updated',
          message: `"${data.title}" updated.`,
        });
      } else {
        await createMutation.mutateAsync(payload);
        addToast({
          type: 'success',
          title: 'Session scheduled',
          message: `"${data.title}" added to your calendar.`,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Error saving session',
        message: 'Please review your inputs.',
      });
    }
  };

  const incompleteTasks = tasks.filter((t) => t.status !== 'done');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Planned Session' : 'Schedule Study Session'}
      description="Plan dedicated focus blocks for your calendar."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        {/* Optional Link Task */}
        {incompleteTasks.length > 0 && !isEditing && (
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Link to Existing Task (Optional)
            </label>
            <select
              className="w-full h-10 px-3 text-sm bg-surface-2 text-text border border-border rounded-input"
              {...register('taskId')}
            >
              <option value="">-- No linked task --</option>
              {incompleteTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.subject})
                </option>
              ))}
            </select>
          </div>
        )}

        <Input
          label="Session Title"
          required
          placeholder="e.g. Distributed Systems Lab Preparation"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Subject"
            required
            placeholder="e.g. Computer Science"
            error={errors.subject?.message}
            {...register('subject')}
          />

          <Input
            type="date"
            label="Date"
            required
            error={errors.date?.message}
            {...register('date')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="time"
            label="Start Time (HH:MM)"
            required
            error={errors.startTime?.message}
            {...register('startTime')}
          />

          <Input
            type="number"
            label="Duration (minutes)"
            min={5}
            max={480}
            required
            error={errors.durationMinutes?.message}
            {...register('durationMinutes', { valueAsNumber: true })}
          />
        </div>

        <Textarea
          label="Notes / Objectives (Optional)"
          placeholder="What do you plan to achieve during this study session?"
          rows={2}
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Schedule Session'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
