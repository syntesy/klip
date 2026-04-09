import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/communities");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-page px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold text-text-1 mb-4">
          Comunidades organizadas por{" "}
          <span className="text-blue-bright">IA</span>
        </h1>
        <p className="text-text-2 text-lg mb-8">
          Substitua seus grupos de WhatsApp por tópicos estruturados, threads e
          resumos automáticos gerados por IA.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-blue text-white rounded-lg font-medium hover:bg-blue/90 transition-colors"
          >
            Começar grátis
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-3 bg-bg-surface text-text-1 rounded-lg font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
