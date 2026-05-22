"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createOfficialOutlet, deleteOfficialOutlet, fetchOfficialOutlets, updateOfficialOutlet, type OfficialOutletRow } from "@/lib/admin/official-platform";
import { UnifiedModal } from "@/components/unified-modal";
import { UnifiedTable } from "@/components/unified-table";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type DaySchedule = { open: boolean; start: string; end: string };
type WeeklySchedule = Record<DayKey, DaySchedule>;

const dayRows: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "周一" },
  { key: "tue", label: "周二" },
  { key: "wed", label: "周三" },
  { key: "thu", label: "周四" },
  { key: "fri", label: "周五" },
  { key: "sat", label: "周六" },
  { key: "sun", label: "周日" },
];

const buildDefaultSchedule = (): WeeklySchedule => ({
  mon: { open: true, start: "10:00", end: "22:00" },
  tue: { open: true, start: "10:00", end: "22:00" },
  wed: { open: true, start: "10:00", end: "22:00" },
  thu: { open: true, start: "10:00", end: "22:00" },
  fri: { open: true, start: "10:00", end: "22:00" },
  sat: { open: true, start: "10:00", end: "22:00" },
  sun: { open: true, start: "10:00", end: "22:00" },
});

const parseWeeklySchedule = (value: string): WeeklySchedule | null => {
  if (!value.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Record<DayKey, Partial<DaySchedule>>>;
    const next = buildDefaultSchedule();
    for (const row of dayRows) {
      const item = parsed[row.key];
      if (!item) continue;
      next[row.key] = {
        open: Boolean(item.open),
        start: typeof item.start === "string" ? item.start : next[row.key].start,
        end: typeof item.end === "string" ? item.end : next[row.key].end,
      };
    }
    return next;
  } catch {
    return null;
  }
};

const formatWeeklySchedule = (schedule: WeeklySchedule) => {
  const opened = dayRows
    .filter((row) => schedule[row.key].open)
    .map((row) => `${row.label} ${schedule[row.key].start}-${schedule[row.key].end}`);
  return opened.length ? opened.join(" | ") : "休息";
};

