import fs from "node:fs"
import path from "node:path"
import { ImageResponse } from "next/og"

export const SOCIAL_IMAGE_ALT =
  "EduPlay — AI-Powered Interactive Educational Games & Classroom Quizzes"
export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 }
export const SOCIAL_IMAGE_CONTENT_TYPE = "image/png"

function getLogoDataUri(): string | null {
  try {
    const iconPath = path.join(process.cwd(), "app", "icon.png")
    const buffer = fs.readFileSync(iconPath)
    return `data:image/png;base64,${buffer.toString("base64")}`
  } catch {
    return null
  }
}

/**
 * Generates the shared 1200x630 OpenGraph and Twitter preview image without network fetches.
 */
export function renderSocialPreviewImage(): ImageResponse {
  const logoUri = getLogoDataUri()

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: "linear-gradient(135deg, #022c22 0%, #064e3b 48%, #0f172a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            {logoUri && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "72px",
                  height: "72px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.12)",
                  border: "2px solid rgba(16,185,129,0.45)",
                  padding: "8px",
                }}
              >
                <img
                  src={logoUri}
                  alt="EduPlay Logo"
                  width={56}
                  height={56}
                  style={{ objectFit: "contain" }}
                />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "34px", fontWeight: 900, letterSpacing: "-0.02em" }}>
                EduPlay
              </span>
              <span style={{ fontSize: "16px", color: "#6ee7b7", fontWeight: 700 }}>
                Interactive Gamified Learning Platform
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 20px",
              borderRadius: "999px",
              background: "rgba(16, 185, 129, 0.16)",
              border: "1px solid rgba(110, 231, 183, 0.35)",
              color: "#a7f3d0",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            Arabic RTL & English LTR
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "980px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "58px",
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            Build Interactive Educational Games With an AI Touch
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "24px",
              color: "#cbd5e1",
              lineHeight: 1.45,
            }}
          >
            Generate curriculum quizzes in seconds, launch instant QR/PIN classroom sessions with zero student accounts, and track live accuracy.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {[
            "Auto AI & BYO Prompt",
            "Zero-Account QR Join",
            "Instant Explanatory Feedback",
            "Live Classroom Analytics",
          ].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                fontSize: "17px",
                fontWeight: 700,
                color: "#ecfdf5",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...SOCIAL_IMAGE_SIZE },
  )
}
