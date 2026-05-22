"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createOfficialUserAccount,
  deleteOfficialProfile,
  fetchOfficialProfiles,
  updateOfficialProfileAccess,
  updateOfficialProfileDetail,
  type OfficialProfileRow,
} from "@/lib/admin/official-platform";
import { UnifiedModal } from "@/components/unified-modal";
import { supabase } from "@/lib/supabase";
import { isValidAddress } from "@/lib/validators/address";
import { isStrongPassword } from "@/lib/validators/password";
import { isValidE164Phone, normalizePhoneToE164 } from "@/lib/validators/phone";

type CustomerOrderRecord = {
  id: string;
  channel: "shop" | "delivery";
  total: number;
  status: string;
  created_at: string;
  official_outlets?: { name?: string | null } | null;
};

type CustomerDineInRecord = {
  id: string;
  spend_amount: number;
  points_amount: number;
  status: "submitted" | "approved" | "rejected";
  submitted_at: string;
  official_outlets?: { name?: string | null } | null;
};

type AddressParts = {
  address1: string;
  address2: string;
  postalCode: string;
  state: string;
  country: string;
};

function composeAddressParts(parts: AddressParts): string {
  return [parts.address1, parts.address2, parts.postalCode, parts.state, parts.country].map((item) => item.trim()).join(" | ");
}

function inferStateCountryByPostal(postalCode: string): { state: string; country: string } | null {
  const compact = postalCode.trim().toUpperCase();
  if (!compact) return null;
  if (/^\d{6}$/.test(compact)) return { state: "", country: "Singapore" };
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(compact)) return { state: "", country: "United Kingdom" };
  const normalized = compact.replace(/\D/g, "");
  if (/^\d{5}$/.test(normalized)) {
    const prefix = Number(normalized.slice(0, 2));
    if (prefix >= 0 && prefix <= 2) return { state: "Perlis", country: "Malaysia" };
    if (prefix >= 5 && prefix <= 9) return { state: "Kedah", country: "Malaysia" };
    if (prefix >= 10 && prefix <= 14) return { state: "Kelantan", country: "Malaysia" };
    if (prefix >= 15 && prefix <= 18) return { state: "Terengganu", country: "Malaysia" };
    if (prefix >= 20 && prefix <= 24) return { state: "Pahang", country: "Malaysia" };
    if (prefix >= 25 && prefix <= 28) return { state: "Johor", country: "Malaysia" };
    if (prefix >= 30 && prefix <= 36) return { state: "Perak", country: "Malaysia" };
    if (prefix >= 40 && prefix <= 48) return { state: "Selangor", country: "Malaysia" };
    if (prefix >= 50 && prefix <= 60) return { state: "Kuala Lumpur", country: "Malaysia" };
    if (prefix >= 62 && prefix <= 64) return { state: "Putrajaya", country: "Malaysia" };
    if (prefix >= 70 && prefix <= 73) return { state: "Negeri Sembilan", country: "Malaysia" };
    if (prefix >= 75 && prefix <= 78) return { state: "Melaka", country: "Malaysia" };
    if (prefix >= 79 && prefix <= 86) return { state: "Johor", country: "Malaysia" };
    if (prefix >= 87 && prefix <= 91) return { state: "Sabah", country: "Malaysia" };
    if (prefix >= 93 && prefix <= 98) return { state: "Sarawak", country: "Malaysia" };
    return { state: "", country: "Malaysia" };
  }
  if (/^\d{5}(-\d{4})?$/.test(compact)) return { state: "", country: "United States" };
  if (normalized.length < 2) return null;
  const prefix = Number(normalized.slice(0, 2));
  if (Number.isNaN(prefix)) return null;
  if (prefix >= 0 && prefix <= 2) return { state: "Perlis", country: "Malaysia" };
  if (prefix >= 5 && prefix <= 9) return { state: "Kedah", country: "Malaysia" };
  if (prefix >= 10 && prefix <= 14) return { state: "Kelantan", country: "Malaysia" };
  if (prefix >= 15 && prefix <= 18) return { state: "Terengganu", country: "Malaysia" };
  if (prefix >= 20 && prefix <= 24) return { state: "Pahang", country: "Malaysia" };
  if (prefix >= 25 && prefix <= 28) return { state: "Johor", country: "Malaysia" };
  if (prefix >= 30 && prefix <= 36) return { state: "Perak", country: "Malaysia" };
  if (prefix >= 40 && prefix <= 48) return { state: "Selangor", country: "Malaysia" };
  if (prefix >= 50 && prefix <= 60) return { state: "Kuala Lumpur", country: "Malaysia" };
  if (prefix >= 62 && prefix <= 64) return { state: "Putrajaya", country: "Malaysia" };
  if (prefix >= 70 && prefix <= 73) return { state: "Negeri Sembilan", country: "Malaysia" };
  if (prefix >= 75 && prefix <= 78) return { state: "Melaka", country: "Malaysia" };
  if (prefix >= 79 && prefix <= 86) return { state: "Johor", country: "Malaysia" };
  if (prefix >= 87 && prefix <= 91) return { state: "Sabah", country: "Malaysia" };
  if (prefix >= 93 && prefix <= 98) return { state: "Sarawak", country: "Malaysia" };
  return null;
}

function normalizeReferralCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

function splitAddressParts(address: string | null | undefined): AddressParts {
  const [address1 = "", address2 = "", postalCode = "", state = "", country = "Malaysia"] = (address ?? "")
    .split("|")
    .map((item) => item.trim());
  return {
    address1,
    address2,
    postalCode,
    state,
    country: country || "Malaysia",
  };
}

export default function AdminCustomerUsersPage() {
  const [rows, setRows] = useState<OfficialProfileRow[] | null>(null);
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
  const [newAddress1, setNewAddress1] = useState("");
  const [newAddress2, setNewAddress2] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newState, setNewState] = useState("");
  const [newCountry, setNewCountry] = useState("Malaysia");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newReferralCode, setNewReferralCode] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress1, setEditAddress1] = useState("");
  const [editAddress2, setEditAddress2] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editState, setEditState] = useState("");
  const [editCountry, setEditCountry] = useState("Malaysia");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editStatus, setEditStatus] = useState<OfficialProfileRow["status"]>("active");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<OfficialProfileRow | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderRecord[]>([]);
  const [customerDineInRecords, setCustomerDineInRecords] = useState<CustomerDineInRecord[]>([]);

  const reload = useCallback(async () => {
    const list = await fetchOfficialProfiles(300);
    setRows(list);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [reload]);

  const customers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (rows ?? [])
      .filter((row) => row.role === "customer")
      .filter((row) => {
        if (!q) return true;
        const bucket = `${row.full_name ?? ""} ${row.phone ?? ""} ${row.id}`.toLowerCase();
        return bucket.includes(q);
      });
  }, [rows, keyword]);

  const applyAction = async (id: string, action: "promote_admin" | "disable" | "activate") => {
    if (busyId) return;
    setBusyId(id);
    setMessage(null);
    const update =
      action === "promote_admin"
        ? await updateOfficialProfileAccess({ id, role: "admin", status: "active" })
        : action === "disable"
          ? await updateOfficialProfileAccess({ id, status: "disabled" })
          : await updateOfficialProfileAccess({ id, status: "active" });
    if (!update.ok) {
      setMessage(update.message);
      setBusyId(null);
      return;
    }
    await reload();
    setBusyId(null);
    setMessage(action === "promote_admin" ? "已升级为管理员" : action === "disable" ? "账号已禁用" : "账号已恢复");
  };

  const createUser = async () => {
    if (busyId) return;
    if (!newName.trim() || !newPhone.trim() || !newEmail.trim() || !newAddress1.trim() || !newPostalCode.trim() || !newBirthDate.trim() || !newPassword.trim()) {
      setCreateMessage("请填写完整资料：姓名、电话、电邮、生日、地址、邮编与登录密码");
      return;
    }
    const normalizedPhone = normalizePhoneToE164(newPhone);
    if (!isValidE164Phone(normalizedPhone)) {
      setCreateMessage("请输入有效手机号（示例：+60123456789）");
      return;
    }
    const mergedAddress = composeAddressParts({
      address1: newAddress1,
      address2: newAddress2,
      postalCode: newPostalCode,
      state: newState,
      country: newCountry,
    });
    if (!isValidAddress(mergedAddress)) {
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
      address: mergedAddress,
      birth_date: newBirthDate,
      referral_code: newReferralCode,
      role: "customer",
      status: "active",
    });
    if (!created.ok) {
      setCreateMessage(created.message);
      setBusyId(null);
      return;
    }
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setNewAddress1("");
    setNewAddress2("");
    setNewPostalCode("");
    setNewState("");
    setNewCountry("Malaysia");
    setNewBirthDate("");
    setNewReferralCode("");
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
    setCreateMessage(null);
    setShowCreateModal(false);
    await reload();
    setBusyId(null);
    setMessage("已新增普通用户");
  };

  const startEdit = (row: OfficialProfileRow) => {
    const addressParts = splitAddressParts(row.address);
    setEditId(row.id);
    setEditName(row.full_name ?? "");
    setEditPhone(row.phone ?? "");
    setEditEmail(row.email ?? "");
    setEditAddress1(addressParts.address1);
    setEditAddress2(addressParts.address2);
    setEditPostalCode(addressParts.postalCode);
    setEditState(addressParts.state);
    setEditCountry(addressParts.country);
    setEditBirthDate(row.birth_date ?? "");
    setEditStatus(row.status);
    setEditMessage(null);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editId || busyId) return;
    if (!editName.trim() || !editPhone.trim() || !editEmail.trim() || !editAddress1.trim() || !editPostalCode.trim() || !editBirthDate.trim()) {
      setEditMessage("请填写完整资料：姓名、电话、电邮、生日、地址与邮编");
      return;
    }
    const normalizedPhone = normalizePhoneToE164(editPhone);
    if (!isValidE164Phone(normalizedPhone)) {
      setEditMessage("请输入有效手机号（示例：+60123456789）");
      return;
    }
    const mergedAddress = composeAddressParts({
      address1: editAddress1,
      address2: editAddress2,
      postalCode: editPostalCode,
      state: editState,
      country: editCountry,
    });
    if (!isValidAddress(mergedAddress)) {
      setEditMessage("地址长度需在 10 到 200 字符之间");
      return;
    }
    setBusyId(editId);
    setEditMessage(null);
    const update = await updateOfficialProfileDetail({
      id: editId,
      full_name: editName,
      phone: normalizedPhone,
      email: editEmail,
      address: mergedAddress,
      birth_date: editBirthDate,
      role: "customer",
      status: editStatus,
    });
    if (!update.ok) {
      setEditMessage(update.message);
      setBusyId(null);
      return;
    }
    setShowEditModal(false);
    setEditId(null);
    setEditMessage(null);
    await reload();
    setBusyId(null);
    setMessage("已保存用户信息");
  };

  const removeUser = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setMessage(null);
    const removed = await deleteOfficialProfile(id);
    if (!removed.ok) {
      setMessage(removed.message);
      setBusyId(null);
      return;
    }
    await reload();
    setBusyId(null);
    setMessage("已删除用户");
  };

  const openCustomerDetail = async (row: OfficialProfileRow) => {
    setSelectedCustomer(row);
    setCustomerDetailLoading(true);
    if (!supabase) {
      setCustomerOrders([]);
      setCustomerDineInRecords([]);
      setCustomerDetailLoading(false);
      return;
    }
    const [ordersRes, dineInRes] = await Promise.all([
      supabase
        .from("official_orders")
        .select("id,channel,total,status,created_at,official_outlets(name)")
        .eq("user_id", row.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("official_member_rewards_accruals")
        .select("id,spend_amount,points_amount,status,submitted_at,official_outlets(name)")
        .eq("member_user_id", row.id)
        .order("submitted_at", { ascending: false })
        .limit(100),
    ]);
    setCustomerOrders((ordersRes.data ?? []) as CustomerOrderRecord[]);
    setCustomerDineInRecords((dineInRes.data ?? []) as CustomerDineInRecord[]);
    setCustomerDetailLoading(false);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">CUSTOMER USERS</p>
            <h1 className="mt-1 text-3xl font-black">普通用户管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">支持搜索、禁用/恢复、升级管理员。</p>
          </div>
          <Link href="/admin/users?channel=all" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
            返回用户总览
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
          >
            新增用户
          </button>
        </div>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索姓名/电话/用户ID"
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
        />
        {message ? <p className="mt-2 text-xs font-bold text-primary">{message}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3">姓名</th>
                <th className="px-4 py-3">电话</th>
                <th className="px-4 py-3">等级</th>
                <th className="px-4 py-3">累计消费</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">注册时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => void openCustomerDetail(row)} className="font-semibold text-primary hover:underline">
                      {row.full_name ?? "-"}
                    </button>
                  </td>
                  <td className="px-4 py-3">{row.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">{row.membership_tier}</span>
                  </td>
                  <td className="px-4 py-3">RM {Number(row.cumulative_spend_myr ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{row.status}</span>
                  </td>
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleString()}</td>
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
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void applyAction(row.id, "promote_admin")}
                        className="rounded-md border border-primary/40 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
                      >
                        升级管理员
                      </button>
                      {row.status === "disabled" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void applyAction(row.id, "activate")}
                          className="rounded-md border border-emerald-400 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          恢复
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void applyAction(row.id, "disable")}
                          className="rounded-md border border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          禁用
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void removeUser(row.id)}
                        className="rounded-md border border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    加载中...
                  </td>
                </tr>
              )}
              {rows !== null && customers.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    暂无普通用户
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
          title="新增普通用户"
          description="表单结构与前台 /register 一致，创建后可直接登录系统。"
          badge="Customer"
          onClose={() => {
            setShowCreateModal(false);
            setNewPassword("");
            setNewPasswordConfirm("");
            setShowNewPassword(false);
            setShowNewPasswordConfirm(false);
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
                  setShowNewPassword(false);
                  setShowNewPasswordConfirm(false);
                  setCreateMessage(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busyId === "create"}
                onClick={() => void createUser()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busyId === "create" ? "创建中..." : "确认新增"}
              </button>
            </>
          }
        >
          {createMessage ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">{createMessage}</p> : null}
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--theme-muted-soft)]">账号资料</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">姓名</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">badge</span>
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="请输入姓名"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">手机号</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">call</span>
                  <input
                    value={newPhone}
                    onChange={(event) => setNewPhone(event.target.value.replace(/[^\d+\-\s]/g, "").slice(0, 24))}
                    placeholder="+60123456789"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">密码</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">lock</span>
                  <input
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="请输入密码"
                    type={showNewPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-11 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--theme-muted-soft)] transition-colors hover:text-[color:var(--theme-muted-strong)]" type="button" onClick={() => setShowNewPassword((prev) => !prev)}>
                    <span className="material-symbols-outlined">{showNewPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">确认密码</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">verified_user</span>
                  <input
                    value={newPasswordConfirm}
                    onChange={(event) => setNewPasswordConfirm(event.target.value)}
                    placeholder="请再次输入密码"
                    type={showNewPasswordConfirm ? "text" : "password"}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-11 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--theme-muted-soft)] transition-colors hover:text-[color:var(--theme-muted-strong)]" type="button" onClick={() => setShowNewPasswordConfirm((prev) => !prev)}>
                    <span className="material-symbols-outlined">{showNewPasswordConfirm ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">邮箱</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">mail</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="请输入邮箱"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">生日日期</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">cake</span>
                  <input
                    type="date"
                    value={newBirthDate}
                    onChange={(event) => setNewBirthDate(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--theme-muted-soft)]">地址资料</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">home_pin</span>
                <input
                  value={newAddress1}
                  onChange={(event) => setNewAddress1(event.target.value)}
                  placeholder="地址 1"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">map</span>
                <input
                  value={newAddress2}
                  onChange={(event) => setNewAddress2(event.target.value)}
                  placeholder="地址 2（可选）"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">markunread_mailbox</span>
                <input
                  value={newPostalCode}
                  onChange={(event) => {
                    const value = event.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 12);
                    setNewPostalCode(value);
                    const inferred = inferStateCountryByPostal(value);
                    if (inferred) {
                      setNewState(inferred.state);
                      setNewCountry(inferred.country);
                    }
                  }}
                  placeholder="邮编（例如 50450）"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">location_city</span>
                <input
                  value={newState}
                  readOnly
                  placeholder="州属（根据邮编自动填入）"
                  className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--theme-muted)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all"
                />
              </div>
              <div className="relative md:col-span-2">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">public</span>
                <input
                  value={newCountry}
                  readOnly
                  placeholder="国家"
                  className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--theme-muted)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--theme-muted-soft)]">推荐信息</p>
            <div className="mt-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">group_add</span>
                <input
                  value={newReferralCode}
                  onChange={(event) => setNewReferralCode(normalizeReferralCode(event.target.value))}
                  placeholder="可选填写推荐码"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        </UnifiedModal>
      ) : null}
      {showEditModal && editId ? (
        <UnifiedModal
          open={showEditModal}
          size="lg"
          title="编辑普通用户"
          description="表单结构与新增普通用户一致，方便统一维护。"
          onClose={() => {
            setShowEditModal(false);
            setEditId(null);
            setEditMessage(null);
          }}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditId(null);
                  setEditMessage(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busyId === editId}
                onClick={() => void saveEdit()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busyId === editId ? "保存中..." : "保存修改"}
              </button>
            </>
          }
        >
          {editMessage ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">{editMessage}</p> : null}
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--theme-muted-soft)]">账号资料</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">姓名</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">badge</span>
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    placeholder="请输入姓名"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">手机号</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">call</span>
                  <input
                    value={editPhone}
                    onChange={(event) => setEditPhone(event.target.value.replace(/[^\d+\-\s]/g, "").slice(0, 24))}
                    placeholder="+60123456789"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">邮箱</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">mail</span>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(event) => setEditEmail(event.target.value)}
                    placeholder="请输入邮箱"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">生日日期</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">cake</span>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(event) => setEditBirthDate(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--theme-muted-soft)]">地址资料</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">home_pin</span>
                <input
                  value={editAddress1}
                  onChange={(event) => setEditAddress1(event.target.value)}
                  placeholder="地址 1"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">map</span>
                <input
                  value={editAddress2}
                  onChange={(event) => setEditAddress2(event.target.value)}
                  placeholder="地址 2（可选）"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">markunread_mailbox</span>
                <input
                  value={editPostalCode}
                  onChange={(event) => {
                    const value = event.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 12);
                    setEditPostalCode(value);
                    const inferred = inferStateCountryByPostal(value);
                    if (inferred) {
                      setEditState(inferred.state);
                      setEditCountry(inferred.country);
                    }
                  }}
                  placeholder="邮编（例如 50450）"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">location_city</span>
                <input
                  value={editState}
                  readOnly
                  placeholder="州属（根据邮编自动填入）"
                  className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--theme-muted)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all"
                />
              </div>
              <div className="relative md:col-span-2">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">public</span>
                <input
                  value={editCountry}
                  readOnly
                  placeholder="国家"
                  className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--theme-muted)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--theme-muted-soft)]">登录信息</p>
            <p className="mt-2 text-xs text-[color:var(--theme-muted)]">密码修改请走重置密码流程，当前编辑页仅维护账号资料与地址资料。</p>
          </div>
        </UnifiedModal>
      ) : null}
      {selectedCustomer ? (
        <UnifiedModal
          open={Boolean(selectedCustomer)}
          size="xl"
          title={selectedCustomer.full_name?.trim() || "用户详情"}
          description="展示个人信息、线上订单与到店扫码消费记录。"
          onClose={() => {
            setSelectedCustomer(null);
            setCustomerOrders([]);
            setCustomerDineInRecords([]);
            setCustomerDetailLoading(false);
          }}
          actions={
            <button
              type="button"
              onClick={() => {
                setSelectedCustomer(null);
                setCustomerOrders([]);
                setCustomerDineInRecords([]);
                setCustomerDetailLoading(false);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
            >
              关闭
            </button>
          }
        >
          <div className="space-y-4">
            {(() => {
              const detailAddress = splitAddressParts(selectedCustomer.address);
              return (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--theme-muted-soft)]">账号资料</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">手机号</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{selectedCustomer.phone ?? "-"}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">邮箱</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{selectedCustomer.email ?? "-"}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">生日日期</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{selectedCustomer.birth_date || "-"}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">会员等级</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{selectedCustomer.membership_tier}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">累计消费（档案）</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">RM {Number(selectedCustomer.cumulative_spend_myr ?? 0).toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">账号状态</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{selectedCustomer.status}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--theme-muted-soft)]">地址资料</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">地址 1</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{detailAddress.address1 || "-"}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">地址 2</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{detailAddress.address2 || "-"}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">邮编</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{detailAddress.postalCode || "-"}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-[color:var(--theme-muted)]">州属</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{detailAddress.state || "-"}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3 md:col-span-2">
                        <p className="text-xs text-[color:var(--theme-muted)]">国家</p>
                        <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{detailAddress.country || "-"}</p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
            {customerDetailLoading ? <p className="text-sm text-slate-500 dark:text-slate-300">加载消费记录中...</p> : null}
            {!customerDetailLoading ? (
              <>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">线上订单记录（商城 + 外卖）</p>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                          <th className="px-3 py-2">时间</th>
                          <th className="px-3 py-2">渠道</th>
                          <th className="px-3 py-2">金额</th>
                          <th className="px-3 py-2">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerOrders.map((order) => (
                          <tr key={order.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2">{new Date(order.created_at).toLocaleString()}</td>
                            <td className="px-3 py-2">{order.channel === "shop" ? "商城" : "外卖"}</td>
                            <td className="px-3 py-2">RM {Number(order.total ?? 0).toFixed(2)}</td>
                            <td className="px-3 py-2">{order.status || "-"}</td>
                          </tr>
                        ))}
                        {customerOrders.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500 dark:text-slate-300">
                              暂无线上订单
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">门店扫码消费记录（到店）</p>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                          <th className="px-3 py-2">时间</th>
                          <th className="px-3 py-2">门店</th>
                          <th className="px-3 py-2">消费金额</th>
                          <th className="px-3 py-2">积分</th>
                          <th className="px-3 py-2">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerDineInRecords.map((record) => (
                          <tr key={record.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2">{new Date(record.submitted_at).toLocaleString()}</td>
                            <td className="px-3 py-2">{record.official_outlets?.name?.trim() || "未知门店"}</td>
                            <td className="px-3 py-2">RM {Number(record.spend_amount ?? 0).toFixed(2)}</td>
                            <td className="px-3 py-2">{Number(record.points_amount ?? 0).toFixed(0)}</td>
                            <td className="px-3 py-2">{record.status}</td>
                          </tr>
                        ))}
                        {customerDineInRecords.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-slate-500 dark:text-slate-300">
                              暂无门店扫码记录
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </UnifiedModal>
      ) : null}
    </div>
  );
}
