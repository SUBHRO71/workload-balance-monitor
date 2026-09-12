import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";

export const SettingsPage: React.FC = () => {
  const { preferences, updatePreferences } = useWorkload();

  const [capacity, setCapacity] = useState<number>(preferences.weeklyCapacity?.value ?? 40);
  const [unit, setUnit] = useState<"hours" | "points">(preferences.weeklyCapacity?.unit ?? "hours");
  const [timezone, setTimezone] = useState<string>(preferences.timezone);
  const [savedMsg, setSavedMsg] = useState<string>("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences({
      weeklyCapacity: { value: Number(capacity), unit },
      timezone,
    });
    setSavedMsg("Settings saved successfully.");
    setTimeout(() => setSavedMsg(""), 3000);
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 6px", color: colors.text, fontSize: "1.8rem" }}>
          ⚙️ Personal Settings
        </h1>
        <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
          Configure your workload capacity preferences and display settings.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        style={{
          background: colors.surface,
          padding: "24px",
          border: "1px solid #dbe6df",
          borderRadius: "14px",
          maxWidth: "500px",
        }}
      >
        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: colors.text, marginBottom: "6px" }}>
            Target Weekly Capacity
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="number"
              min="1"
              max="168"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as "hours" | "points")}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
            >
              <option value="hours">hours</option>
              <option value="points">points</option>
            </select>
          </div>
          <small style={{ color: colors.muted, marginTop: "4px", display: "block" }}>
            Optional baseline used exclusively for personal trend comparisons.
          </small>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: colors.text, marginBottom: "6px" }}>
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0" }}
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
          </select>
        </div>

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
          Save Preferences
        </button>

        {savedMsg ? (
          <span style={{ marginLeft: "14px", color: colors.accent, fontWeight: 500, fontSize: "0.9rem" }}>
            {savedMsg}
          </span>
        ) : null}
      </form>
    </div>
  );
};
