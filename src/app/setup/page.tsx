import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SetupContent } from "./setup-content";

export default async function SetupPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session?.user} />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 flex-1">
        <SetupContent />
      </main>
      <Footer />
    </div>
  );
}
