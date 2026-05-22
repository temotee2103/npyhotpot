"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AdminFilePicker } from "@/components/admin-file-picker";
import { fetchOfficialPromotionById, updateOfficialPromotion } from "@/lib/admin/official-platform";
import { supabase } from "@/lib/supabase";

function toLocalDatetimeInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateTimeInputValue(value: string | null) {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) {
    const now = new Date();
    const [h, m] = value.split(":");
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${h}:${m}`;
  }
  return toLocalDatetimeInputValue(value);
}

function AdminDeliveryPromotionEditPageContent() {
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const id = searchParams.get("id") || "";

  const [title, setTitle] = useState("");
  const [scheduleKind, setScheduleKind] = useState<"range" | "daily_window" | "weekly">("range");
  const [status, setStatus] = useState<"draft" | "scheduled" | "active" | "paused" | "ended">("draft");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [dailyStart, setDailyStart] = useState("");
  const [dailyEnd, setDailyEnd] = useState("");
  const [weeklyDaysText, setWeeklyDaysText] = useState("1,2,3,4,5");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficialPromotionById(id).then((data) => {
      if (!active || !data) return;
      setTitle(data.title ?? "");
      setScheduleKind(data.schedule_kind);
      setStatus(data.status);
      setStartsAt(toLocalDatetimeInputValue(data.starts_at));
      setEndsAt(toLocalDatetimeInputValue(data.ends_at));
      setDailyStart(toLocalDateTimeInputValue(data.daily_start));
      setDailyEnd(toLocalDateTimeInputValue(data.daily_end));
      setWeeklyDaysText((data.weekly_days ?? []).join(","));
      setImageUrl(data.image_url ?? "");
      setVideoUrl(data.video_url ?? "");
    });
    return () => {
      active = false;
    };
  }, [id]);

  const header = useMemo(() => (title.trim() ? title.trim() : "未命名促销"), [title]);
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">DELIVERY</p>
            <h1 className="mt-1 text-3xl font-black">{header}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{id ? `ID: ${id}` : "缺少ID"}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/delivery/promotions?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              返回列表
            </Link>
            <button
              type="button"
              disabled={saving || !id}
              onClick={async () => {
                if (!id || saving) return;
                setSaving(true);
                setSaved(null);
                const result = await updateOfficialPromotion({
                  id,
                  title,
                  channel: "delivery",
                  schedule_kind: scheduleKind,
                  status,
                  starts_at: startsAt,
                  ends_at: endsAt,
                  daily_start: dailyStart,
                  daily_end: dailyEnd,
                  weekly_days_text: weeklyDaysText,
                  image_url: imageUrl,
                  video_url: videoUrl,
                });
                setSaving(false);
                if (!result.ok) return setSaved(`保存失败：${result.message}`);
                setSaved("已保存");
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved ? <p className="mt-3 text-xs font-bold text-primary">{saved}</p> : null}
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h2 className="text-xl font-black">基础信息</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">活动名称</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">周期类型</p>
            <select
              value={scheduleKind}
              onChange={(e) => setScheduleKind(e.target.value as typeof scheduleKind)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="range">时间范围</option>
              <option value="daily_window">每日时段</option>
              <option value="weekly">每周</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">状态</p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="draft">草稿</option>
              <option value="scheduled">待开始</option>
              <option value="active">进行中</option>
              <option value="paused">暂停</option>
              <option value="ended">结束</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h2 className="text-xl font-black">投放规则</h2>
        {scheduleKind === "range" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">开始时间</p>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">结束时间</p>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        ) : scheduleKind === "daily_window" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">每日开始（日期+时间）</p>
              <input
                type="datetime-local"
                value={dailyStart}
                onChange={(e) => setDailyStart(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">每日结束（日期+时间）</p>
              <input
                type="datetime-local"
                value={dailyEnd}
                onChange={(e) => setDailyEnd(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">每周投放日（0-6，逗号分隔；0=周日）</p>
            <input
              value={weeklyDaysText}
              onChange={(e) => setWeeklyDaysText(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="1,2,3,4,5"
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h2 className="text-xl font-black">媒体素材</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">建议尺寸：图片 1200×600（2:1），视频 1080×1080 或 1080×1920，时长 6-15 秒。</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">图片（可选）</p>
            <AdminFilePicker
              className="mt-2"
              accept="image/*"
              onSelect={async (files) => {
                const file = files[0];
                if (!file || !id || !supabase) return;
                const ext = file.name.split(".").pop() || "jpg";
                const path = `promotions/${id}/image-${Date.now()}.${ext}`;
                const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                if (error) return;
                const { data } = supabase.storage.from("media").getPublicUrl(path);
                setImageUrl(data.publicUrl);
              }}
            />
            {imageUrl ? (
              <div className="mt-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <Image src={imageUrl} alt="促销图片预览" width={1200} height={360} className="h-36 w-full rounded-lg object-cover" unoptimized />
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">未上传图片</p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">视频（可选）</p>
            <AdminFilePicker
              className="mt-2"
              accept="video/*"
              onSelect={async (files) => {
                const file = files[0];
                if (!file || !id || !supabase) return;
                const ext = file.name.split(".").pop() || "mp4";
                const path = `promotions/${id}/video-${Date.now()}.${ext}`;
                const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                if (error) return;
                const { data } = supabase.storage.from("media").getPublicUrl(path);
                setVideoUrl(data.publicUrl);
              }}
            />
            {videoUrl ? (
              <div className="mt-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <video src={videoUrl} controls className="h-36 w-full rounded-lg object-cover" />
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">未上传视频</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminDeliveryPromotionEditPage() {
  return (
    <Suspense fallback={null}>
      <AdminDeliveryPromotionEditPageContent />
    </Suspense>
  );
}
