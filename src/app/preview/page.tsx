import { notFound } from "next/navigation";
import { Preview } from "./Preview";

/**
 * A look at the table with nothing behind it: the real felt, dealer, shoe and seats, drawn from
 * a made-up round, to see how a player's card backs, chips, ring and title look at the table.
 * Development only: there is no such page in production.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Preview />;
}
