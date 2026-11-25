import { renderSocialPreviewImage } from "@/lib/og-image"

export const runtime = "nodejs"
export const alt = "EduPlay — AI-Powered Interactive Educational Games & Classroom Quizzes"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return renderSocialPreviewImage()
}
