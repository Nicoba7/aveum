import { describe, expect, it } from "vitest";
import { deriveHomeTimelineEmphasis, mergeTimeline } from "../components/HomeTab";

describe("deriveHomeTimelineEmphasis", () => {
  it("marks only now when a current row exists", () => {
    const rows = [
      { slot: 12, action: "charge", label: "Charging" },
      { slot: 13, action: "hold", label: "Holding steady" },
      { slot: 14, action: "export", label: "Exporting" },
    ];
    const result = deriveHomeTimelineEmphasis(rows, 12);

    expect(result).toEqual(["active", "default", "default"]);
  });

  it("marks planned when no action is active or soon", () => {
    const rows = [
      { slot: 30, action: "hold", label: "Holding steady" },
      { slot: 31, action: "charge", label: "Charging" },
      { slot: 32, action: "export", label: "Exporting" },
    ];
    const result = deriveHomeTimelineEmphasis(rows, 28);

    expect(result).toEqual(["default", "planned", "default"]);
  });

  it("falls back to planned when nothing is active or soon", () => {
    const rows = [
      { slot: 20, action: "hold", label: "Holding steady" },
      { slot: 24, action: "export", label: "Exporting" },
      { slot: 26, action: "charge", label: "Charging" },
    ];

    const result = deriveHomeTimelineEmphasis(rows, 10);

    expect(result).toEqual(["default", "planned", "default"]);
  });
});

describe("mergeTimeline live NEXT rows", () => {
  const context = {
    solarForecastKwh: 14,
    currentPence: 7.2,
    hasEV: true,
  };

  it("shows active now plus the next meaningful future action", () => {
    const rows = mergeTimeline(
      [
        { slot: 0, action: "hold", reason: "Nothing to do" },
        { slot: 2, action: "charge", reason: "Import price is in a cheap window" },
        { slot: 6, action: "hold", reason: "Nothing to do" },
        { slot: 8, action: "export", reason: "Export price is high" },
      ],
      context,
      6
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ slot: 6, liveLabel: "Now" });
    expect(rows[1]).toMatchObject({ slot: 8, liveLabel: "Up next" });
  });

  it("when nothing is active, shows first two upcoming actions", () => {
    const rows = mergeTimeline(
      [
        { slot: 8, action: "charge", reason: "Import price is in a cheap window" },
        { slot: 10, action: "export", reason: "Export price is high" },
        { slot: 12, action: "hold", reason: "Nothing to do" },
      ],
      context,
      6
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ slot: 8, liveLabel: "Now" });
    expect(rows[1]).toMatchObject({ slot: 10, liveLabel: "Up next" });
  });

  it("keeps only one row when no meaningful second future action exists", () => {
    const rows = mergeTimeline(
      [
        { slot: 8, action: "charge", reason: "Import price is in a cheap window" },
        { slot: 10, action: "hold", reason: "Strong solar is expected soon" },
        { slot: 12, action: "hold", reason: "Nothing to do" },
      ],
      context,
      6
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slot: 8, liveLabel: "Now" });
  });

  it("uses customer-facing Home copy without affecting live semantics", () => {
    const rows = mergeTimeline(
      [
        { slot: 6, action: "hold", reason: "Strong solar is expected soon" },
        { slot: 8, action: "charge", reason: "Import price is in a cheap window" },
      ],
      context,
      6
    );

    expect(rows[0]).toMatchObject({ label: "Holding until solar arrives", liveLabel: "Now" });
    expect(rows[1]).toMatchObject({ label: "Charging EV now", liveLabel: "Up next" });
  });
});
