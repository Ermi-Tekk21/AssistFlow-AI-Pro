import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import {
  CheckCircle,
  Circle,
  Trash2,
  Plus,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { formatDateTime } from "../lib/utils";

export const TasksView: React.FC = () => {
  const {
    tasks = [],
    tasksLoading = false,
    taskFilter = "all",
    setTaskFilter,
    fetchTasks,
    createTask,
    completeTask,
    deleteTask,
  } = useStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newDueAt, setNewDueAt] = useState("");

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const dueIso = newDueAt ? new Date(newDueAt).toISOString() : null;
    await createTask(newTitle.trim(), newPriority, dueIso);
    setNewTitle("");
    setNewDueAt("");
    setIsAdding(false);
  };

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Filters */}
        <div className="flex items-center space-x-1.5 bg-white p-1 rounded-lg border border-slate-200">
          {(["all", "pending", "completed"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTaskFilter(filter)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                taskFilter === filter
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <Button
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          variant={isAdding ? "outline" : "default"}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {isAdding ? "Cancel" : "Add Task"}
        </Button>
      </div>

      {/* New Task Inline Form */}
      {isAdding && (
        <Card className="border-slate-300 shadow-sm">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-semibold">New Task</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <form onSubmit={handleCreate} className="space-y-3">
              <Input
                placeholder="Task title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xs"
                autoFocus
              />

              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-slate-500 mr-1">Priority:</span>
                  {(["low", "medium", "high"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`text-xs px-2.5 py-1 rounded border capitalize ${
                        newPriority === p
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-1 ml-auto">
                  <span className="text-xs text-slate-500 mr-1">Due Date:</span>
                  <input
                    type="datetime-local"
                    value={newDueAt}
                    onChange={(e) => setNewDueAt(e.target.value)}
                    className="text-xs px-2 py-1 rounded border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!newTitle.trim()}>
                  Save Task
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Task List Table/Cards */}
      {tasksLoading ? (
        <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span>Loading tasks...</span>
        </div>
      ) : (tasks || []).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-sm font-medium text-slate-800">No tasks found</p>
          <p className="text-xs text-slate-500 mt-1">
            {taskFilter === "all"
              ? "You have not created any tasks yet."
              : `No tasks matching the "${taskFilter}" filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(tasks || []).map((task) => {
            const isCompleted = task.status === "completed";
            const isOverdue =
              !isCompleted && task.dueAt && new Date(task.dueAt).getTime() < Date.now();

            return (
              <div
                key={task.id}
                className={`bg-white border rounded-lg p-3.5 flex items-center justify-between transition-colors shadow-sm ${
                  isCompleted
                    ? "border-slate-200 bg-slate-50/60 opacity-80"
                    : isOverdue
                    ? "border-red-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Left: Complete toggle & title */}
                <div className="flex items-start space-x-3 min-w-0 pr-4">
                  <button
                    onClick={() => !isCompleted && completeTask(task.id)}
                    className="mt-0.5 text-slate-400 hover:text-slate-900 transition-colors shrink-0"
                    disabled={isCompleted}
                    title={isCompleted ? "Completed" : "Click to mark completed"}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        isCompleted ? "line-through text-slate-400" : "text-slate-900"
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Badges, due date & delete */}
                <div className="flex items-center space-x-2 shrink-0">
                  <Badge variant={priorityColor(task.priority)} className="capitalize text-[10px]">
                    {task.priority}
                  </Badge>

                  {task.dueAt && (
                    <div
                      className={`flex items-center text-[11px] font-mono ${
                        isOverdue ? "text-red-600 font-semibold" : "text-slate-500"
                      }`}
                    >
                      {isOverdue ? (
                        <AlertCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 mr-1 text-slate-400" />
                      )}
                      <span>{formatDateTime(task.dueAt)}</span>
                    </div>
                  )}

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
