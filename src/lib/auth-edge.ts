import { jwtVerify, importSPKI } from "jose";

const ALG = "RS256";

let _publicKey: CryptoKey | null = null;

async function getPublicKey() {
  if (!_publicKey) {
    const pem = process.env.JWT_PUBLIC_KEY;
    if (!pem) throw new Error("JWT_PUBLIC_KEY not set");
    _publicKey = await importSPKI(pem, ALG);
  }
  return _publicKey;
}

export async function verifySessionToken(token: string) {
  const issuer = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3333";
  const publicKey = await getPublicKey();
  const { payload } = await jwtVerify(token, publicKey, {
    issuer,
    algorithms: [ALG],
    audience: "sts.amazonaws.com",
  });
  return payload;
}
