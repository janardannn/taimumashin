// TODO: Re-enable auth after testing
// import { redirect } from "next/navigation";
// import { auth } from "@/lib/auth";
// import { getPrisma } from "@/lib/db";
import { FileBrowser } from "@/components/archive/file-browser";
import { Footer } from "@/components/footer";

export default async function HomePage() {
  // const session = await auth();
  // if (!session?.user?.id) redirect("/login");
  //
  // const prisma = await getPrisma();
  // const user = await prisma.user.findUnique({
  //   where: { id: session.user.id },
  //   select: { roleArn: true, bucketName: true },
  // });
  //
  // if (!user?.roleArn || !user?.bucketName) {
  //   redirect("/onboarding");
  // }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <a href="/" className="hover:opacity-80 transition-opacity">
            <span className="text-lg font-bold leading-none">taimumashin</span>
            <span className="block text-[10px] text-muted-foreground leading-none">タイムマシン</span>
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/" className="font-medium">Home</a>
            <a href="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</a>
            <a href="/settings" className="text-muted-foreground hover:text-foreground">Settings</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 flex-1">
        <FileBrowser path="" />
      </main>

      <Footer />
    </div>
  );
}
