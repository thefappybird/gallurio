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

const EDITABLE_LABELS = {
  searchPlaceholder: "Search venue",
  searching: "Searching",
  noResults: "No matches",
  dragHint: "Drag pin",
  clear: "Clear",
  changeLocation: "Change location",
  acceptLocation: "Accept location",
  discardLocation: "Discard changes",
  accept: "Accept",
  cancel: "Cancel",
  apply: "Apply",
  currentAddressLabel: "Selected location",
};

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

  it("does not render an in-field clear button (removed in favour of inline cancel)", () => {
    renderWithProviders(
      <LocationPicker
        value={{ address: "Somewhere", lat: 1, lng: 2 }}
        onChange={() => {}}
      />
    );
    // The "Clear location" button used to sit inside the input; it has been removed.
    expect(screen.queryByRole("button", { name: /clear location/i })).toBeNull();
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

  describe("editable mode", () => {
    const POPULATED: LocationValue = { address: "Somewhere", lat: 14.5, lng: 121.0 };

    it("empty value starts in edit mode with accept/discard controls below map", async () => {
      const fetchMock = mockNominatim([
        {
          place_id: 42,
          display_name: "Pier 27, Manila, Philippines",
          lat: "14.5995",
          lon: "120.9842",
        },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      const onChange = vi.fn();
      render(
        <LocationPicker
          editable
          value={EMPTY}
          onChange={onChange}
          labels={EDITABLE_LABELS}
        />
      );

      // Edit mode: accept+discard present below map, no Change-location, no Apply
      expect(screen.getByRole("button", { name: "Accept location" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Discard changes" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /change location/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^apply$/i })).toBeNull();
      expect(screen.queryByText("Somewhere")).toBeNull();

      // Pick a search result
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "Pier 27" } });
      const option = await screen.findByText("Pier 27, Manila, Philippines");
      fireEvent.mouseDown(option);

      // Click Accept (onChange fires only on accept, not on intermediate edits)
      fireEvent.click(screen.getByRole("button", { name: "Accept location" }));

      // onChange called exactly once with correct value
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        address: "Pier 27, Manila, Philippines",
        lat: 14.5995,
        lng: 120.9842,
      });

      // Now in display mode: Change-location button visible, accept/discard gone
      expect(screen.getByRole("button", { name: /change location/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Accept location" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
    });

    it("populated value starts in display mode", () => {
      const onChange = vi.fn();
      render(
        <LocationPicker
          editable
          value={POPULATED}
          onChange={onChange}
          labels={EDITABLE_LABELS}
        />
      );

      // Address text visible
      expect(screen.getByText("Somewhere")).toBeInTheDocument();
      // Change-location button visible
      expect(screen.getByRole("button", { name: /change location/i })).toBeInTheDocument();
      // Edit mode controls not shown (accept/discard icon buttons)
      expect(screen.queryByRole("button", { name: "Accept location" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
      // onChange not called on mount
      expect(onChange).not.toHaveBeenCalled();
    });

    it("Change location → Accept commits the new value", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ display_name: "New Place, Manila" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const onChange = vi.fn();
      render(
        <LocationPicker
          editable
          value={POPULATED}
          onChange={onChange}
          labels={EDITABLE_LABELS}
        />
      );

      // Click Change location → edit mode, map appears
      fireEvent.click(screen.getByRole("button", { name: /change location/i }));
      expect(screen.getByTestId("location-map")).toBeInTheDocument();

      // Simulate a pin pick — triggers reverse geocoding
      fireEvent.click(screen.getByTestId("map-pick"));

      // Wait for reverse geocoding to fill in address
      await screen.findByDisplayValue("New Place, Manila");

      // Accept and Discard icon buttons should be visible; no plain Apply
      expect(screen.getByRole("button", { name: "Accept location" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Discard changes" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^apply$/i })).toBeNull();

      // Click Accept (onChange fires only on commit, not on intermediate edits)
      fireEvent.click(screen.getByRole("button", { name: "Accept location" }));

      // onChange called once with new value
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ address: "New Place, Manila", lat: 1.23, lng: 4.56 })
      );

      // Back to display mode: Change-location visible, edit controls gone
      // (In a real app the parent would update the `value` prop after onChange fires;
      // here we just verify the component returns to display mode correctly.)
      expect(screen.getByRole("button", { name: /change location/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Accept location" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
    });

    it("Cancel reverts draft without calling onChange", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ display_name: "Different Place, Quezon City" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const onChange = vi.fn();
      render(
        <LocationPicker
          editable
          value={POPULATED}
          onChange={onChange}
          labels={EDITABLE_LABELS}
        />
      );

      // Enter edit mode
      fireEvent.click(screen.getByRole("button", { name: /change location/i }));

      // Drop a pin at a different location, reverse geocoding resolves
      fireEvent.click(screen.getByTestId("map-pick"));
      await screen.findByDisplayValue("Different Place, Quezon City");

      // Click Discard
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      // onChange must NOT have been called
      expect(onChange).not.toHaveBeenCalled();

      // Display mode restored with ORIGINAL address
      expect(screen.getByText("Somewhere")).toBeInTheDocument();
      // Edit controls unmounted
      expect(screen.queryByRole("button", { name: "Accept location" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
    });

    it("empty-origin shows accept/discard icon buttons below map, not an inline Apply", () => {
      render(
        <LocationPicker
          editable
          value={EMPTY}
          onChange={() => {}}
          labels={EDITABLE_LABELS}
        />
      );

      // Uniform placement: both icon buttons always present in edit mode
      expect(screen.getByRole("button", { name: "Accept location" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Discard changes" })).toBeInTheDocument();
      // Legacy apply button no longer exists
      expect(screen.queryByRole("button", { name: /^apply$/i })).toBeNull();
    });

    it("populated-origin shows accept+discard icon buttons when editing; accept enabled only when dirty", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ display_name: "Another Place" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <LocationPicker
          editable
          value={POPULATED}
          onChange={() => {}}
          labels={EDITABLE_LABELS}
        />
      );

      // Enter edit mode
      fireEvent.click(screen.getByRole("button", { name: /change location/i }));

      // Before making changes: discard present and enabled; accept present but disabled (not dirty)
      expect(screen.getByRole("button", { name: "Discard changes" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Accept location" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: /^apply$/i })).toBeNull();

      // Make it dirty via pin pick
      fireEvent.click(screen.getByTestId("map-pick"));
      await screen.findByDisplayValue("Another Place");

      // Now dirty: accept enabled
      expect(screen.getByRole("button", { name: "Accept location" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Discard changes" })).not.toBeDisabled();
    });

    it("both buttons disabled when no draft and no saved value (fresh empty-origin)", () => {
      render(
        <LocationPicker
          editable
          value={EMPTY}
          onChange={() => {}}
          labels={EDITABLE_LABELS}
        />
      );

      // No draft selected, no previously saved location — both should be disabled.
      expect(screen.getByRole("button", { name: "Accept location" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled();
    });

    it("discard enabled when a saved value exists (even before any change)", () => {
      render(
        <LocationPicker
          editable
          value={POPULATED}
          onChange={() => {}}
          labels={EDITABLE_LABELS}
        />
      );

      // Enter edit mode
      fireEvent.click(screen.getByRole("button", { name: /change location/i }));

      // No changes made yet — accept disabled (not dirty), but discard enabled (saved location exists).
      expect(screen.getByRole("button", { name: "Accept location" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Discard changes" })).not.toBeDisabled();
    });

    it("apply enabled only when dirty with a draft location selected", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ display_name: "New Selected Place" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <LocationPicker
          editable
          value={EMPTY}
          onChange={() => {}}
          labels={EDITABLE_LABELS}
        />
      );

      // Fresh empty-origin: accept disabled (no draft, not dirty).
      expect(screen.getByRole("button", { name: "Accept location" })).toBeDisabled();

      // Select a location via pin (sets draft to non-empty value and makes it dirty).
      fireEvent.click(screen.getByTestId("map-pick"));
      await screen.findByDisplayValue("New Selected Place");

      // Draft is non-empty AND dirty → accept should be enabled.
      expect(screen.getByRole("button", { name: "Accept location" })).not.toBeDisabled();
    });

    it("disabled + editable shows address text, Change-location button is disabled, and edit controls are not shown", () => {
      render(
        <LocationPicker
          editable
          disabled
          value={POPULATED}
          onChange={() => {}}
          labels={EDITABLE_LABELS}
        />
      );

      // Address text visible
      expect(screen.getByText("Somewhere")).toBeInTheDocument();
      // Change-location button is present but disabled
      const changeBtn = screen.getByRole("button", { name: /change location/i });
      expect(changeBtn).toBeInTheDocument();
      expect(changeBtn).toBeDisabled();
      // Edit mode controls not shown (still in display mode)
      expect(screen.queryByRole("button", { name: "Accept location" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
    });

    it("commit-only: onChange does not fire on intermediate edits; discard reverts without onChange", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ display_name: "Intermediate Place" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const onChange = vi.fn();
      render(
        <LocationPicker
          editable
          value={POPULATED}
          onChange={onChange}
          labels={EDITABLE_LABELS}
        />
      );

      // Enter edit mode
      fireEvent.click(screen.getByRole("button", { name: /change location/i }));

      // Drop a pin → triggers reverse geocoding, updates draft but NOT onChange
      fireEvent.click(screen.getByTestId("map-pick"));
      await screen.findByDisplayValue("Intermediate Place");

      // Intermediate edit must NOT have called onChange
      expect(onChange).not.toHaveBeenCalled();

      // Discard: revert without calling onChange
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
      expect(onChange).not.toHaveBeenCalled();

      // Display mode restored with original address
      expect(screen.getByText("Somewhere")).toBeInTheDocument();

      // Enter edit again and this time accept
      fireEvent.click(screen.getByRole("button", { name: /change location/i }));
      fireEvent.click(screen.getByTestId("map-pick"));
      await screen.findByDisplayValue("Intermediate Place");

      // Accept: now onChange fires exactly once
      fireEvent.click(screen.getByRole("button", { name: "Accept location" }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ address: "Intermediate Place", lat: 1.23, lng: 4.56 })
      );
    });
  });
});
