"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  Check,
  History as HistoryIcon,
  KeyRound,
  Pencil,
  UserCircle2,
  X,
} from "lucide-react";
import Image from "next/image";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import type { ProfileHistoryPayload, ProfileMePayload } from "@/app/[locale]/(app)/profile/page";
import { buildFullName, buildInitials } from "@/lib/profile";

type Props = {
  initialMe: ProfileMePayload;
  initialHistory: ProfileHistoryPayload;
};

type ToastSeverity = "success" | "error";

export function ProfilePageClient({ initialMe, initialHistory }: Props) {
  const t = useTranslations("profile");
  const common = useTranslations("common");

  const [me, setMe] = useState(initialMe);
  const [history, setHistory] = useState(initialHistory);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>("success");

  const [userForm, setUserForm] = useState({
    first_name: initialMe.user.first_name ?? "",
    last_name: initialMe.user.last_name ?? "",
    email: initialMe.user.email ?? "",
    phone: initialMe.user.phone ?? "",
    profile_picture_url: initialMe.user.profile_picture_url ?? "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [userFieldErrors, setUserFieldErrors] = useState<{
    first_name?: string;
    last_name?: string;
    phone?: string;
  }>({});
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const fullName = useMemo(() => {
    return buildFullName(me.user.first_name, me.user.last_name);
  }, [me.user.first_name, me.user.last_name]);

  const initials = useMemo(() => {
    return buildInitials(me.user.first_name, me.user.last_name);
  }, [me.user.first_name, me.user.last_name]);

  const actionLabel = (action: string) => {
    const key = `history.actions.${action}`;
    return t.has(key) ? t(key) : action;
  };

  async function refreshHistory() {
    const res = await fetch("/api/profile/history?limit=10", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      setHistory(data as ProfileHistoryPayload);
    }
  }

  async function saveUserInfo() {
    setToastMessage(null);
    setUserFieldErrors({});

    const nextErrors: { first_name?: string; last_name?: string; phone?: string } = {};
    const firstName = userForm.first_name.trim();
    const lastName = userForm.last_name.trim();
    const phoneDigits = userForm.phone.replace(/\D/g, "");

    if (firstName.length < 2) {
      nextErrors.first_name = t("errors.firstNameTooShort");
    }
    if (lastName.length < 2) {
      nextErrors.last_name = t("errors.lastNameTooShort");
    }
    if (phoneDigits.length !== 9) {
      nextErrors.phone = t("errors.phoneInvalid");
    }

    if (Object.keys(nextErrors).length > 0) {
      setUserFieldErrors(nextErrors);
      setToastSeverity("error");
      setToastMessage(t("errors.fixValidationErrors"));
      return;
    }

    setIsSavingInfo(true);
    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phoneDigits,
          profile_picture_url: userForm.profile_picture_url || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message ?? t("errors.saveProfileFailed"));
      }
      setMe(data as ProfileMePayload);
      setIsEditing(false);
      setToastSeverity("success");
      setToastMessage(t("messages.profileSaved"));
      await refreshHistory();
    } catch (saveError) {
      setToastSeverity("error");
      setToastMessage(
        saveError instanceof Error ? saveError.message : t("errors.saveProfileFailed"),
      );
    } finally {
      setIsSavingInfo(false);
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setToastMessage(null);

    if (!file.type.startsWith("image/")) {
      setToastSeverity("error");
      setToastMessage(t("errors.avatarInvalidType"));
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setToastSeverity("error");
      setToastMessage(t("errors.avatarTooLarge"));
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const uploadUrlRes = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }),
      });
      const uploadUrlData = await uploadUrlRes.json().catch(() => null);
      if (!uploadUrlRes.ok) {
        throw new Error(uploadUrlData?.message ?? t("errors.avatarUploadFailed"));
      }
      const { file_id, upload_url } = uploadUrlData as {
        file_id: string;
        upload_url: string;
      };

      const uploadRes = await fetch("/api/files/upload-proxy", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-upload-url": upload_url,
        },
        body: file,
      });
      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.json().catch(() => null);
        throw new Error(uploadErr?.message ?? t("errors.avatarUploadFailed"));
      }

      const fileViewUrl = `/api/files/${file_id}/view`;
      setUserForm((prev) => ({ ...prev, profile_picture_url: fileViewUrl }));
      setToastSeverity("success");
      setToastMessage(t("messages.avatarUploaded"));
    } catch (uploadError) {
      setToastSeverity("error");
      setToastMessage(
        uploadError instanceof Error ? uploadError.message : t("errors.avatarUploadFailed"),
      );
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToastMessage(null);
    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message ?? t("errors.passwordChangeFailed"));
      }
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setToastSeverity("success");
      setToastMessage(t("messages.passwordChanged"));
      await refreshHistory();
    } catch (changeError) {
      setToastSeverity("error");
      setToastMessage(
        changeError instanceof Error
          ? changeError.message
          : t("errors.passwordChangeFailed"),
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <form className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            <UserCircle2 className="h-5 w-5 text-primary-600 dark:text-primary-300" />
            {t("userInfo.title")}
          </h2>
          {me.permissions.can_edit_user_info ? (
            <div className="inline-flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={saveUserInfo}
                    disabled={isSavingInfo}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    aria-label={common("save")}
                    title={common("save")}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setUserFieldErrors({});
                      setUserForm({
                        first_name: me.user.first_name ?? "",
                        last_name: me.user.last_name ?? "",
                        email: me.user.email ?? "",
                        phone: me.user.phone ?? "",
                        profile_picture_url: me.user.profile_picture_url ?? "",
                      });
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                    aria-label={common("cancel")}
                    title={common("cancel")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setUserForm({
                      first_name: me.user.first_name ?? "",
                      last_name: me.user.last_name ?? "",
                      email: me.user.email ?? "",
                      phone: me.user.phone ?? "",
                      profile_picture_url: me.user.profile_picture_url ?? "",
                    });
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 text-primary-700 hover:bg-primary-50 dark:border-primary-700 dark:text-primary-200 dark:hover:bg-primary-900/30"
                  aria-label={common("edit")}
                  title={common("edit")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-3">
            <div className="relative h-14 w-14">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary-100 font-semibold text-primary-800">
                {userForm.profile_picture_url ? (
                  <Image
                    src={userForm.profile_picture_url}
                    alt={t("userInfo.profilePicture")}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              {isEditing ? (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary-300 bg-white text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-primary-700 dark:bg-zinc-900 dark:text-primary-200"
                    aria-label={t("userInfo.uploadProfilePicture")}
                    title={t("userInfo.uploadProfilePicture")}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </>
              ) : null}
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("userInfo.profilePicture")}</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fullName || "-"}</p>
            </div>
          </div>
          <InputField
            label={t("userInfo.firstName")}
            value={userForm.first_name}
            disabled={!isEditing}
            error={userFieldErrors.first_name}
            onChange={(value) => {
              setUserForm((prev) => ({ ...prev, first_name: value }));
              setUserFieldErrors((prev) => ({ ...prev, first_name: undefined }));
            }}
          />
          <InputField
            label={t("userInfo.lastName")}
            value={userForm.last_name}
            disabled={!isEditing}
            error={userFieldErrors.last_name}
            onChange={(value) => {
              setUserForm((prev) => ({ ...prev, last_name: value }));
              setUserFieldErrors((prev) => ({ ...prev, last_name: undefined }));
            }}
          />
          <InputField label={t("userInfo.email")} value={userForm.email} disabled onChange={() => {}} />
          <InputField
            label={t("userInfo.phone")}
            value={userForm.phone}
            disabled={!isEditing}
            error={userFieldErrors.phone}
            onChange={(value) => {
              const sanitized = value.replace(/\D/g, "").slice(0, 9);
              setUserForm((prev) => ({ ...prev, phone: sanitized }));
              setUserFieldErrors((prev) => ({ ...prev, phone: undefined }));
            }}
          />
          <InputField label={t("userInfo.role")} value={normalizeRole(me.user.role)} disabled onChange={() => {}} />
        </div>
      </form>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-300" />
          {t("companyInfo.title")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              {me.company.logo_url ? (
                <Image
                  src={me.company.logo_url}
                  alt={t("companyInfo.logo")}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  {buildInitials(me.company.name, "")}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("companyInfo.logo")}</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{me.company.name}</p>
            </div>
          </div>
          <InputField label={t("companyInfo.name")} value={me.company.name} disabled onChange={() => {}} />
          <InputField label={t("companyInfo.email")} value={me.company.email ?? "-"} disabled onChange={() => {}} />
          <InputField label={t("companyInfo.address")} value={me.company.address ?? "-"} disabled onChange={() => {}} />
        </div>
      </section>

      <form onSubmit={handleChangePassword} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <KeyRound className="h-5 w-5 text-primary-600 dark:text-primary-300" />
          {t("password.title")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <InputField type="password" label={t("password.currentPassword")} value={passwordForm.current_password} disabled={isSavingPassword} onChange={(value) => setPasswordForm((prev) => ({ ...prev, current_password: value }))} />
          <InputField type="password" label={t("password.newPassword")} value={passwordForm.new_password} disabled={isSavingPassword} onChange={(value) => setPasswordForm((prev) => ({ ...prev, new_password: value }))} />
          <InputField type="password" label={t("password.confirmPassword")} value={passwordForm.confirm_password} disabled={isSavingPassword} onChange={(value) => setPasswordForm((prev) => ({ ...prev, confirm_password: value }))} />
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={isSavingPassword}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isSavingPassword ? common("saving") : t("password.submit")}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <HistoryIcon className="h-5 w-5 text-primary-600 dark:text-primary-300" />
          {t("history.title")}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("history.subtitle")}</p>
        <div className="mt-4 space-y-3">
          {history.items.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("history.empty")}</p>
          ) : (
            history.items.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{actionLabel(entry.action)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(entry.created_at).toLocaleString()} - {entry.actor_role ?? t("history.actorUnknown")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
      </div>
      <Snackbar
        open={toastMessage != null}
        autoHideDuration={2500}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toastSeverity}
          variant="filled"
          onClose={() => setToastMessage(null)}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </div>
  );
}

function normalizeRole(roleCode: string) {
  return roleCode
    .replace(/^ROLE_/, "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function InputField({
  label,
  value,
  disabled,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`rounded-lg border bg-white px-3 py-2 text-zinc-900 outline-none ring-primary-200 placeholder:text-zinc-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-800 ${
          error
            ? "border-red-400 focus:ring-red-200 dark:border-red-500"
            : "border-zinc-300 dark:border-zinc-600"
        }`}
      />
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </label>
  );
}
