import { describe, it, expect } from "vitest";
import { detectAlmostMetFromPlaces } from "../../server/fingerprint";

const p = (place: string, year: number | null = null) => ({ place, year });

describe("detectAlmostMetFromPlaces", () => {
  it("returns null when there is no shared place", () => {
    expect(detectAlmostMetFromPlaces([p("Queenstown")], [p("Lisbon")])).toBeNull();
  });

  it("returns null for empty inputs", () => {
    expect(detectAlmostMetFromPlaces([], [])).toBeNull();
    expect(detectAlmostMetFromPlaces([p("Bali")], [])).toBeNull();
  });

  it("matches an exact shared place", () => {
    const r = detectAlmostMetFromPlaces([p("Queenstown")], [p("Queenstown")]);
    expect(r?.location).toBe("Queenstown");
  });

  it("matches case-insensitively and ignores anything after a comma", () => {
    const r = detectAlmostMetFromPlaces([p("queenstown")], [p("Queenstown, New Zealand")]);
    expect(r).not.toBeNull();
    expect(r?.location).toBe("Queenstown");
  });

  it("uses the year when both were there in the same window", () => {
    const r = detectAlmostMetFromPlaces([p("Kyoto", 2023)], [p("Kyoto", 2024)]);
    expect(r?.dateHint).toBe("2024");
  });

  it("says 'different trips' when the years are far apart", () => {
    const r = detectAlmostMetFromPlaces([p("Patagonia", 2018)], [p("Patagonia", 2024)]);
    expect(r?.dateHint).toBe("different trips");
  });

  it("falls back to a soft hint when a year is missing", () => {
    const r = detectAlmostMetFromPlaces([p("Bali", 2024)], [p("Bali", null)]);
    expect(r?.dateHint).toBe("you've both roamed here");
  });

  it("finds a match even when other places don't overlap", () => {
    const r = detectAlmostMetFromPlaces(
      [p("Tokyo"), p("Lofoten", 2022)],
      [p("Lisbon"), p("Lofoten", 2022)],
    );
    expect(r?.location).toBe("Lofoten");
    expect(r?.dateHint).toBe("2022");
  });
});
