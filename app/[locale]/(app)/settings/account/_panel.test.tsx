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

vi.mock("@/lib/storage/uploadToCloudinary.client", () => ({
  uploadImageToCloudinary: vi.fn(),
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

const { uploadImageToCloudinary } = await import(
  "@/lib/storage/uploadToCloudinary.client"
);
const mockUpload = vi.mocked(uploadImageToCloudinary);
const mockUpdateAvatar = vi.mocked(updateAvatarAction);

const defaultProps = {
  name: "Jane Doe",
  email: "jane@example.com",
  avatarUrl: null,
  avatarCloudinaryPublicId: null,
  hasOAuth: false,
  mfaEnabled: false,
};

function uploadResult(url: string, publicId: string) {
  return {
    url,
    cloudinaryPublicId: publicId,
    width: 400,
    height: 400,
    format: "jpg",
    sizeBytes: 1234,
  };
}

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

  it("renders Replace and Remove buttons when an uploaded avatar is set", () => {
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

  it("hides Remove for a provider default avatar (no Cloudinary id)", () => {
    renderWithProviders(
      <AccountPanel
        {...defaultProps}
        avatarUrl="https://provider.example/default.png"
        avatarCloudinaryPublicId={null}
      />,
    );
    // Replace is still offered, but there is no uploaded asset to remove.
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("uploads via the shared helper and persists the url and publicId", async () => {
    mockUpload.mockResolvedValue(
      uploadResult(
        "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
        "gallurio/ws/avatars/a",
      ),
    );
    mockUpdateAvatar.mockResolvedValue({ ok: true });

    renderWithProviders(<AccountPanel {...defaultProps} />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(file, {
        subfolder: "avatars",
        validateDimensions: false,
      });
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

  it("shows an inline error for an unsupported file type", async () => {
    mockUpload.mockRejectedValue(new Error("type_not_accepted"));
    renderWithProviders(<AccountPanel {...defaultProps} />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Please choose a JPG/i)).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows an inline error for an oversized file", async () => {
    mockUpload.mockRejectedValue(new Error("file_too_large"));
    renderWithProviders(<AccountPanel {...defaultProps} />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [big] } });

    await waitFor(() => {
      expect(screen.getByText(/too large/i)).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows a generic inline error when the upload itself fails", async () => {
    mockUpload.mockRejectedValue(new Error("upload_failed"));
    renderWithProviders(<AccountPanel {...defaultProps} />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/couldn.t upload your photo/i)).toBeInTheDocument();
    });
  });

  it("removes the avatar and shows a success toast", async () => {
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

  it("shows an inline error when removing the avatar fails", async () => {
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
      expect(screen.getByText("Not authenticated")).toBeInTheDocument();
    });
  });

  it("reverts to no avatar when persistence fails after a successful upload", async () => {
    mockUpload.mockResolvedValue(
      uploadResult(
        "https://res.cloudinary.com/demo/image/upload/v1/new.jpg",
        "gallurio/ws/avatars/new",
      ),
    );
    mockUpdateAvatar.mockResolvedValue({
      error: "Failed to update photo. Please try again.",
    });

    renderWithProviders(
      <AccountPanel
        {...defaultProps}
        avatarUrl={null}
        avatarCloudinaryPublicId={null}
      />,
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["img"], "new.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText("Failed to update photo. Please try again."),
      ).toBeInTheDocument();
    });

    // After rollback the avatar is null again: Upload (not Replace) is shown
    // and Remove is absent.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("restores the prior avatar when persistence fails after Remove", async () => {
    mockUpdateAvatar.mockResolvedValue({
      error: "Failed to update photo. Please try again.",
    });

    renderWithProviders(
      <AccountPanel
        {...defaultProps}
        avatarUrl="https://example.com/avatar.jpg"
        avatarCloudinaryPublicId="gallurio/ws/avatars/abc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to update photo. Please try again."),
      ).toBeInTheDocument();
    });

    // After rollback the uploaded avatar is back: Replace and Remove return.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});
