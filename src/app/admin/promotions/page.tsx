"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchOfficialPromotions, type OfficialPromotion } from "@/lib/admin/official-platform";
import { UnifiedTable } from "@/components/unified-table";

export default function AdminPromotionsPage() {
  const [rows, setRows] = useState<OfficialPromotion[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialPromotions().then((data) => {
      if (!active) return;
      setRows(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const formatChannel = useMemo(() => {
    return (channel: OfficialPromotion["channel"]) => {
      if (channel === "shop") return "商城";
      if (channel === "delivery") return "外卖";
      return "全渠道";
    };
  }, []);

  const formatStatus = useMemo(() => {
    return (status: OfficialPromotion["status"]) => {
      if (status === "active") return "进行中";
      if (status === "scheduled") return "待开始";
      if (status === "paused") return "已暂停";
      if (status === "ended") return "已结束";
      return "草稿";
    };
  }, []);

  const formatPeriod = useMemo(() => {
    return (p: OfficialPromotion) => {
      if (p.schedule_kind === "daily_window") {
        return p.daily_start && p.daily_end ? `每日 ${p.daily_start}-${p.daily_end}` : "每日";
      }
      if (p.schedule_kind === "weekly") {
        return p.weekly_days.length ? `每周 ${p.weekly_days.join(",")}` : "每周";
      }
      if (p.starts_at && p.ends_at) {
        return `${new Date(p.starts_at).toLocaleDateString()} - ${new Date(p.ends_at).toLocaleDateString()}`;
      }
      return "-";
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h1 className="text-3xl font-black">促销活动管理</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">管理商城优惠券、外卖满减、活动投放时间窗和渠道曝光位。</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <UnifiedTable title="活动清单">
          <div>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-3">活动</th>
                  <th className="px-5 py-3">渠道</th>
                  <th className="px-5 py-3">周期</th>
                  <th className="px-5 py-3">状态</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-3 font-semibold">{item.title}</td>
                    <td className="px-5 py-3">{formatChannel(item.channel)}</td>
                    <td className="px-5 py-3">{formatPeriod(item)}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{formatStatus(item.status)}</span>
                    </td>
                  </tr>
                ))}
                {rows && rows.length === 0 && (
                  <tr className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={4}>
                      暂无数据
                    </td>
                  </tr>
                )}
                {rows === null && (
                  <tr className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={4}>
                      加载中...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </UnifiedTable>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">新建活动</h2>
          <div className="mt-4 space-y-3">
            <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="活动名称" />
            <select className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option>选择渠道</option>
              <option>在线商城</option>
              <option>外卖配送</option>
              <option>全渠道</option>
            </select>
            <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="开始时间 - 结束时间" />
            <button className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90">保存活动</button>
          </div>
        </article>
      </section>
    </div>
  );
}
