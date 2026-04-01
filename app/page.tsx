import { redirect } from "next/navigation";

/** Marketing home → full landing (nav, hero, features). */
export default function HomePage() {
  redirect("/landing");
}
