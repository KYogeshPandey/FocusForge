import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateHabitInputSchema,
  type CreateHabitInput,
  type Habit,
} from '@focusforge/shared';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useCreateHabit, useUpdateHabit } from '../../hooks/useHabits';
import { useToastStore } from '../../stores/useToastStore';

export interface HabitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitToEdit?: Habit | null;
}

const HABIT_COLORS = [
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#14B8A6', // Teal
];

export function HabitFormModal({ isOpen, onClose, habitToEdit }: HabitFormModalProps) {
  const isEditing = Boolean(habitToEdit);
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const { addToast } = useToastStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateHabitInput>({
    resolver: zodResolver(CreateHabitInputSchema),
    defaultValues: {
      title: '',
      category: 'Coding',
      frequency: 'daily',
      targetPerDay: 1,
      color: '#8B5CF6',
      active: true,
    },
  });

  const selectedColor = watch('color');

  useEffect(() => {
    if (habitToEdit) {
      reset({
        title: habitToEdit.title,
        category: habitToEdit.category,
        frequency: habitToEdit.frequency,
        targetPerDay: habitToEdit.targetPerDay,
        color: habitToEdit.color,
        active: habitToEdit.active,
      });
    } else {
      reset({
        title: '',
        category: 'Coding',
        frequency: 'daily',
        targetPerDay: 1,
        color: '#8B5CF6',
        active: true,
      });
    }
  }, [habitToEdit, isOpen, reset]);

  const onSubmit = async (data: CreateHabitInput) => {
    try {
      if (isEditing && habitToEdit) {
        await updateHabit.mutateAsync({ id: habitToEdit.id, patch: data });
        addToast({
          type: 'success',
          title: 'Habit updated',
          message: `"${data.title}" updated successfully.`,
        });
      } else {
        await createHabit.mutateAsync(data);
        addToast({
          type: 'success',
          title: 'Habit created',
          message: `"${data.title}" added to your habits.`,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Error saving habit',
        message: 'Please review your inputs.',
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Habit' : 'Create New Habit'}
      description={
        isEditing
          ? 'Modify your daily routine target or category.'
          : 'Establish a new daily productivity habit to track streaks.'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <Input
          label="Habit Name"
          required
          placeholder="e.g. Read 20 pages of textbook"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Category"
            required
            placeholder="e.g. Academics, Coding, Health"
            error={errors.category?.message}
            {...register('category')}
          />

          <Select
            label="Frequency"
            options={[
              { label: 'Every Day', value: 'daily' },
              { label: 'Weekdays Only', value: 'weekdays' },
              { label: 'Weekends Only', value: 'weekends' },
            ]}
            error={errors.frequency?.message}
            {...register('frequency')}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text mb-2">Accent Color</label>
          <div className="flex items-center gap-3">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue('color', c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  selectedColor === c ? 'border-white scale-110 shadow-sm' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Habit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
