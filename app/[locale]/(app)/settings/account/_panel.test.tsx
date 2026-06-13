import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { AccountPanel } from "./_panel";
import { updateAvatarAction } from "../_actions";
import { toast } from "sonner";

vi.mock("../_actions", () => ({
  updateProfileNameAction: vi.fn().mockResolvedValue({ ok: true }),
  updateAvatarAction: vi.fn(),
  updatePasswordAction: vi.fn(),
  sendSetPasswordEmailAction: vi.fn(),
}));

vi.mock("@/lib/storage/uploadToCloudinary", () => ({
  uploadToCloudinary: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./_password-section", () => ({
  PasswordSection: () => <div data-testid="password-section" />,
}));

vi.mock("./_mfa-section", () => ({
  MfaSection: () => <div data-testid="mfa-section" />,
}));

const { uploadToCloudinary } = await import("@/lib/storage/uploadToCloudinary");
const mockUpload = vi.mocked(uploadToCloudinary);
const mockUpdateAvatar = vi.mocked(updateAvatarAction);

const defaultProps = {
  name: "Jane Doe",
  email: "jane@example.com",
  avatarUrl: null,
  avatarCloudinaryPublicId: null,
  hasOAuth: false,
  mfaEnabled: false,
};

describe("AccountPanel — avatar upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Upload button when no avatar is set", () => {
    renderWithProviders(<AccountPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("renders Replace and Remove buttons when avatar is set", () => {
    renderWithProviders(
      <AccountPanel
        {...defaultProps}
        avatarUrl="https://example.com/avatar.jpg"
        avatarCloudinaryPublicId="gallurio/ws/avatars/abc"
      />,
    );
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("calls updateAvatarAction with uploaded url and publicId after file selection", async () => {
    mockUpload.mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
      public_id: "gallurio/ws/avatars/a",
      format: "jpg",
      resource_type: "image",
      created_at: "",
      bytes: 1234,
      width: 400,
      height: 400,
      url: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockUpdateAvatar.mockResolvedValue({ ok: true });

    renderWithProviders(<AccountPanel {...defaultProps} />);

    const fileInput = document
      .querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(file, { subfolder: "avatars" });
    });

    await waitFor(() => {
      expect(mockUpdateAvatar).toHaveBeenCalledWith({
        avatarUrl: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
        avatarCloudinaryPublicId: "gallurio/ws/avatars/a",
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Photo updated");
    });
  });

  it("shows error toast for a non-image file", async () => {
    renderWithProviders(<AccountPanel {...defaultProps} />);

    const fileInput = document
      .querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Choose an image file");
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("shows error toast for a file over 5 MB", async () => {
    renderWithProviders(<AccountPanel {...defaultProps} />);

    const fileInput = document
      .querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Image must be under 5 MB");
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("calls updateAvatarAction with nulls and shows success toast on Remove", async () => {
    mockUpdateAvatar.mockResolvedValue({ ok: true });

    renderWithProviders(
      <AccountPanel
        {...defaultProps}
        avatarUrl="https://example.com/avatar.jpg"
        avatarCloudinaryPublicId="gallurio/ws/avatars/abc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(mockUpdateAvatar).toHaveBeenCalledWith({
        avatarUrl: null,
        avatarCloudinaryPublicId: null,
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Photo removed");
    });
  });

  it("shows error toast when updateAvatarAction returns an error on Remove", async () => {
    mockUpdateAvatar.mockResolvedValue({ error: "Not authenticated" });

    renderWithProviders(
      <AccountPanel
        {...defaultProps}
        avatarUrl="https://example.com/avatar.jpg"
        avatarCloudinaryPublicId="gallurio/ws/avatars/abc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Not authenticated");
    });
  });

  it("reverts avatar to prior image when updateAvatarAction errors after a successful upload", async () => {
    mockUpload.mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/new.jpg",
      public_id: "gallurio/ws/avatars/new",
      format: "jpg",
      resource_type: "image",
      created_at: "",
      bytes: 1234,
      width: 400,
      height: 400,
      url: "https://res.cloudinary.com/demo/image/upload/v1/new.jpg",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockUpdateAvatar.mockResolvedValue({ error: "Failed to update photo. Please try again." });

    // Start with NO avatar so that a successful rollback means the Upload button
    // (not Replace) is visible and the avatar img element is gone.
    renderWithProviders(<AccountPanel {...defaultProps} avatarUrl={null} avatarCloudinaryPublicId={null} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "new.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update photo. Please try again.");
    });

    // After rollback: avatarUrl is null again, so "Upload" button (not "Replace") is shown
    // and the "Remove" button is absent — confirming the state reverted.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("reverts avatar to prior image when updateAvatarAction errors after Remove", async () => {
    mockUpdateAvatar.mockResolvedValue({ error: "Failed to update photo. Please try again." });

    renderWithProviders(
      <AccountPanel
        {...defaultProps}
        avatarUrl="https://example.com/avatar.jpg"
        avatarCloudinaryPublicId="gallurio/ws/avatars/abc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update photo. Please try again.");
    });

    // After rollback: avatarUrl is restored, so "Replace" and "Remove" buttons are shown again.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});