export default function AdminDeliveryOutletsPage() {
  const [rows, setRows] = useState<OfficialOutletRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newSchedule, setNewSchedule] = useState<WeeklySchedule>(buildDefaultSchedule());
  const [newActive, setNewActive] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editSchedule, setEditSchedule] = useState<WeeklySchedule>(buildDefaultSchedule());
  const [editActive, setEditActive] = useState(true);

  const reload = useCallback(async () => {
    const data = await fetchOfficialOutlets();
    setRows(data);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [reload]);

  const visibleRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      if (!q) return true;
      const parsed = parseWeeklySchedule(row.operating_hours);
      const hoursText = parsed ? formatWeeklySchedule(parsed) : row.operating_hours;
      const bucket = `${row.name} ${row.location} ${hoursText}`.toLowerCase();
      return bucket.includes(q);
    });
  }, [keyword, rows]);

  const createOutlet = async () => {
    if (busyId) return;
    if (!newName.trim() || !newLocation.trim()) {
      setMessage("请填写分店名称和地址");
      return;
    }
    const anyOpen = dayRows.some((row) => newSchedule[row.key].open);
    if (!anyOpen) {
      setMessage("请至少勾选一天为营业日");
      return;
    }
    setBusyId("create");
    setMessage(null);
    const created = await createOfficialOutlet({
      name: newName,
      location: newLocation,
      operating_hours: JSON.stringify(newSchedule),
      is_active: newActive,
    });
    setBusyId(null);
    if (!created.ok) {
      setMessage(created.message);
      return;
    }
    setShowCreate(false);
    setNewName("");
    setNewLocation("");
    setNewSchedule(buildDefaultSchedule());
    setNewActive(true);
    setMessage("分店已新增");
    await reload();
  };

  const startEdit = (row: OfficialOutletRow) => {
    setEditId(row.id);
    setEditName(row.name);
    setEditLocation(row.location);
    setEditSchedule(parseWeeklySchedule(row.operating_hours) ?? buildDefaultSchedule());
    setEditActive(row.is_active);
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editId || busyId) return;
    if (!editName.trim() || !editLocation.trim()) {
      setMessage("请填写完整信息后再保存");
      return;
    }
    const anyOpen = dayRows.some((row) => editSchedule[row.key].open);
    if (!anyOpen) {
      setMessage("请至少勾选一天为营业日");
      return;
    }
    setBusyId(editId);
    setMessage(null);
    const updated = await updateOfficialOutlet({
      id: editId,
      name: editName,
      location: editLocation,
      operating_hours: JSON.stringify(editSchedule),
      is_active: editActive,
    });
    setBusyId(null);
    if (!updated.ok) {
      setMessage(updated.message);
      return;
    }
    setEditId(null);
    setShowEdit(false);
    setMessage("分店信息已更新");
    await reload();
  };

  const removeOutlet = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setMessage(null);
    const removed = await deleteOfficialOutlet(id);
    setBusyId(null);
    if (!removed.ok) {
      setMessage(removed.message);
      return;
    }
    setMessage("分店已删除");
    await reload();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">分店管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">可新增、编辑、停用与删除分店，供配送与 Merchant 绑定使用。</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
            新增分店
          </button>
        </div>
      </section>

      <UnifiedTable>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索分店名称/地址/营业时间"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
        />
        {message ? <p className="mt-2 text-xs font-bold text-primary">{message}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3">分店名称</th>
                <th className="px-4 py-3">地址</th>
                <th className="px-4 py-3">营业时间</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">{row.location}</td>
                  <td className="px-4 py-3">{parseWeeklySchedule(row.operating_hours) ? formatWeeklySchedule(parseWeeklySchedule(row.operating_hours) as WeeklySchedule) : row.operating_hours}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"}`}>
                      {row.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => startEdit(row)} disabled={busyId === row.id} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60">
                        编辑
                      </button>
                      <button type="button" onClick={() => void removeOutlet(row.id)} disabled={busyId === row.id} className="rounded-md border border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    加载中...
                  </td>
                </tr>
              )}
              {rows !== null && visibleRows.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    暂无分店
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </UnifiedTable>

      {showCreate ? (
        <UnifiedModal
          open={showCreate}
          size="md"
          title="新增分店"
          description="请填写分店基础资料与每周营业时间。"
          onClose={() => setShowCreate(false)}
          actions={
            <>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60">
                取消
              </button>
              <button type="button" disabled={busyId === "create"} onClick={() => void createOutlet()} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60">
                {busyId === "create" ? "创建中..." : "确认新增"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="分店名称" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
            <input value={newLocation} onChange={(event) => setNewLocation(event.target.value)} placeholder="分店地址" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">营业时间（按星期设置）</p>
              <div className="mt-2 space-y-2">
                {dayRows.map((row) => (
                  <div key={row.key} className="grid grid-cols-[78px_1fr_1fr] items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={newSchedule[row.key].open}
                        onChange={(event) =>
                          setNewSchedule((prev) => ({
                            ...prev,
                            [row.key]: { ...prev[row.key], open: event.target.checked },
                          }))
                        }
                      />
                      {row.label}
                    </label>
                    <input
                      type="time"
                      value={newSchedule[row.key].start}
                      disabled={!newSchedule[row.key].open}
                      onChange={(event) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          [row.key]: { ...prev[row.key], start: event.target.value },
                        }))
                      }
                      className="time-input-white-icon w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70"
                    />
                    <input
                      type="time"
                      value={newSchedule[row.key].end}
                      disabled={!newSchedule[row.key].open}
                      onChange={(event) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          [row.key]: { ...prev[row.key], end: event.target.value },
                        }))
                      }
                      className="time-input-white-icon w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70"
                    />
                  </div>
                ))}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={newActive} onChange={(event) => setNewActive(event.target.checked)} />
              启用分店
            </label>
          </div>
        </UnifiedModal>
      ) : null}
      {showEdit && editId ? (
        <UnifiedModal
          open={showEdit && !!editId}
          size="md"
          title="编辑分店"
          description="可独立调整每周营业日与营业时间。"
          onClose={() => {
            setShowEdit(false);
            setEditId(null);
          }}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowEdit(false);
                  setEditId(null);
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
            <div className="space-y-3">
              <input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="分店名称" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              <input value={editLocation} onChange={(event) => setEditLocation(event.target.value)} placeholder="分店地址" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">营业时间（按星期设置）</p>
                <div className="mt-2 space-y-2">
                  {dayRows.map((row) => (
                    <div key={row.key} className="grid grid-cols-[78px_1fr_1fr] items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={editSchedule[row.key].open}
                          onChange={(event) =>
                            setEditSchedule((prev) => ({
                              ...prev,
                              [row.key]: { ...prev[row.key], open: event.target.checked },
                            }))
                          }
                        />
                        {row.label}
                      </label>
                      <input
                        type="time"
                        value={editSchedule[row.key].start}
                        disabled={!editSchedule[row.key].open}
                        onChange={(event) =>
                          setEditSchedule((prev) => ({
                            ...prev,
                            [row.key]: { ...prev[row.key], start: event.target.value },
                          }))
                        }
                        className="time-input-white-icon w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70"
                      />
                      <input
                        type="time"
                        value={editSchedule[row.key].end}
                        disabled={!editSchedule[row.key].open}
                        onChange={(event) =>
                          setEditSchedule((prev) => ({
                            ...prev,
                            [row.key]: { ...prev[row.key], end: event.target.value },
                          }))
                        }
                        className="time-input-white-icon w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={editActive} onChange={(event) => setEditActive(event.target.checked)} />
                启用分店
              </label>
            </div>
        </UnifiedModal>
      ) : null}
    </div>
  );
}
