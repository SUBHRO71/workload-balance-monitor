import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";

export const CheckInsPage: React.FC = () => {
  const { consent, checkIns, addCheckIn, deleteCheckIn } = useWorkload();

  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rating, setRating] = useState<number>(3);
  const [note, setNote] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCheckIn({
      checkInDate: date,
      manageability: rating,
      privateNote: note.trim() || undefined,
    });
    setNote("");
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: "0 0 6px", color: colors.text, fontSize: "1.8rem" }}>
          Voluntary Check-ins
        </h1>
        <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
          Check in on how manageable your workload feels. Private notes stay owner-only and have no upward sharing path.
        </p>
      </div>

      <div
        style={{
          background: colors.surface,
          padding: "20px",
          border: "1px solid #dbe6df",
          borderRadius: "12px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "1.15rem", margin: "0 0 14px", color: colors.text }}>
          Record New Check-in
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #c9d8d0", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
                Manageability (1: Overwhelmed — 5: Very manageable)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setRating(val)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "6px",
                      border: rating === val ? `2px solid ${colors.accent}` : "1px solid #c9d8d0",
                      background: rating === val ? "#eaf2ee" : "#ffffff",
                      fontWeight: rating === val ? 700 : 500,
                      color: colors.text,
                      cursor: "pointer",
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
              Private Reflection Note (Optional — never included in team/org aggregates or shares)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What made this period manageable or challenging?"
              rows={3}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #c9d8d0",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!consent.personalProcessing}
            style={{
              padding: "10px 18px",
              background: colors.accent,
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: consent.personalProcessing ? "pointer" : "not-allowed",
            }}
          >
            Save Check-in
          </button>
        </form>
      </div>

      <div style={{ background: colors.surface, border: "1px solid #dbe6df", borderRadius: "12px", overflow: "hidden" }}>
        {checkIns.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: colors.muted }}>
            No voluntary check-ins logged yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
            <thead>
              <tr style={{ background: "#f8faf9", borderBottom: "1px solid #dbe6df", color: colors.muted }}>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Manageability</th>
                <th style={{ padding: "12px 16px" }}>Private Reflection</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {checkIns.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #eef3f0" }}>
                  <td style={{ padding: "12px 16px", color: colors.text, fontWeight: 600 }}>{item.checkInDate}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontWeight: 700,
                        background: item.manageability <= 2 ? "#fce8e6" : item.manageability >= 4 ? "#e6f4ea" : "#fef7e0",
                        color: item.manageability <= 2 ? "#c5221f" : item.manageability >= 4 ? "#137333" : "#b06000",
                      }}
                    >
                      {item.manageability} / 5
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: colors.muted, fontStyle: item.privateNote ? "normal" : "italic" }}>
                    {item.privateNote || "None"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => deleteCheckIn(item.id)}
                      style={{ background: "none", border: "none", color: "#c5221f", cursor: "pointer", fontSize: "0.85rem" }}
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
