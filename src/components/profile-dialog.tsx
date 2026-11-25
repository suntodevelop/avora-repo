"use client";
import { useEffect, useState } from "react";
import { Camera, LoaderCircle, Save, Trash2, X } from "lucide-react";
import type { PublicUser } from "@/lib/types";
export function Avatar({
  user,
  size = "",
}: {
  user?: Pick<PublicUser, "name" | "avatarUrl">;
  size?: string;
}) {
  return (
    <span className={`user-avatar ${size}`}>
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="Ảnh đại diện" />
      ) : (
        <span>
          {user?.name
            .split(" ")
            .filter(Boolean)
            .slice(-2)
            .map((word) => word[0])
            .join("") || "A"}
        </span>
      )}
    </span>
  );
}
export default function ProfileDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (user: PublicUser) => void;
}) {
  const [user, setUser] = useState<PublicUser>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File>(),
    [preview, setPreview] = useState(""),
    [remove, setRemove] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error("Không thể tải hồ sơ");
        setUser(await response.json());
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [busy, onClose]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("name", user.name);
      body.set("phone", user.phone || "");
      body.set("address", user.address || "");
      if (file) body.set("avatar", file);
      body.set("removeAvatar", String(remove));
      const response = await fetch("/api/profile", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      onSaved(result);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể lưu hồ sơ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">TÀI KHOẢN CỦA BẠN</span>
            <h2 id="profile-title">Hồ sơ cá nhân</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Đóng hồ sơ"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {user ? (
          <form onSubmit={submit}>
            <div className="profile-avatar-editor">
              <Avatar
                user={{
                  name: user.name,
                  avatarUrl: preview || (remove ? "" : user.avatarUrl),
                }}
                size="large"
              />
              <div>
                <label className="btn avatar-upload">
                  <Camera size={15} />
                  Tải ảnh lên
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Tải ảnh đại diện"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (selected) {
                        if (
                          selected.size > 1048576 ||
                          !["image/png", "image/jpeg", "image/webp"].includes(
                            selected.type,
                          )
                        ) {
                          setError("Chọn ảnh PNG, JPEG hoặc WebP tối đa 1 MB");
                          return;
                        }
                        setFile(selected);
                        setRemove(false);
                        setError("");
                      }
                    }}
                  />
                </label>
                <small>PNG, JPEG hoặc WebP · tối đa 1 MB</small>
                {(file || user.avatarUrl) && !remove && (
                  <button
                    type="button"
                    className="text-link danger"
                    onClick={() => {
                      setFile(undefined);
                      setRemove(true);
                    }}
                  >
                    <Trash2 size={12} />
                    Xóa ảnh đại diện
                  </button>
                )}
              </div>
            </div>
            <label>
              Họ và tên
              <input
                autoFocus
                value={user.name}
                required
                maxLength={120}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Email
                <input value={user.email} disabled />
              </label>
              <label>
                Vai trò
                <input
                  value={
                    user.role === "admin"
                      ? "Admin"
                      : user.role === "staff"
                        ? "Staff"
                        : "User"
                  }
                  disabled
                />
              </label>
            </div>
            <label>
              Số điện thoại
              <input
                type="tel"
                placeholder="Thêm số điện thoại"
                value={user.phone || ""}
                maxLength={30}
                onChange={(e) => setUser({ ...user, phone: e.target.value })}
              />
            </label>
            <label>
              Địa chỉ
              <textarea
                rows={2}
                placeholder="Thêm địa chỉ"
                maxLength={500}
                value={user.address || ""}
                onChange={(e) => setUser({ ...user, address: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button
                className="btn"
                type="button"
                onClick={onClose}
                disabled={busy}
              >
                Hủy
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Lưu hồ sơ
              </button>
            </div>
          </form>
        ) : (
          <div className="empty">Đang tải hồ sơ…</div>
        )}
      </section>
    </div>
  );
}
