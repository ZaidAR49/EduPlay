interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>
}

/**
 * Server component that embeds schema.org JSON-LD structured data into SSR HTML.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // Safe serialization escaping `<` to prevent premature `</script>` termination
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
