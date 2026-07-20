import { describe, expect, it } from "vitest";
import { matchCik } from "@/lib/research/sources/edgar-facts";
import { mapGdeltArticles } from "@/lib/research/sources/gdelt";
import { parseGoogleNewsRss } from "@/lib/research/sources/google-news";
import { slugCandidates } from "@/lib/research/sources/job-boards";
import { extractWikidataFacts } from "@/lib/research/sources/wikidata";
import { buildQuerySet, SEARCHES_PER_COMPANY } from "@/lib/research/gather";

describe("edgar matchCik", () => {
  const entries = [
    { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
    { cik_str: 789019, ticker: "MSFT", title: "MICROSOFT CORPORATION" },
    { cik_str: 40987, ticker: "GPC", title: "GENUINE PARTS CO" },
  ];
  it("matches ignoring case and corporate suffixes", () => {
    expect(matchCik(entries, "Apple")).toBe(320193);
    expect(matchCik(entries, "Microsoft Corp.")).toBe(789019);
    expect(matchCik(entries, "Genuine Parts Company")).toBe(40987);
  });
  it("returns null for private companies", () => {
    expect(matchCik(entries, "Micro Center")).toBeNull();
  });
});

describe("gdelt mapper", () => {
  it("maps articles and parses seendate", () => {
    const hits = mapGdeltArticles([
      { url: "https://x.com/a", title: "Story", seendate: "20260501T120000Z", domain: "x.com" },
      { url: "", title: "dropped" },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0].publishedDate).toBe("2026-05-01");
    expect(hits[0].source).toBe("gdelt");
  });
});

describe("google news RSS parser", () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[Micro Center opens Phoenix store - Retail Dive]]></title>
      <link>https://news.example.com/story1</link>
      <pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate>
      <source url="https://retaildive.com">Retail Dive</source></item>
    <item><title>Second &amp; story</title><link>https://news.example.com/story2</link></item>
  </channel></rss>`;
  it("parses items, dates, entities and CDATA", () => {
    const hits = parseGoogleNewsRss(xml);
    expect(hits).toHaveLength(2);
    expect(hits[0].title).toBe("Micro Center opens Phoenix store - Retail Dive");
    expect(hits[0].publishedDate).toBe("2026-06-01");
    expect(hits[0].snippet).toContain("Retail Dive");
    expect(hits[1].title).toBe("Second & story");
    expect(hits[1].publishedDate).toBeNull();
  });
});

describe("job board slug candidates", () => {
  it("derives slugs from name and domain", () => {
    expect(slugCandidates("Micro Center", "microcenter.com")).toContain("microcenter");
    expect(slugCandidates("Lowes Foods, LLC", null)).toContain("lowesfoods");
    expect(slugCandidates("AB", null)).toEqual([]); // too short
  });
});

describe("wikidata claim extraction", () => {
  it("pulls employees, website, and founding year", () => {
    const { facts, officialWebsite } = extractWikidataFacts({
      claims: {
        P1128: [{ mainsnak: { datavalue: { value: { amount: "+3100" } } } }],
        P856: [{ mainsnak: { datavalue: { value: "https://www.microcenter.com/" } } }],
        P571: [{ mainsnak: { datavalue: { value: { time: "+1979-00-00T00:00:00Z" } } } }],
      },
    });
    expect(officialWebsite).toBe("https://www.microcenter.com/");
    expect(facts.join(" ")).toContain("3,100");
    expect(facts.join(" ")).toContain("1979");
  });
});

describe("query set with LinkedIn SERP queries", () => {
  it("includes IT-role linkedin.com/in queries without crawling linkedin", () => {
    const queries = buildQuerySet("Erlanger Health", 2026);
    expect(queries).toHaveLength(SEARCHES_PER_COMPANY);
    const linkedin = queries.filter((q) => q.includes("site:linkedin.com/in"));
    expect(linkedin).toHaveLength(2);
    expect(linkedin[0]).toContain("CIO");
    expect(linkedin[1]).toContain("telecom");
  });
});
