"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createOfficialUserAccount,
  deleteOfficialProfile,
  fetchOfficialMerchantAccounts,
  fetchOfficialOutlets,
  fetchOfficialProfiles,
  upsertOfficialMerchantAccount,
  updateOfficialProfileAccess,
  updateOfficialProfileDetail,
  type OfficialMerchantAccountRow,
  type OfficialOutletRow,
  type OfficialProfileRow,
} from "@/lib/admin/official-platform";
import { AdminFilePicker } from "@/components/admin-file-picker";
import { UnifiedModal } from "@/components/unified-modal";
import { supabase } from "@/lib/supabase";
import { isValidAddress } from "@/lib/validators/address";
import { isStrongPassword } from "@/lib/validators/password";
import { isValidE164Phone, normalizePhoneToE164 } from "@/lib/validators/phone";

export default function AdminMerchantUsersPage() {
  const [rows, setRows] = useState<OfficialProfileRow[] | null>(null);
  const [merchantRows, setMerchantRows] = useState<OfficialMerchantAccountRow[] | null>(null);
  const [outlets, setOutlets] = useState<OfficialOutletRow[] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newOutletId, setNewOutletId] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editOutletId, setEditOutletId] = useState("");
  const [editStatus, setEditStatus] = useState<OfficialProfileRow["status"]>("active");
  const [editAvatarUploading, setEditAvatarUploading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [profiles, merchants, outletRows] = await Promise.all([fetchOfficialProfiles(400), fetchOfficialMerchantAccounts(), fetchOfficialOutlets()]);
    setRows(profiles);
    setMerchantRows(merchants);
    setOutlets(outletRows.filter((item) => item.is_active));
    setNewOutletId((prev) => prev || outletRows[0]?.id || "");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [reload]);

  const merchantMap = useMemo(() => new Map((merchantRows ?? []).map((row) => [row.profile_id, row])), [merchantRows]);

  const merchants = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (rows ?? [])
      .filter((row) => row.role === "merchant")
      .filter((row) => {
        if (!q) return true;
        const merchant = merchantMap.get(row.id);
        const outletName = merchant?.official_outlets?.name ?? "";
        const bucket = `${row.full_name ?? ""} ${row.phone ?? ""} ${row.email ?? ""} ${row.id} ${outletName}`.toLowerCase();
        return bucket.includes(q);
      });
  }, [keyword, merchantMap, rows]);

  const createMerchant = async () => {
    if (busyId) return;
    if (!newName.trim() || !newPhone.trim() || !newEmail.trim() || !newPassword.trim() || !newPasswordConfirm.trim() || !newAvatarUrl.trim() || !newAddress.trim() || !newOutletId) {
      setCreateMessage("请填写完整资料并选择门店");
      return;
    }
    const normalizedPhone = normalizePhoneToE164(newPhone);
    if (!isValidE164Phone(normalizedPhone)) {
      setCreateMessage("请输入有效手机号（示例：+60123456789）");
      return;
    }
    if (!isValidAddress(newAddress)) {
      setCreateMessage("地址长度需在 10 到 200 字符之间");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setCreateMessage("密码至少8位并包含大小写/数字/符号中的3类");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setCreateMessage("两次输入的密码不一致");
      return;
    }
    setBusyId("create");
    setCreateMessage(null);
    const created = await createOfficialUserAccount({
      full_name: newName,
      phone: normalizedPhone,
      email: newEmail,
      password: newPassword,
      avatar_url: newAvatarUrl,
      address: newAddress,
      role: "merchant",
      status: "active",
      outlet_id: newOutletId,
    });
    setBusyId(null);
    if (!created.ok) {
      setCreateMessage(created.message);
      return;
    }
    setShowCreateModal(false);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setNewAvatarUrl("");
    setNewAddress("");
    setCreateMessage(null);
    setMessage("Merchant 账号已创建");
    await reload();
  };

  const startEdit = (row: OfficialProfileRow) => {
    setEditId(row.id);
    setEditName(row.full_name ?? "");
    setEditPhone(row.phone ?? "");
    setEditEmail(row.email ?? "");
    setEditAvatarUrl(row.avatar_url ?? "");
    setEditAddress(row.address ?? "");
    setEditOutletId(merchantMap.get(row.id)?.outlet_id ?? "");
    setEditStatus(row.status);
    setEditMessage(null);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editId || busyId) return;
    if (!editName.trim() || !editPhone.trim() || !editEmail.trim() || !editAvatarUrl.trim() || !editAddress.trim()) {
      setEditMessage("请填写完整资料：姓名、电话、电邮、地址、头像");
      return;
    }
    const normalizedPhone = normalizePhoneToE164(editPhone);
    if (!isValidE164Phone(normalizedPhone)) {
      setEditMessage("请输入有效手机号（示例：+60123456789）");
      return;
    }
    if (!isValidAddress(editAddress)) {
      setEditMessage("地址长度需在 10 到 200 字符之间");
      return;
    }
    if (!editOutletId) {
      setEditMessage("请先选择门店");
      return;
    }
    setBusyId(editId);
    setEditMessage(null);
    const profileUpdate = await updateOfficialProfileDetail({
      id: editId,
      full_name: editName,
      phone: normalizedPhone,
      email: editEmail,
      avatar_url: editAvatarUrl,
      address: editAddress,
      role: "merchant",
      status: editStatus,
    });
    if (!profileUpdate.ok) {
      setBusyId(null);
      setEditMessage(profileUpdate.message);
      return;
    }
    const merchantUpdate = await upsertOfficialMerchantAccount({
      profile_id: editId,
      outlet_id: editOutletId,
      status: editStatus === "active" ? "active" : "disabled",
    });
    setBusyId(null);
    if (!merchantUpdate.ok) {
      setEditMessage(merchantUpdate.message);
      return;
    }
    setShowEditModal(false);
    setEditId(null);
    setEditMessage(null);
    setMessage("Merchant 信息已更新");
    await reload();
  };

  const toggleStatus = async (row: OfficialProfileRow, nextStatus: "active" | "disabled") => {
    if (busyId) return;
    setBusyId(row.id);
    setMessage(null);
    const profileUpdate = await updateOfficialProfileAccess({ id: row.id, status: nextStatus });
    if (!profileUpdate.ok) {
      setBusyId(null);
      setMessage(profileUpdate.message);
      return;
    }
    const merchant = merchantMap.get(row.id);
    if (merchant?.outlet_id) {
      await upsertOfficialMerchantAccount({ profile_id: row.id, outlet_id: merchant.outlet_id, status: nextStatus === "active" ? "active" : "disabled" });
    }
    setBusyId(null);
    setMessage(nextStatus === "active" ? "Merchant 账号已恢复" : "Merchant 账号已停用");
    await reload();
  };

  const removeMerchant = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setMessage(null);
    const removed = await deleteOfficialProfile(id);
    setBusyId(null);
    if (!removed.ok) {
      setMessage(removed.message);
      return;
    }
    setMessage("Merchant 账号已删除");
    await reload();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">MERCHANT USERS</p>
            <h1 className="mt-1 text-3xl font-black">Merchant Login 管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">管理门店扫码账号：创建、编辑、停用、删除。</p>
          </div>
          <div className="flex gap-2">
            <Link href="/merchant/rewards/scan" target="_blank" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
              打开扫码页
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreateMessage(null);
                setShowCreateModal(true);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
            >
              新增 Merchant
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索姓名/电话/电邮/门店"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
        />
        {message ? <p className="mt-2 text-xs font-bold text-primary">{message}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3">姓名</th>
                <th className="px-4 py-3">电话</th>
                <th className="px-4 py-3">电邮</th>
                <th className="px-4 py-3">门店</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((row) => {
                const merchant = merchantMap.get(row.id);
                return (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-semibold">{row.full_name ?? "-"}</td>
                    <td className="px-4 py-3">{row.phone ?? "-"}</td>
                    <td className="px-4 py-3">{row.email ?? "-"}</td>
                    <td className="px-4 py-3">{merchant?.official_outlets?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{row.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => startEdit(row)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                        >
                          编辑
                        </button>
                        {row.status === "disabled" ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void toggleStatus(row, "active")}
                            className="rounded-md border border-emerald-400 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            恢复
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void toggleStatus(row, "disabled")}
                            className="rounded-md border border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                          >
                            停用
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void removeMerchant(row.id)}
                          className="rounded-md border border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    加载中...
                  </td>
                </tr>
              )}
              {rows !== null && merchants.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    暂无 Merchant 账号
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreateModal ? (
        <UnifiedModal
          open={showCreateModal}
          size="lg"
          title="新增 Merchant Login"
          description="创建门店扫码账号，需填写登录信息与绑定门店。"
          badge="Merchant"
          onClose={() => {
            setShowCreateModal(false);
            setNewPassword("");
            setNewPasswordConfirm("");
            setCreateMessage(null);
          }}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPassword("");
                  setNewPasswordConfirm("");
                  setCreateMessage(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                取消
              </button>
              <button type="button" disabled={busyId === "create"} onClick={() => void createMerchant()} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60">
                {busyId === "create" ? "创建中..." : "确认新增"}
              </button>
            </>
          }
        >
            {createMessage ? <p className="text-xs font-bold text-rose-600">{createMessage}</p> : null}
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">基础信息</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="姓名" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                <input value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="联系电话" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                <select value={newOutletId} onChange={(event) => setNewOutletId(event.target.value)} className="md:col-span-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70">
                  <option value="">选择门店</option>
                  {(outlets ?? []).map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name} · {outlet.location}
                    </option>
                  ))}
                </select>
                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">头像上传</p>
                  <AdminFilePicker
                    className="mt-2"
                    accept="image/*"
                    disabled={avatarUploading}
                    buttonLabel={avatarUploading ? "上传中..." : "上传头像"}
                    onSelect={async (files) => {
                      const file = files[0];
                      if (!file || !supabase) return;
                      setAvatarUploading(true);
                      const ext = file.name.split(".").pop() || "jpg";
                      const path = `avatars/merchants/${Date.now()}.${ext}`;
                      const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                      setAvatarUploading(false);
                      if (error) {
                        setCreateMessage(`头像上传失败：${error.message}`);
                        return;
                      }
                      const { data } = supabase.storage.from("media").getPublicUrl(path);
                      setNewAvatarUrl(data.publicUrl);
                    }}
                  />
                  {newAvatarUrl ? (
                    <Image src={newAvatarUrl} alt="头像预览" width={80} height={80} className="mt-3 h-20 w-20 rounded-full object-cover" unoptimized />
                  ) : (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">未上传头像</p>
                  )}
                </div>
                <textarea value={newAddress} onChange={(event) => setNewAddress(event.target.value)} placeholder="联系地址" className="md:col-span-2 h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">登录信息</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="登录电邮" className="md:col-span-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="登录密码（至少8位）" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                <input type="password" value={newPasswordConfirm} onChange={(event) => setNewPasswordConfirm(event.target.value)} placeholder="确认登录密码" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              </div>
            </div>
        </UnifiedModal>
      ) : null}
      {showEditModal && editId ? (
        <UnifiedModal
          open={showEditModal}
          size="md"
          title="编辑 Merchant 账号"
          description="修改姓名、电话与绑定门店。"
          badge="Merchant"
          onClose={() => {
            setShowEditModal(false);
            setEditId(null);
            setEditMessage(null);
            setEditAvatarUploading(false);
          }}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditId(null);
                  setEditMessage(null);
                  setEditAvatarUploading(false);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                取消
              </button>
              <button type="button" disabled={busyId === editId} onClick={() => void saveEdit()} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60">
                {busyId === editId ? "保存中..." : "保存修改"}
              </button>
            </>
          }
        >
          {editMessage ? <p className="text-xs font-bold text-rose-600">{editMessage}</p> : null}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">基础信息</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="姓名" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              <input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="联系电话（+60123456789）" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              <select value={editOutletId} onChange={(event) => setEditOutletId(event.target.value)} className="md:col-span-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70">
                <option value="">选择门店</option>
                {(outlets ?? []).map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} · {outlet.location}
                  </option>
                ))}
              </select>
              <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">头像上传</p>
                <AdminFilePicker
                  className="mt-2"
                  accept="image/*"
                  disabled={editAvatarUploading}
                  buttonLabel={editAvatarUploading ? "上传中..." : "上传头像"}
                  onSelect={async (files) => {
                    const file = files[0];
                    if (!file || !supabase) return;
                    setEditAvatarUploading(true);
                    const ext = file.name.split(".").pop() || "jpg";
                    const path = `avatars/merchants/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                    setEditAvatarUploading(false);
                    if (error) {
                      setEditMessage(`头像上传失败：${error.message}`);
                      return;
                    }
                    const { data } = supabase.storage.from("media").getPublicUrl(path);
                    setEditAvatarUrl(data.publicUrl);
                  }}
                />
                {editAvatarUrl ? (
                  <Image src={editAvatarUrl} alt="头像预览" width={80} height={80} className="mt-3 h-20 w-20 rounded-full object-cover" unoptimized />
                ) : (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">未上传头像</p>
                )}
              </div>
              <textarea value={editAddress} onChange={(event) => setEditAddress(event.target.value)} placeholder="联系地址" className="md:col-span-2 h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">登录信息</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} placeholder="登录电邮" className="md:col-span-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              <p className="md:col-span-2 text-xs text-slate-500 dark:text-slate-300">密码修改请走重置密码流程（后续可加“发送重置链接”）。</p>
            </div>
          </div>
        </UnifiedModal>
      ) : null}
    </div>
  );
}
