import { notFound } from "next/navigation";
import { Table } from "./Table";

export default async function TablePage({ params }: PageProps<"/t/[id]">) {
  const { id } = await params;
  if (!/^[tp]-[a-z0-9]{6}$/.test(id)) notFound();
  return <Table id={id} />;
}
