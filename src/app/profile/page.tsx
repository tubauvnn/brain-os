import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await prisma.profile.findFirst({ include: { preferences: true } });

  if (!profile) {
    return (
      <div className="p-6">
        <PageHeader title="Hồ sơ" />
        <p className="text-zinc-500">Chưa có hồ sơ. Chạy seed để tạo.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Hồ sơ" description="Thông tin chủ hệ thống" />

      <Card className="mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-indigo-700 flex items-center justify-center text-2xl font-bold text-white">
            {profile.name[0]}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{profile.name}</h2>
            {profile.alias && <p className="text-sm text-zinc-500">{profile.alias}</p>}
          </div>
        </div>
        {profile.bio && <p className="text-sm text-zinc-400 mb-4">{profile.bio}</p>}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-600">Múi giờ</span>
            <p className="text-zinc-300">{profile.timezone}</p>
          </div>
          <div>
            <span className="text-zinc-600">Ngôn ngữ</span>
            <p className="text-zinc-300">{profile.locale}</p>
          </div>
          <div>
            <span className="text-zinc-600">Tạo lúc</span>
            <p className="text-zinc-300">{new Date(profile.created_at).toLocaleDateString("vi-VN")}</p>
          </div>
        </div>
      </Card>

      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Tuỳ chọn</h2>
      <div className="space-y-2">
        {profile.preferences.map((p) => (
          <Card key={p.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-300 font-mono">{p.key}</p>
              {p.group && <p className="text-xs text-zinc-600">{p.group}</p>}
            </div>
            <span className="text-sm text-indigo-300 font-mono">{p.value}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
