import { Suspense } from "react";
import GenerateSlot, { IdleForm } from "./GenerateSlot";

const FAQS = [
  {
    q: "Does this get me cited in ChatGPT?",
    a: "No tool can promise that. CiteReady makes a public page easier to quote: structure, FAQs, and a clean index. Citations still depend on the model.",
  },
  {
    q: "Does Google use llms.txt?",
    a: "Google has said no AI system uses llms.txt directly. The file is a community spec (Jeremy Howard / Answer.AI). We still ship it because it is cheap to publish. The paid job is the schema and the grounded Q&A your developer can paste this afternoon.",
  },
  {
    q: "Is CiteReady an AI-visibility tracker?",
    a: "No. Trackers measure whether ChatGPT mentioned you. CiteReady is an implementation pack: files you deploy, not a dashboard of prompts.",
  },
  {
    q: "Do you store my site?",
    a: "We fetch one public URL. HTML is deleted within 24 hours. We keep the URL you typed and the email used for delivery.",
  },
  {
    q: "What URLs work?",
    a: "Public pages only. We honor robots.txt. We do not log in, scrape Maps, or connect a store.",
  },
  {
    q: "What if the model would invent a price or feature?",
    a: "That item is omitted. Every Q&A in the pack includes a verbatim quote from your HTML, or it does not ship.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <a className="skip" href="#generate">
        Skip to generate
      </a>
      <header className="site">
        <div className="wrap">
          <a className="brand" href="/">
            <img src="/logo.svg" alt="" width={28} height={28} />
            CiteReady
          </a>
          <nav className="desk" aria-label="Page">
            <a href="#how">How</a>
            <a href="#pack">Pack</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="sample-link" href="/sample/citeready-sample.zip">
            Download the sample pack
          </a>
        </div>
      </header>

      <main>
        <div className="hero wrap">
          <div className="hero-grid">
            <div>
              <p className="kicker">
                CiteReady is an implementation pack, not a tracker.
              </p>
              <h1>Paste a URL. Get the files AI search can actually quote.</h1>
              <p className="sub">
                In 60 seconds: a spec-compliant llms.txt, FAQ schema, and
                citation-ready answers taken from your own page — plus the
                questions models cannot answer from your HTML.
              </p>
              <p className="support">
                We do not rank you in ChatGPT. We give you artifacts your
                developer can ship this afternoon.
              </p>
              <Suspense fallback={<IdleForm />}>
                <GenerateSlot />
              </Suspense>
            </div>
            <aside className="preview" aria-label="Sample pack contents">
              <div className="preview-head">
                <span>Sample pack</span>
                <span className="pill">.zip</span>
              </div>
              <div className="file">
                <div className="glyph">txt</div>
                <div>
                  <strong>llms.txt</strong>
                  <em>curated index</em>
                </div>
              </div>
              <div className="file">
                <div className="glyph">txt</div>
                <div>
                  <strong>llms-full.txt</strong>
                  <em>page source for models</em>
                </div>
              </div>
              <div className="file">
                <div className="glyph">ld</div>
                <div>
                  <strong>faq.jsonld</strong>
                  <em>FAQPage JSON-LD</em>
                </div>
              </div>
              <div className="file">
                <div className="glyph">md</div>
                <div>
                  <strong>qa.md</strong>
                  <em>5–8 grounded Q&amp;As</em>
                </div>
              </div>
              <div className="file">
                <div className="glyph">md</div>
                <div>
                  <strong>gaps.md</strong>
                  <em>what is missing to cite</em>
                </div>
              </div>
              <div className="file">
                <div className="glyph">txt</div>
                <div>
                  <strong>README.txt</strong>
                  <em>where to paste each file</em>
                </div>
              </div>
              <p className="preview-foot">From one public URL. No login.</p>
            </aside>
          </div>
        </div>

        <section id="how">
          <div className="wrap">
            <h2>How it works</h2>
            <div className="steps">
              <article className="step">
                <div className="num">1</div>
                <p>Paste a public URL.</p>
              </article>
              <article className="step">
                <div className="num">2</div>
                <p>We fetch the HTML. No login, no pixel, no store connect.</p>
              </article>
              <article className="step">
                <div className="num">3</div>
                <p>
                  Download a zip. Paste the files into your CMS or{" "}
                  <code>&lt;head&gt;</code>.
                </p>
              </article>
              <article className="step">
                <div className="num">4</div>
                <p>
                  Optional later: $29/mo to recrawl weekly when schema drifted.
                  Not in the MVP.
                </p>
                <span className="mini">Not in MVP</span>
              </article>
            </div>
          </div>
        </section>

        <section id="pack">
          <div className="wrap">
            <h2>What’s in the pack</h2>
            <div className="pack-list">
              <div className="pack-item">
                <span className="dot" />
                <p>
                  llms.txt + llms-full.txt — a curated index, not a sitemap dump
                </p>
              </div>
              <div className="pack-item">
                <span className="dot" />
                <p>
                  FAQPage JSON-LD that matches visible content, with mismatch
                  warnings
                </p>
              </div>
              <div className="pack-item">
                <span className="dot" />
                <p>
                  5–8 Q&amp;As with on-page quotes. If it is not on the page, the
                  field stays blank.
                </p>
              </div>
              <div className="pack-item">
                <span className="dot" />
                <p>
                  gaps.md — claims a competitor can win because this page lacks
                  numbers, dates, an author, or a one-sentence definition
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing">
          <div className="wrap">
            <h2>Pricing</h2>
            <p className="lead">
              Checkout today is the $19 one-shot only. Starter, Agency, and
              Studio are listed as upcoming plans. We do not collect a
              subscription in week one.
            </p>
            <div className="prices">
              <article className="price now">
                <p className="plan">One-shot audit</p>
                <p className="amt">
                  $19<span>one URL</span>
                </p>
                <p className="meta">zip by email, no account</p>
                <a className="btn" href="#generate">
                  Generate my pack — $19
                </a>
              </article>
              <article className="price" aria-disabled="true">
                <p className="up">Upcoming</p>
                <p className="plan">Starter</p>
                <p className="amt">
                  $29<span>/mo</span>
                </p>
                <p className="meta">5 URLs, weekly recrawl</p>
              </article>
              <article className="price" aria-disabled="true">
                <p className="up">Upcoming</p>
                <p className="plan">Agency</p>
                <p className="amt">
                  $79<span>/mo</span>
                </p>
                <p className="meta">25 URLs, white-label zip</p>
              </article>
              <article className="price" aria-disabled="true">
                <p className="up">Upcoming</p>
                <p className="plan">Studio</p>
                <p className="amt">
                  $149<span>/mo</span>
                </p>
                <p className="meta">75 URLs, team folder</p>
              </article>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="wrap faq">
            <h2>FAQ</h2>
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="site" id="privacy">
        <div className="wrap">
          <h2>Privacy</h2>
          <p>
            CiteReady fetches public pages only. We do not scrape behind logins.
            HTML is deleted within 24 hours. We do not train models on your
            pages. CiteReady is not an SEO ranking guarantee and does not claim
            that ChatGPT, Perplexity, Gemini, or Google AI Overviews will cite
            you. llms.txt is a community specification; Google has said no AI
            system uses it directly.
          </p>
          <div className="foot-nav">
            <a href="/">CiteReady</a>
            <a href="#privacy">Privacy</a>
            <a href="#faq">FAQ</a>
          </div>
          <p className="legal">CiteReady · USD · No account required</p>
        </div>
      </footer>
    </>
  );
}
