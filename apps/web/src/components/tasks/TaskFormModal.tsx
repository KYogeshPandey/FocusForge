import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateTaskInputSchema,
  type CreateTaskInput,
  type Task,
} from '@focusforge/shared';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useCreateTask, useUpdateTask } from '../../hooks/useTasks';
import { useToastStore } from '../../stores/useToastStore';

export interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
}

const COMMON_SUBJECTS = [
  'Computer Science',
  'Mathematics',
  'Algorithms',
  'Physics',
  'General',
  'Reading',
  'Career',
];

export function TaskFormModal({ isOpen, onClose, taskToEdit }: TaskFormModalProps) {
  const isEditing = Boolean(taskToEdit);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { addToast } = useToastStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskInputSchema),
    defaultValues: {
      title: '',
      subject: 'Computer Science',
      priority: 'medium',
      status: 'todo',
      dueDate: '',
      estimatedMinutes: null,
    },
  });

  useEffect(() => {
    if (taskToEdit) {
      reset({
        title: taskToEdit.title,
        subject: taskToEdit.subject,
        priority: taskToEdit.priority,
        status: taskToEdit.status,
        dueDate: taskToEdit.dueDate || '',
        estimatedMinutes: taskToEdit.estimatedMinutes ?? null,
      });
    } else {
      reset({
        title: '',
        subject: 'Computer Science',
        priority: 'medium',
        status: 'todo',
        dueDate: '',
        estimatedMinutes: null,
      });
    }
  }, [taskToEdit, isOpen, reset]);

  const onSubmit = async (data: CreateTaskInput) => {
    try {
      const payload: CreateTaskInput = {
        ...data,
        dueDate: data.dueDate && data.dueDate.trim() !== '' ? data.dueDate : null,
        estimatedMinutes: data.estimatedMinutes ? Number(data.estimatedMinutes) : null,
      };

      if (isEditing && taskToEdit) {
        await updateTask.mutateAsync({ id: taskToEdit.id, patch: payload });
        addToast({
          type: 'success',
          title: 'Task updated',
          message: `"${data.title}" has been saved.`,
        });
      } else {
        await createTask.mutateAsync(payload);
        addToast({
          type: 'success',
          title: 'Task created',
          message: `"${data.title}" added to your task list.`,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Error saving task',
        message: 'Please check your inputs and try again.',
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Task' : 'Add New Task'}
      description={
        isEditing
          ? 'Update the details and priority of your task.'
          : 'Create a new study task or assignment.'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <Input
          label="Task Title"
          required
          placeholder="e.g. Solve dynamic programming problem set"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              Subject <span className="text-danger">*</span>
            </label>
            <input
              list="subject-options"
              className="w-full h-10 px-3 py-2 text-sm bg-surface-2 text-text border border-border rounded-input placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="e.g. Computer Science"
              {...register('subject')}
            />
            <datalist id="subject-options">
              {COMMON_SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {errors.subject && (
              <p className="text-xs text-danger mt-1 font-medium">{errors.subject.message}</p>
            )}
          </div>

          <Select
            label="Priority"
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
            ]}
            error={errors.priority?.message}
            {...register('priority')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Status"
            options={[
              { label: 'To Do', value: 'todo' },
              { label: 'In Progress', value: 'in-progress' },
              { label: 'Completed', value: 'done' },
            ]}
            error={errors.status?.message}
            {...register('status')}
          />

          <Input
            type="date"
            label="Due Date"
            error={errors.dueDate?.message}
            {...register('dueDate')}
          />

          <Input
            type="number"
            label="Est. Minutes"
            placeholder="e.g. 45"
            min={1}
            max={720}
            error={errors.estimatedMinutes?.message}
            {...register('estimatedMinutes', { valueAsNumber: true })}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
