import { NextResponse } from "next/server";

export async function GET() {
  const issuer = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3333";

  return NextResponse.json(
    {
      issuer,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ["id_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400",
      },
    }
  );
}
