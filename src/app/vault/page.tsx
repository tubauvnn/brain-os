import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const items = await prisma.privateMemory.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Kho riêng tư"
        description={`${items.length} mục — access_level >= 3`}
      />

      <div className="mb-4 p-3 rounded-lg bg-amber-900/20 border border-amber-800/40">
        <p className="text-xs text-amber-400">Vault chỉ hiển thị khi truy cập trực tiếp với quyền owner. Thông tin ở đây không sync public.</p>
      </div>

      <div className="space-y-3">
        {items.map((m) => (
          <Card key={m.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-zinc-100 mb-1">{m.title}</h3>
                <p className="text-sm text-zinc-400 line-clamp-3">{m.content}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {m.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0 space-y-1 text-right">
                <Badge variant="red">lv {m.access_level}</Badge>
                {m.encrypted && <Badge variant="yellow">encrypted</Badge>}
                <p className="text-xs text-zinc-700">{new Date(m.created_at).toLocaleDateString("vi-VN")}</p>
              </div>
            </div>
          </Card>
        ))}

        {items.length === 0 && (
          <p className="text-zinc-600 text-sm">Vault trống. Thêm qua API POST /api/private-memories.</p>
        )}
      </div>
    </div>
  );
}
