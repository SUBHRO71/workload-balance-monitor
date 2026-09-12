import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";
import type { PrivateItemInput } from "@workload/contracts";

export const PrivateItemsPage: React.FC = () => {
  const { consent, privateItems, addPrivateItem, deletePrivateItem } = useWorkload();

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [type, setType] = useState<PrivateItemInput["type"]>("personal_goal");
  const [lifecycle, setLifecycle] = useState<"ongoing" | "one_time">("ongoing");
  const [eventDate, setEventDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (lifecycle === "one_time") {
      addPrivateItem({
        type,
        title: title.trim(),
        content: content.trim() || undefined,
        lifecycle: "one_time",
        eventEndAt: `${eventDate}T00:00:00.000Z`,
      });
    } else {
      addPrivateItem({
        type,
        title: title.trim(),
        content: content.trim() || undefined,
        lifecycle: "ongoing",
      });
    }

    setTitle("");
    setContent("");
    setIsFormOpen(false);
  };

  // Preview 365-day deletion date for one-time items
  const deletionDatePreview = () => {
    const d = new Date(`${eventDate}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 365);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", color: colors.text, fontSize: "1.8rem" }}>
            🔒 Private Items
          </h1>
          <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
            Personal goals, notes, leave reasons, and commitments. Excluded from upward sharing and team/org aggregates.
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
          {isFormOpen ? "Cancel" : "+ Add Private Item"}
        </button>
      </div>

      <div
        style={{
          padding: "14px 18px",
          background: "#eaf2ee",
          border: "1px solid #c9d8d0",
          borderRadius: "10px",
          marginBottom: "24px",
          fontSize: "0.9rem",
          color: colors.text,
        }}
      >
        🛡️ <strong>Owner Isolation Guarantee:</strong> Managers and HR staff cannot access this section, even if you share other tasks. Dated one-time items (like leave details) automatically expire 365 days after the event date.
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
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Parental leave, doctor appointment, study goal"
              required
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Item Category
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PrivateItemInput["type"])}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
            >
              <option value="personal_goal">Personal Goal</option>
              <option value="note">Private Note</option>
              <option value="leave_detail">Leave Details / Reasons</option>
              <option value="personal_deadline">Personal Deadline</option>
              <option value="reminder">Personal Reminder</option>
              <option value="commitment">Personal Commitment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Retention Lifecycle
            </label>
            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value as "ongoing" | "one_time")}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
            >
              <option value="ongoing">Ongoing (retained until you delete)</option>
              <option value="one_time">One-time event (expires after 365 days)</option>
            </select>
          </div>

          {lifecycle === "one_time" ? (
            <div style={{ gridColumn: "1 / -1", background: "#f8faf9", padding: "12px", borderRadius: "8px", border: "1px solid #e0eae4" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
                Event / End Date (required for one-time items):
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
              />
              <div style={{ fontSize: "0.85rem", color: colors.muted, marginTop: "6px" }}>
                🕒 This record will be permanently deleted 365 days after the event date: <strong>{deletionDatePreview()}</strong>.
              </div>
            </div>
          ) : null}

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Content / Details (Optional):
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Private details, notes, or reminders..."
              rows={3}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
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
              Save Private Item
            </button>
          </div>
        </form>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
        {privateItems.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center", background: colors.surface, border: "1px solid #dbe6df", borderRadius: "12px", color: colors.muted }}>
            No private items stored.
          </div>
        ) : (
          privateItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: colors.surface,
                border: "1px solid #dbe6df",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "#f0f4f1",
                      color: colors.muted,
                    }}
                  >
                    {item.type.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: item.lifecycle === "one_time" ? "#b06000" : colors.muted }}>
                    {item.lifecycle === "one_time" ? "⏳ 1-year retention" : "♾️ Indefinite"}
                  </span>
                </div>

                <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem", color: colors.text }}>
                  {item.title}
                </h3>

                {item.content ? (
                  <p style={{ margin: "0 0 10px", fontSize: "0.9rem", color: colors.muted, lineHeight: 1.5 }}>
                    {item.content}
                  </p>
                ) : null}
              </div>

              <div style={{ borderTop: "1px solid #eef3f0", paddingTop: "10px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: colors.muted }}>
                  {item.lifecycle === "one_time" ? `Deletes: ${item.deleteAfter.slice(0, 10)}` : "Retained until deleted"}
                </span>
                <button
                  onClick={() => deletePrivateItem(item.id)}
                  style={{ background: "none", border: "none", color: "#c5221f", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
