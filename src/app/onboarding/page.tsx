import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { OnboardingContent } from "./onboarding-content";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session.user} minimal />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 flex-1">
        <OnboardingContent />
      </main>

      <Footer />
    </div>
  );
}
