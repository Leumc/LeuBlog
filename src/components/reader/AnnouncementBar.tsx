import { prisma } from "@/lib/prisma";
import AnnounceClient from "./AnnounceClient";

/** 当前生效公告条（取最新一条），线条式克制呈现 */
export default async function AnnouncementBar() {
  const now = new Date();
  const ann = await prisma.announcement.findFirst({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!ann) return null;
  return <AnnounceClient content={ann.content} level={ann.level} />;
}
