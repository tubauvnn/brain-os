import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const people = await prisma.people.findMany({
    orderBy: { name: "asc" },
    include: { face_profile: true },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Người quen" description={`${people.length} người`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {people.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-bold shrink-0">
                {p.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-zinc-100">{p.name}</h3>
                  {p.alias && <span className="text-xs text-zinc-500">({p.alias})</span>}
                </div>
                {p.relation && <p className="text-xs text-zinc-500">{p.relation}</p>}
                {p.notes && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{p.notes}</p>}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {p.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                  {p.face_profile && (
                    <Badge variant="indigo">
                      {p.face_profile.face_embedding ? "face ✓" : "face -"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {people.length === 0 && (
          <p className="text-zinc-600 text-sm col-span-2">Chưa có người quen. Thêm qua POST /api/people.</p>
        )}
      </div>
    </div>
  );
}
