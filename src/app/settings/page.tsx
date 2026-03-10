import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SettingsContent } from "./settings-content";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session.user} />

      <main className="mx-auto max-w-2xl px-4 py-8 flex-1">
        <SettingsContent />
      </main>

      <Footer />
    </div>
  );
}
