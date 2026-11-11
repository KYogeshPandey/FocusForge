import type { FilterQuery } from 'mongoose';
import { Task, type ITask } from '../models/Task.js';
import { AppError } from '../utils/AppError.js';
import type { CreateTaskInput, UpdateTaskInput } from '@focusforge/shared';

export interface ListTasksOptions {
  status?: string;
  priority?: string;
  subject?: string;
  search?: string;
  from?: string;
  to?: string;
  sortBy?: 'dueDateAsc' | 'dueDateDesc' | 'priorityDesc' | 'createdAtDesc';
  page?: number;
  limit?: number;
}

export class TaskService {
  async list(userId: string, options: ListTasksOptions = {}) {
    const query: FilterQuery<ITask> = { userId };

    if (options.status && options.status !== 'all') {
      query.status = options.status;
    }

    if (options.priority && options.priority !== 'all') {
      query.priority = options.priority;
    }

    if (options.subject) {
      query.subject = options.subject;
    }

    if (options.search) {
      query.title = { $regex: options.search, $options: 'i' };
    }

    if (options.from || options.to) {
      query.dueDate = {};
      if (options.from) query.dueDate.$gte = options.from;
      if (options.to) query.dueDate.$lte = options.to;
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (options.sortBy === 'dueDateAsc') sort = { dueDate: 1, createdAt: -1 };
    else if (options.sortBy === 'dueDateDesc') sort = { dueDate: -1, createdAt: -1 };
    else if (options.sortBy === 'priorityDesc') sort = { priority: -1, createdAt: -1 };
    else if (options.sortBy === 'createdAtDesc') sort = { createdAt: -1 };

    const [tasks, total] = await Promise.all([
      Task.find(query).sort(sort).skip(skip).limit(limit),
      Task.countDocuments(query),
    ]);

    return {
      items: tasks.map((t) => t.toJSON()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getById(userId: string, taskId: string) {
    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) {
      // 404 to avoid leaking existence of cross-user records
      throw AppError.notFound('Task not found');
    }
    return task.toJSON();
  }

  async create(userId: string, input: CreateTaskInput) {
    const now = new Date().toISOString();
    const task = await Task.create({
      userId,
      title: input.title,
      subject: input.subject,
      priority: input.priority || 'medium',
      status: input.status || 'todo',
      dueDate: input.dueDate || null,
      estimatedMinutes: input.estimatedMinutes || null,
      completedAt: input.status === 'done' ? now : null,
    });
    return task.toJSON();
  }

  async update(userId: string, taskId: string, patch: UpdateTaskInput) {
    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) {
      throw AppError.notFound('Task not found');
    }

    const now = new Date().toISOString();
    if (patch.status !== undefined) {
      if (patch.status === 'done' && task.status !== 'done') {
        task.completedAt = now;
      } else if (patch.status !== 'done' && task.status === 'done') {
        task.completedAt = null;
      }
      task.status = patch.status;
    }

    if (patch.title !== undefined) task.title = patch.title;
    if (patch.subject !== undefined) task.subject = patch.subject;
    if (patch.priority !== undefined) task.priority = patch.priority;
    if (patch.dueDate !== undefined) task.dueDate = patch.dueDate;
    if (patch.estimatedMinutes !== undefined) task.estimatedMinutes = patch.estimatedMinutes;

    await task.save();
    return task.toJSON();
  }

  async delete(userId: string, taskId: string) {
    const task = await Task.findOneAndDelete({ _id: taskId, userId });
    if (!task) {
      throw AppError.notFound('Task not found');
    }
  }
}

export const taskService = new TaskService();
