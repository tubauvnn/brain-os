import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  const prompts = await prisma.prompt.findMany({
    orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Prompts" description={`${prompts.length} prompts`} />

      <div className="space-y-3">
        {prompts.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {p.pinned && <span className="text-indigo-400 text-xs">◆</span>}
                  <h3 className="text-sm font-medium text-zinc-100">{p.title}</h3>
                </div>
                <pre className="text-xs text-zinc-400 whitespace-pre-wrap line-clamp-4 font-mono bg-zinc-900/50 rounded p-2 mt-1">
                  {p.body}
                </pre>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Badge variant="indigo">{p.category}</Badge>
                  {p.model && <Badge variant="pink">{p.model}</Badge>}
                  {p.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {prompts.length === 0 && (
          <p className="text-zinc-600 text-sm">Chưa có prompt. Thêm qua POST /api/prompts.</p>
        )}
      </div>
    </div>
  );
}
