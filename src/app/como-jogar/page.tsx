import { ContentPage } from "@/components/content-page";
import { ConnectButton, SocialButtons } from "@/components/server-bits";

export const metadata = { title: "Como jogar" };
export const dynamic = "force-dynamic";

export default function HowToPlay() {
  return (
    <ContentPage slug="como-jogar" eyebrow="Servidor Palmas TO" fallbackTitle="Como jogar">
      <div className="card flex flex-wrap items-center gap-3 p-5">
        <ConnectButton />
        <SocialButtons />
      </div>
    </ContentPage>
  );
}
