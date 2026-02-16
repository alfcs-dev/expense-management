import { db } from "../src/index.js";

const BANXICO_URL = "https://www.banxico.org.mx/cep-scl/listaInstituciones.do";
const BANXICO_BETA_URL = "https://www.banxico.org.mx/cep-scl-beta/listaInstituciones.do";

type CatalogInstitution = {
  code: string;
  bankCode: string | null;
  name: string;
  source: "banxico-cep" | "banxico-cep-beta";
};

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&aacute;/g, "a")
    .replace(/&eacute;/g, "e")
    .replace(/&iacute;/g, "i")
    .replace(/&oacute;/g, "o")
    .replace(/&uacute;/g, "u")
    .replace(/&Aacute;/g, "A")
    .replace(/&Eacute;/g, "E")
    .replace(/&Iacute;/g, "I")
    .replace(/&Oacute;/g, "O")
    .replace(/&Uacute;/g, "U")
    .replace(/&Ntilde;/g, "N")
    .replace(/&ntilde;/g, "n")
    .replace(/\s+/g, " ")
    .trim();
}

function parseInstitutions(
  html: string,
  source: CatalogInstitution["source"],
): CatalogInstitution[] {
  const rowPattern = /<tr>\s*<td>(\d+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/g;
  const institutions = new Map<string, CatalogInstitution>();

  for (const row of html.matchAll(rowPattern)) {
    const rawCode = row[1]?.trim();
    const rawName = row[2]?.trim();

    if (!rawCode || !rawName) continue;

    const code = rawCode.padStart(5, "0");
    const bankCode = code.slice(-3);
    const name = decodeHtml(rawName);

    institutions.set(code, {
      code,
      bankCode,
      name,
      source,
    });
  }

  return [...institutions.values()];
}

async function fetchInstitutions(
  url: string,
  source: CatalogInstitution["source"],
): Promise<CatalogInstitution[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch institutions from ${url}: ${response.status}`);
  }

  const html = await response.text();
  const institutions = parseInstitutions(html, source);

  if (institutions.length === 0) {
    throw new Error(`No institutions parsed from ${url}`);
  }

  return institutions;
}

async function upsertInstitutions(institutions: CatalogInstitution[]): Promise<void> {
  const now = new Date();
  const seenCodes = institutions.map((institution) => institution.code);

  await db.$transaction(async (tx) => {
    for (const institution of institutions) {
      await tx.institutionCatalog.upsert({
        where: { code: institution.code },
        create: {
          code: institution.code,
          bankCode: institution.bankCode,
          name: institution.name,
          source: institution.source,
          isActive: true,
          lastSeenAt: now,
        },
        update: {
          bankCode: institution.bankCode,
          name: institution.name,
          source: institution.source,
          isActive: true,
          lastSeenAt: now,
        },
      });
    }

    await tx.institutionCatalog.updateMany({
      where: {
        code: { notIn: seenCodes },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  });
}

async function main() {
  const includeBeta =
    process.argv.includes("--include-beta") ||
    process.env.SYNC_INSTITUTIONS_INCLUDE_BETA === "true";

  const primary = await fetchInstitutions(BANXICO_URL, "banxico-cep");
  let merged = primary;

  if (includeBeta) {
    const beta = await fetchInstitutions(BANXICO_BETA_URL, "banxico-cep-beta");
    const byCode = new Map(primary.map((institution) => [institution.code, institution]));

    for (const institution of beta) {
      if (!byCode.has(institution.code)) {
        byCode.set(institution.code, institution);
      }
    }

    merged = [...byCode.values()];
  }

  await upsertInstitutions(merged);

  const total = await db.institutionCatalog.count();
  const active = await db.institutionCatalog.count({ where: { isActive: true } });

  console.log(
    JSON.stringify(
      {
        fetched: merged.length,
        total,
        active,
        includeBeta,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Institution sync failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
