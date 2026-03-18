import { importPKCS8, importSPKI, exportJWK } from "jose";

const ALG = "RS256";
const KID = "taimumashin-1";

let _privateKey: CryptoKey | null = null;
let _publicKey: CryptoKey | null = null;

export async function getPrivateKey() {
  if (!_privateKey) {
    const pem = process.env.JWT_PRIVATE_KEY;
    if (!pem) throw new Error("JWT_PRIVATE_KEY not set");
    _privateKey = await importPKCS8(pem, ALG);
  }
  return _privateKey;
}

export async function getPublicKey() {
  if (!_publicKey) {
    const pem = process.env.JWT_PUBLIC_KEY;
    if (!pem) throw new Error("JWT_PUBLIC_KEY not set");
    _publicKey = await importSPKI(pem, ALG);
  }
  return _publicKey;
}

export async function getJWKS() {
  const publicKey = await getPublicKey();
  const jwk = await exportJWK(publicKey);
  return {
    keys: [
      {
        ...jwk,
        alg: ALG,
        kid: KID,
        use: "sig",
      },
    ],
  };
}

export { ALG, KID };
