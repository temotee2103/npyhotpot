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
import { isStrongPassword } from "@/lib/validators/password";

function FormField({
  title,
  children,
  description,
}: {
  title: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <label className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-3">
      <span className="pt-2">
        <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">{title}</span>
        {description ? <span className="mt-1 block text-xs text-slate-500 dark:text-slate-300">{description}</span> : null}
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}

export default function AdminManagerUsersPage() {
  const [rows, setRows] = useState<OfficialProfileRow[] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "super_admin">("admin");
  const [currentAdminRole, setCurrentAdminRole] = useState<OfficialProfileRow["role"] | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<OfficialProfileRow["role"]>("admin");
  const [editStatus, setEditStatus] = useState<OfficialProfileRow["status"]>("active");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;
    const client = supabase;
    if (!client) return;
    const loadCurrentAdminRole = async () => {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!active || !userId) return;
      const { data } = await client.from("official_profiles").select("role").eq("id", userId).maybeSingle();
      if (!active) return;
      setCurrentAdminRole(((data as { role?: OfficialProfileRow["role"] } | null)?.role ?? null) as OfficialProfileRow["role"] | null);
    };
    void loadCurrentAdminRole();
    return () => {
      active = false;
    };
  }, []);

  const admins = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (rows ?? [])
      .filter((row) => row.role === "admin" || row.role === "super_admin")
      .filter((row) => {
        if (!q) return true;
        const bucket = `${row.full_name ?? ""} ${row.phone ?? ""} ${row.id} ${row.role}`.toLowerCase();
        return bucket.includes(q);
      });
  }, [rows, keyword]);

  const applyAction = async (id: string, action: "demote_customer" | "disable" | "activate") => {
    if (busyId) return;
    setBusyId(id);
    setMessage(null);
    const update =
      action === "demote_customer"
        ? await updateOfficialProfileAccess({ id, role: "customer", status: "active" })
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
    setMessage(action === "demote_customer" ? "已降级为普通用户" : action === "disable" ? "管理员账号已禁用" : "管理员账号已恢复");
  };

  const createAdmin = async () => {
    if (busyId) return;
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setCreateMessage("请填写完整资料：名字、角色与登录信息");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setCreateMessage("密码至少8位并包含大小写/数字/符号中的3类");
      return;
    }
    if (newRole === "super_admin" && currentAdminRole !== "super_admin") {
      setCreateMessage("只有 Super_Admin 才能新增 Super_Admin。");
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
      email: newEmail,
      password: newPassword,
      avatar_url: "",
      address: "",
      role: newRole,
      status: "active",
    });
    if (!created.ok) {
      setCreateMessage(created.message);
      setBusyId(null);
      return;
    }
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setCreateMessage(null);
    setNewRole("admin");
    setShowCreateModal(false);
    await reload();
    setBusyId(null);
    setMessage("已新增管理员");
  };

  const startEdit = (row: OfficialProfileRow) => {
    setEditId(row.id);
    setEditName(row.full_name ?? "");
    setEditEmail(row.email ?? "");
    setEditRole(row.role);
    setEditStatus(row.status);
    setEditMessage(null);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editId || busyId) return;
    if (!editName.trim() || !editEmail.trim()) {
      setEditMessage("请填写完整资料：名字、角色与登录信息");
      return;
    }
    if (editRole === "super_admin" && currentAdminRole !== "super_admin") {
      setEditMessage("只有 Super_Admin 才能设置 Super_Admin 角色。");
      return;
    }
    setBusyId(editId);
    setEditMessage(null);
    const update = await updateOfficialProfileDetail({
      id: editId,
      full_name: editName,
      email: editEmail,
      role: editRole,
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
    setMessage("已保存管理员信息");
  };

  const removeAdmin = async (id: string) => {
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
    setMessage("已删除管理员账号");
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">ADMIN USERS</p>
            <h1 className="mt-1 text-3xl font-black">管理员管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">支持搜索、禁用/恢复、降级管理员（super_admin 受保护）。</p>
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
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            新增管理员
          </button>
        </div>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索姓名/电话/角色/用户ID"
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
        />
        {message ? <p className="mt-2 text-xs font-bold text-primary">{message}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3">姓名</th>
                <th className="px-4 py-3">电话</th>
                <th className="px-4 py-3">角色</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((row) => {
                const protectedRow = row.role === "super_admin";
                return (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-semibold">{row.full_name ?? "-"}</td>
                    <td className="px-4 py-3">{row.phone ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.role === "super_admin" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
                        {row.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{row.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === row.id || protectedRow}
                          onClick={() => startEdit(row)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id || protectedRow}
                          onClick={() => void applyAction(row.id, "demote_customer")}
                          className="rounded-md border border-primary/40 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          降级为用户
                        </button>
                        {row.status === "disabled" ? (
                          <button
                            type="button"
                            disabled={busyId === row.id || protectedRow}
                            onClick={() => void applyAction(row.id, "activate")}
                            className="rounded-md border border-emerald-400 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            恢复
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === row.id || protectedRow}
                            onClick={() => void applyAction(row.id, "disable")}
                            className="rounded-md border border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            禁用
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === row.id || protectedRow}
                          onClick={() => void removeAdmin(row.id)}
                          className="rounded-md border border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
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
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    加载中...
                  </td>
                </tr>
              )}
              {rows !== null && admins.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    暂无管理员
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
          title="新增管理员"
          description="只保留名字、角色与登录信息，创建后可直接登录系统后台。"
          badge="Admin"
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
              <button
                type="button"
                disabled={busyId === "create"}
                onClick={() => void createAdmin()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busyId === "create" ? "创建中..." : "确认新增"}
              </button>
            </>
          }
        >
          {createMessage ? <p className="text-xs font-bold text-rose-600">{createMessage}</p> : null}
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">名字</p>
              <div className="mt-3">
                <FormField title="管理员名字">
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
                  />
                </FormField>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">角色</p>
              <div className="mt-3">
                <FormField title="管理员角色">
                  <select
                    value={newRole}
                    onChange={(event) => setNewRole(event.target.value as "admin" | "super_admin")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin" disabled={currentAdminRole !== "super_admin"}>
                      Super_Admin
                    </option>
                  </select>
                </FormField>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">登录信息</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <FormField title="登录邮箱">
                  <input
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
                  />
                </FormField>
                <FormField title="登录密码">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
                  />
                </FormField>
                <FormField title="确认登录密码">
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(event) => setNewPasswordConfirm(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
                  />
                </FormField>
              </div>
            </div>
          </div>
        </UnifiedModal>
      ) : null}
      {showEditModal && editId ? (
        <UnifiedModal
          open={showEditModal}
          size="md"
          title="编辑管理员"
          description="只保留名字、角色与登录信息。"
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
          {editMessage ? <p className="text-xs font-bold text-rose-600">{editMessage}</p> : null}
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">名字</p>
              <div className="mt-3">
                <FormField title="管理员名字">
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                </FormField>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">角色</p>
              <div className="mt-3">
                <FormField title="管理员角色">
                  <select
                    value={editRole}
                    onChange={(event) => setEditRole(event.target.value as OfficialProfileRow["role"])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin" disabled={currentAdminRole !== "super_admin"}>
                      Super_Admin
                    </option>
                  </select>
                </FormField>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">登录信息</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <FormField title="登录邮箱">
                  <input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                </FormField>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">密码修改请走重置密码流程；如需要我可以下一步再帮你补“发送重置密码链接”。</p>
            </div>
          </div>
        </UnifiedModal>
      ) : null}
    </div>
  );
}
