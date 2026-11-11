import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { Habit } from '../models/Habit.js';
import { HabitCompletion } from '../models/HabitCompletion.js';
import { StudySession } from '../models/StudySession.js';
import { FocusSession } from '../models/FocusSession.js';
import { Goal } from '../models/Goal.js';
import { User } from '../models/User.js';
import type { ImportData } from '@focusforge/shared';

export interface ImportSummary {
  tasksImported: number;
  habitsImported: number;
  habitCompletionsImported: number;
  studySessionsImported: number;
  focusSessionsImported: number;
  goalUpdated: boolean;
  settingsUpdated: boolean;
}

export class ImportService {
  async importData(userId: string, data: ImportData): Promise<ImportSummary> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Check if connected MongoDB deployment is a replica set (required for multi-doc transactions)
    const client = mongoose.connection.getClient() as unknown as {
      topology?: { description?: { setName?: string } };
    };
    const isReplicaSet = Boolean(client?.topology?.description?.setName);

    let session: mongoose.ClientSession | null = null;
    if (isReplicaSet) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      const sessionOpt = session ? { session } : {};

      // Map old client IDs to new MongoDB ObjectIds
      const taskIdMap = new Map<string, mongoose.Types.ObjectId>();
      const habitIdMap = new Map<string, mongoose.Types.ObjectId>();

      // 1. Import Tasks
      let tasksImported = 0;
      if (data.tasks && data.tasks.length > 0) {
        for (const t of data.tasks) {
          const newTaskId = new mongoose.Types.ObjectId();
          if (t.id) {
            taskIdMap.set(t.id, newTaskId);
          }
          const completedAtVal =
            t.completedAt || (t.status === 'done' ? new Date().toISOString() : null);

          await Task.create(
            [
              {
                _id: newTaskId,
                userId: userObjectId,
                title: t.title,
                subject: t.subject,
                priority: t.priority || 'medium',
                status: t.status || 'todo',
                dueDate: t.dueDate || null,
                estimatedMinutes: t.estimatedMinutes || null,
                completedAt: completedAtVal,
              },
            ],
            sessionOpt
          );
          tasksImported++;
        }
      }

      // 2. Import Habits
      let habitsImported = 0;
      if (data.habits && data.habits.length > 0) {
        for (const h of data.habits) {
          const newHabitId = new mongoose.Types.ObjectId();
          if (h.id) {
            habitIdMap.set(h.id, newHabitId);
          }
          await Habit.create(
            [
              {
                _id: newHabitId,
                userId: userObjectId,
                title: h.title,
                category: h.category,
                frequency: h.frequency || 'daily',
                targetPerDay: h.targetPerDay || 1,
                color: h.color || '#8B5CF6',
                active: h.active !== undefined ? h.active : true,
              },
            ],
            sessionOpt
          );
          habitsImported++;
        }
      }

      // 3. Import Habit Completions
      let habitCompletionsImported = 0;
      if (data.habitCompletions && data.habitCompletions.length > 0) {
        for (const c of data.habitCompletions) {
          const resolvedHabitId =
            habitIdMap.get(c.habitId) ||
            (mongoose.Types.ObjectId.isValid(c.habitId)
              ? new mongoose.Types.ObjectId(c.habitId)
              : null);

          if (resolvedHabitId) {
            await HabitCompletion.findOneAndUpdate(
              { userId: userObjectId, habitId: resolvedHabitId, date: c.date },
              { $set: { completed: c.completed } },
              {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                ...sessionOpt,
              }
            );
            habitCompletionsImported++;
          }
        }
      }

      // 4. Import Planned Study Sessions
      let studySessionsImported = 0;
      if (data.studySessions && data.studySessions.length > 0) {
        for (const s of data.studySessions) {
          let resolvedTaskId: mongoose.Types.ObjectId | null = null;
          if (s.taskId) {
            resolvedTaskId =
              taskIdMap.get(s.taskId) ||
              (mongoose.Types.ObjectId.isValid(s.taskId)
                ? new mongoose.Types.ObjectId(s.taskId)
                : null);
          }

          await StudySession.create(
            [
              {
                userId: userObjectId,
                title: s.title,
                subject: s.subject,
                date: s.date,
                startTime: s.startTime,
                durationMinutes: s.durationMinutes,
                taskId: resolvedTaskId,
                status: s.status || 'scheduled',
                notes: s.notes,
              },
            ],
            sessionOpt
          );
          studySessionsImported++;
        }
      }

      // 5. Import Focus Sessions
      let focusSessionsImported = 0;
      if (data.focusSessions && data.focusSessions.length > 0) {
        for (const f of data.focusSessions) {
          let resolvedTaskId: mongoose.Types.ObjectId | null = null;
          if (f.taskId) {
            resolvedTaskId =
              taskIdMap.get(f.taskId) ||
              (mongoose.Types.ObjectId.isValid(f.taskId)
                ? new mongoose.Types.ObjectId(f.taskId)
                : null);
          }

          await FocusSession.create(
            [
              {
                userId: userObjectId,
                title: f.title,
                subject: f.subject,
                durationMinutes: f.durationMinutes,
                startedAt: f.startedAt,
                endedAt: f.endedAt,
                mode: f.mode || 'focus',
                taskId: resolvedTaskId,
              },
            ],
            sessionOpt
          );
          focusSessionsImported++;
        }
      }

      // 6. Update Goal if provided
      let goalUpdated = false;
      if (data.goal) {
        await Goal.findOneAndUpdate(
          { userId: userObjectId },
          { $set: data.goal },
          { upsert: true, ...sessionOpt }
        );
        goalUpdated = true;
      }

      // 7. Update User Settings/Preferences if provided
      let settingsUpdated = false;
      if (data.settings) {
        const user = await User.findById(userObjectId);
        if (user) {
          user.preferences = {
            ...user.preferences,
            ...data.settings,
          };
          await user.save(sessionOpt);
          settingsUpdated = true;
        }
      }

      if (session) {
        await session.commitTransaction();
      }

      return {
        tasksImported,
        habitsImported,
        habitCompletionsImported,
        studySessionsImported,
        focusSessionsImported,
        goalUpdated,
        settingsUpdated,
      };
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }
}

export const importService = new ImportService();
