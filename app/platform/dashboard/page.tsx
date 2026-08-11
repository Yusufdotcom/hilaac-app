import { redirect } from "next/navigation";

/** Legacy path — All Restaurants is the default platform home. */
export default function PlatformDashboardPage() {
  redirect("/platform/restaurants");
}
