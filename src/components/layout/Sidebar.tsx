"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/profile", label: "Hồ sơ", icon: "◉" },
  { href: "/memories", label: "Trí nhớ", icon: "◈" },
  { href: "/vault", label: "Kho riêng tư", icon: "⬤" },
  { href: "/people", label: "Người quen", icon: "◎" },
  { href: "/projects", label: "Project", icon: "◧" },
  { href: "/tasks", label: "Tasks", icon: "◫" },
  { href: "/decisions", label: "Quyết định", icon: "◆" },
  { href: "/prompts", label: "Prompts", icon: "◇" },
  { href: "/devices", label: "Thiết bị", icon: "◻" },
  { href: "/logs", label: "Logs", icon: "≡" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-52 shrink-0 flex flex-col bg-[#16161a] border-r border-zinc-800 h-screen">
      <div className="px-4 py-4 border-b border-zinc-800">
        <span className="font-mono font-bold text-indigo-400 text-sm tracking-widest">BRAIN OS</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item) => {
          const active = path === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${active
                  ? "bg-indigo-600/20 text-indigo-300 font-medium"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                }`}
            >
              <span className="text-xs w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-zinc-800">
        <span className="text-xs text-zinc-600 font-mono">v0.1.0 MVP</span>
      </div>
    </aside>
  );
}
