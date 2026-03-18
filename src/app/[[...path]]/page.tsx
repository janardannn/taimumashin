import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { FileBrowser } from "@/components/archive/file-browser";
import { Footer } from "@/components/footer";
import { SearchProvider } from "@/components/search-context";

interface Props {
  params: Promise<{ path?: string[] }>;
}

export default async function ArchivePage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { path } = await params;
  const folderPath = path ? path.join("/") : "";

  return (
    <div className="flex min-h-screen flex-col">
      <SearchProvider>
        <Navbar user={session.user} />

        <main className="mx-auto w-full max-w-7xl px-4 py-6 flex-1">
          <FileBrowser path={folderPath} />
        </main>
      </SearchProvider>

      <Footer />
    </div>
  );
}
