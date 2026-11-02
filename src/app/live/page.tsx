import { redirect } from "next/navigation";

/** Live now lives in the Studio (its Live view); old links land there. */
export default function LivePage() {
  redirect("/studio?mode=live");
}
