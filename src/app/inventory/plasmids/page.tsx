import { redirect } from "next/navigation";

// This standalone route was a placeholder; inventory is managed on the tabbed
// /inventory page. Redirect so old links (home module bar, project nav) land right.
export default function Page() {
  redirect("/inventory?tab=plasmids");
}
