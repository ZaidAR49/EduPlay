import type { Metadata } from "next"
import { getLiveGameForStudentAction, getGameForPreviewAction } from "@/lib/actions/plays.actions"
import GameClient from "@/components/game/GameClient"
import { DEMO_PLAY, getDemoGame, getDemoScenarios } from "@/data/demo-game"
import { GameErrorScreen } from "@/components/game/GameErrorScreen"
import { JsonLd } from "@/components/seo/JsonLd"
import {
  NOINDEX_ROBOTS,
  buildBreadcrumbJsonLd,
  buildDemoGameJsonLd,
  buildPublicMetadata,
  getRequestLocale,
  getSeoCopy,
} from "@/lib/seo"

interface GamePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ preview?: string; lang?: string | string[] }>
}

export async function generateMetadata({ params, searchParams }: GamePageProps): Promise<Metadata> {
  const { id } = await params
  const { lang } = await searchParams
  const { locale, hasUrlLocale } = await getRequestLocale(lang)

  if (id === "demo") {
    return buildPublicMetadata({
      page: "demo",
      path: "/game/demo",
      locale,
      hasUrlLocale,
    })
  }

  return {
    title: locale === "en" ? "Live Classroom Game" : "جلسة لعب مباشرة",
    description:
      locale === "en"
        ? "Join an active EduPlay classroom quiz session using a direct link or QR code."
        : "انضم إلى جلسة لعبة تعليمية مباشرة على منصة EduPlay.",
    robots: NOINDEX_ROBOTS,
  }
}

export default async function GamePage({ params, searchParams }: GamePageProps) {
  const { id } = await params
  const { preview, lang } = await searchParams

  if (id === "demo") {
    const { locale } = await getRequestLocale(lang)
    const demoGame = getDemoGame(locale)
    const demoScenarios = getDemoScenarios(locale)
    const copy = getSeoCopy(locale)

    const demoJsonLd = [
      buildDemoGameJsonLd(locale),
      buildBreadcrumbJsonLd([
        { name: locale === "ar" ? "الرئيسية" : "Home", path: "/" },
        { name: copy.pages.demo.title, path: "/game/demo" },
      ]),
    ]

    return (
      <>
        <JsonLd data={demoJsonLd} />
        <GameClient game={demoGame} play={DEMO_PLAY} scenarios={demoScenarios} />
      </>
    )
  }

  const data =
    preview === "true"
      ? await getGameForPreviewAction(id)
      : await getLiveGameForStudentAction(id)

  if (!data || data.error || !data.game || !data.play) {
    return <GameErrorScreen error={data?.error} />
  }

  return <GameClient game={data.game} play={data.play} scenarios={data.scenarios} />
}
