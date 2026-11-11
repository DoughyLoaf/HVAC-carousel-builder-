import { notFound } from "next/navigation";
import Builder from "./Builder";

export const dynamic = "force-dynamic";

export default async function CarouselPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,4}$/.test(id)) notFound();
  return <Builder id={Number(id)} />;
}
