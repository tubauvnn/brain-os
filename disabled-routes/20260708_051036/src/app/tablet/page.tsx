"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type PermissionState = "idle" | "granted" | "denied" | "unsupported";

const TILES: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/robot", label: "Robot", icon: "◎" },
  { href: "/robot#chat", label: "Robot Chat", icon: "💬" },
  { href: "/robot#camera", label: "Robot Camera", icon: "📷" },
  { href: "/devices", label: "Thiết bị", icon: "◻" },
  { href: "/tasks", label: "Tasks", icon: "◫" },
  { href: "/memories", label: "Trí nhớ", icon: "◈" },
  { href: "/projects", label: "Project", icon: "◧" },
  { href: "/people", label: "Người quen", icon: "◎" },
  { href: "/logs", label: "Logs", icon: "≡" },
];

function badgeVariant(s: PermissionState) {
  if (s === "granted") return "green" as const;
  if (s === "denied") return "red" as const;
  if (s === "unsupported") return "default" as const;
  return "yellow" as const;
}

function badgeLabel(s: PermissionState) {
  if (s === "granted") return "Đã cho phép";
  if (s === "denied") return "Từ chối";
  if (s === "unsupported") return "Không hỗ trợ";
  return "Chưa xin";
}

export default function TabletLauncherPage() {
  const [mic, setMic] = useState<PermissionState>("idle");
  const [camera, setCamera] = useState<PermissionState>("idle");
  const [notif, setNotif] = useState<PermissionState>("idle");

  async function requestMic() {
    if (!navigator.mediaDevices?.getUserMedia) return setMic("unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMic("granted");
    } catch {
      setMic("denied");
    }
  }

  async function requestCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera("unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCamera("granted");
    } catch {
      setCamera("denied");
    }
  }

  async function requestNotification() {
    if (typeof Notification === "undefined") return setNotif("unsupported");
    try {
      const result = await Notification.requestPermission();
      setNotif(result === "granted" ? "granted" : "denied");
    } catch {
      setNotif("denied");
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Tablet Launcher"
        description="Bấm để mở nhanh — tối ưu cho màn hình cảm ứng."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col items-center justify-center gap-2 min-h-[7rem] sm:min-h-[8.5rem] rounded-2xl bg-[#16161a] border border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-600/10 active:scale-95 transition-all"
          >
            <span className="text-3xl sm:text-4xl">{t.icon}</span>
            <span className="text-sm sm:text-base font-medium text-zinc-200">{t.label}</span>
          </Link>
        ))}
      </div>

      <Card>
        <h3 className="text-sm font-medium text-zinc-100 mb-1">Quyền truy cập thiết bị</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Placeholder — xin quyền trước để robot/camera/thông báo sẵn sàng khi tích hợp phần cứng thật sau này.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={requestMic}
            className="min-h-[4rem] rounded-xl bg-zinc-800 hover:bg-indigo-600/30 active:scale-95 transition-all px-4 py-3 flex items-center justify-between gap-2"
          >
            <span className="text-sm sm:text-base font-medium text-zinc-200">🎙️ Micro</span>
            <Badge variant={badgeVariant(mic)}>{badgeLabel(mic)}</Badge>
          </button>
          <button
            onClick={requestCamera}
            className="min-h-[4rem] rounded-xl bg-zinc-800 hover:bg-indigo-600/30 active:scale-95 transition-all px-4 py-3 flex items-center justify-between gap-2"
          >
            <span className="text-sm sm:text-base font-medium text-zinc-200">📷 Camera</span>
            <Badge variant={badgeVariant(camera)}>{badgeLabel(camera)}</Badge>
          </button>
          <button
            onClick={requestNotification}
            className="min-h-[4rem] rounded-xl bg-zinc-800 hover:bg-indigo-600/30 active:scale-95 transition-all px-4 py-3 flex items-center justify-between gap-2"
          >
            <span className="text-sm sm:text-base font-medium text-zinc-200">🔔 Thông báo</span>
            <Badge variant={badgeVariant(notif)}>{badgeLabel(notif)}</Badge>
          </button>
        </div>
      </Card>
    </div>
  );
}
