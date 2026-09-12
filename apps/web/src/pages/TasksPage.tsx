import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";
import type { TaskInput } from "@workload/contracts";

export const TasksPage: React.FC = () => {
  const { consent, tasks, addTask, deleteTask } = useWorkload();

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [effortValue, setEffortValue] = useState<number>(4);
  const [effortUnit, setEffortUnit] = useState<"hours" | "points">("hours");
  const [status, setStatus] = useState<TaskInput["status"]>("planned");
  const [priority, setPriority] = useState<TaskInput["priority"]>("normal");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      workDate,
      effort: { value: Number(effortValue), unit: effortUnit },
      status,
      priority,
    });
    setTitle("");
    setIsFormOpen(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", color: colors.text, fontSize: "1.8rem" }}>Tasks & Workload</h1>
          <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
            Track your tasks and effort estimates. Records remain private to you until explicitly shared.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          disabled={!consent.personalProcessing}
          style={{
            padding: "10px 18px",
            background: colors.accent,
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: consent.personalProcessing ? "pointer" : "not-allowed",
          }}
        >
          {isFormOpen ? "Cancel" : "+ Add Task"}
        </button>
      </div>

      {isFormOpen ? (
        <form
          onSubmit={handleSubmit}
          style={{
            background: colors.surface,
            padding: "20px",
            border: "1px solid #dbe6df",
            borderRadius: "12px",
            marginBottom: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement DynamoDB storage layer"
              required
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Work Date
            </label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              required
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Effort Estimate
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={effortValue}
                onChange={(e) => setEffortValue(Number(e.target.value))}
                required
                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0", boxSizing: "border-box" }}
              />
              <select
                value={effortUnit}
                onChange={(e) => setEffortUnit(e.target.value as "hours" | "points")}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
              >
                <option value="hours">hours</option>
                <option value="points">points</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskInput["status"])}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
            >
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Priority (Optional)
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskInput["priority"])}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1", marginTop: "6px" }}>
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                background: colors.accent,
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Task
            </button>
          </div>
        </form>
      ) : null}

      <div style={{ background: colors.surface, border: "1px solid #dbe6df", borderRadius: "12px", overflow: "hidden" }}>
        {tasks.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: colors.muted }}>
            No tasks logged yet. Click "+ Add Task" to begin.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
            <thead>
              <tr style={{ background: "#f8faf9", borderBottom: "1px solid #dbe6df", color: colors.muted }}>
                <th style={{ padding: "12px 16px" }}>Title</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Effort</th>
                <th style={{ padding: "12px 16px" }}>Priority</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} style={{ borderBottom: "1px solid #eef3f0" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: colors.text }}>{task.title}</td>
                  <td style={{ padding: "12px 16px", color: colors.muted }}>{task.workDate}</td>
                  <td style={{ padding: "12px 16px", color: colors.text }}>
                    {task.effort.value} {task.effort.unit}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ textTransform: "capitalize", color: task.priority === "urgent" ? "#d93025" : colors.muted }}>
                      {task.priority ?? "normal"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background: task.status === "done" ? "#e6f4ea" : "#f1f3f4",
                        color: task.status === "done" ? "#137333" : "#3c4043",
                      }}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => deleteTask(task.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#c5221f",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
