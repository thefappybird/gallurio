import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

// Stub the dynamically-imported Leaflet map — the real map touches `window`,
// loads CSS, and pulls raster assets that don't belong in happy-dom.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MockMap(props: { onPick?: (lat: number, lng: number) => void }) {
      // Expose a trigger so tests can simulate dropping/dragging a pin.
      return (
        <div data-testid="location-map">
          <button type="button" data-testid="map-pick" onClick={() => props.onPick?.(1.23, 4.56)}>
            pick
          </button>
        </div>
      );
    },
}));

import { LocationPicker, type LocationValue } from "./location-picker";

const EMPTY: LocationValue = { address: "", lat: null, lng: null };

function mockNominatim(results: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => results,
  });
}

describe("LocationPicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the search box and the (stubbed) map", () => {
    renderWithProviders(<LocationPicker value={EMPTY} onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByTestId("location-map")).toBeInTheDocument();
  });

  it("commits a free-typed address on blur", () => {
    const onChange = vi.fn();
    renderWithProviders(<LocationPicker value={EMPTY} onChange={onChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Pier 27, Manila" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({
      address: "Pier 27, Manila",
      lat: null,
      lng: null,
    });
  });

  it("searches Nominatim and emits address+lat+lng on select", async () => {
    const fetchMock = mockNominatim([
      {
        place_id: 1,
        display_name: "Pier 27, Manila, Philippines",
        lat: "14.5995",
        lon: "120.9842",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const onChange = vi.fn();
    renderWithProviders(<LocationPicker value={EMPTY} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Pier 27" } });

    const option = await screen.findByText("Pier 27, Manila, Philippines");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(option);

    expect(onChange).toHaveBeenCalledWith({
      address: "Pier 27, Manila, Philippines",
      lat: 14.5995,
      lng: 120.9842,
    });
  });

  it("clamps a long Nominatim display_name to 240 chars on select (server max)", async () => {
    const longName = "A".repeat(400);
    const fetchMock = mockNominatim([
      { place_id: 9, display_name: longName, lat: "1.5", lon: "2.5" },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const onChange = vi.fn();
    renderWithProviders(<LocationPicker value={EMPTY} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "long place" } });
    const option = await screen.findByText(longName);
    fireEvent.mouseDown(option);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 1.5, lng: 2.5 })
    );
    const committed = onChange.mock.calls[0][0] as { address: string };
    expect(committed.address.length).toBe(240);
    // The visible input is clamped too, so the follow-up blur can't re-commit a
    // longer string the server would reject.
    expect((screen.getByRole("combobox") as HTMLInputElement).value.length).toBe(240);
  });

  it("does not fire a search before the debounce window or for short queries", () => {
    vi.useFakeTimers();
    const fetchMock = mockNominatim([]);
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<LocationPicker value={EMPTY} onChange={() => {}} />);
    const input = screen.getByRole("combobox");

    // < 3 chars never searches, even after the debounce elapses.
    fireEvent.change(input, { target: { value: "ab" } });
    vi.advanceTimersByTime(600);
    expect(fetchMock).not.toHaveBeenCalled();

    // A real query does not fire until the debounce window passes.
    fireEvent.change(input, { target: { value: "Pier 27" } });
    vi.advanceTimersByTime(200);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears address and coordinates via the clear button", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <LocationPicker
        value={{ address: "Somewhere", lat: 1, lng: 2 }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({ address: "", lat: null, lng: null });
  });

  it("shows a no-results message when the search returns nothing", async () => {
    vi.stubGlobal("fetch", mockNominatim([]));
    renderWithProviders(<LocationPicker value={EMPTY} onChange={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "zzzzzz nowhere" },
    });
    expect(await screen.findByText(/no matches/i)).toBeInTheDocument();
  });

  it("renders outside a NextIntl provider when explicit labels are passed", () => {
    render(
      <LocationPicker
        value={EMPTY}
        onChange={() => {}}
        labels={{
          searchPlaceholder: "Search venue",
          searching: "Searching",
          noResults: "No matches",
          dragHint: "Drag pin",
          clear: "Clear",
        }}
      />
    );

    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Search venue");
    expect(screen.getByText("Drag pin")).toBeInTheDocument();
  });

  it("reverse-geocodes a dropped map pin and fills the address input", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ display_name: "Reverse Found Place, Manila" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const onChange = vi.fn();
    renderWithProviders(<LocationPicker value={EMPTY} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("map-pick"));

    // Coordinates land immediately (optimistic), address arrives after geocoding.
    expect(onChange).toHaveBeenCalledWith({ address: "", lat: 1.23, lng: 4.56 });
    await screen.findByDisplayValue("Reverse Found Place, Manila");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/reverse?format=jsonv2&lat=1.23&lon=4.56"),
      expect.anything()
    );
    expect(onChange).toHaveBeenLastCalledWith({
      address: "Reverse Found Place, Manila",
      lat: 1.23,
      lng: 4.56,
    });
  });

  it("clamps a long reverse-geocoded address to 240 chars", async () => {
    const longName = "B".repeat(400);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ display_name: longName }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const onChange = vi.fn();
    renderWithProviders(<LocationPicker value={EMPTY} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("map-pick"));

    await vi.waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as { address: string };
      expect(last.address.length).toBe(240);
    });
  });

  it("skips reverse geocoding for a map pin when search is disabled", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const onChange = vi.fn();
    renderWithProviders(
      <LocationPicker value={EMPTY} onChange={onChange} searchEnabled={false} />
    );
    fireEvent.click(screen.getByTestId("map-pick"));

    expect(onChange).toHaveBeenCalledWith({ address: "", lat: 1.23, lng: 4.56 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips geocoding when search is disabled", () => {
    vi.useFakeTimers();
    const fetchMock = mockNominatim([]);
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(
      <LocationPicker value={EMPTY} onChange={() => {}} searchEnabled={false} />
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Pier 27, Manila" },
    });
    vi.advanceTimersByTime(1000);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
