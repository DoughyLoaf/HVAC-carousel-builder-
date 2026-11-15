import Image from "next/image";
import Link from "next/link";
import { brand, copy, photos, reviews, services, townGroups } from "@content/site";
import { BeforeAfter } from "@/components/BeforeAfter";
import { CallLink } from "@/components/CallLink";
import { IntentLink } from "@/components/IntentLink";
import { LeadForm } from "@/components/LeadForm";
import { PhotoFrame } from "@/components/PhotoFrame";
import { RepairOrReplace } from "@/components/RepairOrReplace";
import { StickyBar } from "@/components/StickyBar";
import { launchBlockers, photoUsable, publicFact, siteMode, telHref } from "@/lib/launch";

function Unverified() {
  return <span className="unverified" title="Shown in preview only. Not verified with CDA yet.">unverified</span>;
}

export default function Home() {
  const blockers = launchBlockers();
  const mode = siteMode(process.env, blockers);
  const preview = mode === "preview";

  const phoneFact = publicFact("business.phone", mode);
  const tel = phoneFact ? telHref(phoneFact.value) : "";
  const phone = phoneFact && tel ? { display: phoneFact.value, tel } : null;

  const area = publicFact("funnel.targetArea", mode);
  const website = publicFact("business.website", mode);
  const servicesFact = publicFact("services.list", mode);
  const guideFact = publicFact("guide.repairOrReplace", mode);
  const faq = copy.faq.map((f) => {
    const fact = f.factId ? publicFact(f.factId, mode) : null;
    return fact && f.aWithFact
      ? { q: f.q, a: f.aWithFact.replace("{fee}", fact.value), unverified: fact.unverified }
      : { q: f.q, a: f.a, unverified: false };
  });
  const positioning = publicFact("claim.positioning", mode);
  const trust = (["claim.local", "claim.licensed", "claim.experience", "claim.emergency"] as const)
    .map((id) => publicFact(id, mode))
    .filter((f) => f !== null);

  const slot = (id: string) => photos.find((p) => p.id === id)!;
  const usable = Object.fromEntries(photos.map((p) => [p.id, photoUsable(p)]));
  const hero = slot("hero");
  const before = slot("before");
  const after = slot("after");
  const gallery = photos.filter((p) => p.id.startsWith("gallery-"));
  const galleryShown = gallery.filter((p) => usable[p.id] || preview);
  const beforeAfterReady = usable.before && usable.after;

  return (
    <>
      {preview && (
        <div className="preview-bar" role="note">
          <strong>Preview — not launched.</strong>{" "}
          {blockers.length > 0
            ? `${blockers.length} item${blockers.length === 1 ? "" : "s"} to settle before this page can go live.`
            : "Everything is verified. Set SITE_MODE=live to launch."}{" "}
          <Link href="/admin/launch">See the list</Link>
        </div>
      )}

      <header className="site-head">
        <a href="#top" className="wordmark" aria-label={brand.wordmark}>
          {brand.logo ? (
            <Image src={brand.logo} alt={brand.wordmark} width={180} height={44} priority />
          ) : (
            <>
              {brand.mark && <Image src={brand.mark} alt="" width={36} height={36} priority className="wordmark-mark" />}
              <span>{brand.wordmark}</span>
            </>
          )}
        </a>
        {phone && (
          <CallLink tel={phone.tel} placement="header" className="head-call">
            <span className="head-call-label">{copy.cta.call}</span>
            <span className="head-call-num">{phone.display}</span>
          </CallLink>
        )}
      </header>

      <main id="top">
        <section className={usable.hero ? "hero has-photo" : "hero"}>
          {usable.hero && (
            <div className="hero-photo">
              <Image src={`/photos/${hero.file}`} alt={hero.alt} fill priority sizes="100vw" />
            </div>
          )}
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">{copy.hero.eyebrow}</p>
              <h1>{copy.hero.headline}</h1>
              <p className="hero-sub">{copy.hero.sub}</p>
              <div className="hero-cta" id="hero-cta">
                {phone && (
                  <CallLink tel={phone.tel} placement="hero" className="btn btn-call btn-big">
                    <span>{copy.cta.call}</span>
                    <span className="btn-num">{phone.display}</span>
                  </CallLink>
                )}
                <IntentLink intent="replacement_estimate" className="btn btn-light btn-big">{copy.cta.estimate}</IntentLink>
                <IntentLink intent="heating_service" className="btn btn-light btn-big">{copy.cta.service}</IntentLink>
              </div>
              {preview && !usable.hero && (
                <PhotoFrame slot={hero} usable={false} preview sizes="100vw" className="hero-slot-note" />
              )}
            </div>
            <div className="hero-form" id="request">
              <LeadForm copy={copy.form} townGroups={townGroups} phone={phone} consent={copy.form.consent} callLabel={copy.cta.call} />
              <noscript>
                <p className="noscript">This form needs JavaScript.{phone ? ` You can also call ${phone.display}.` : ""}</p>
              </noscript>
            </div>
          </div>
        </section>

        {trust.length > 0 && (
          <section className="trust" aria-label="About CDA Heating & Cooling">
            <ul>
              {trust.map((f) => (
                <li key={f.value}>{f.value}{f.unverified && <Unverified />}</li>
              ))}
            </ul>
          </section>
        )}

        {servicesFact && (
          <section className="band">
            <div className="wrap">
              <h2>{copy.services.title}{servicesFact.unverified && <Unverified />}</h2>
              {positioning && <p className="lede">{positioning.value}{positioning.unverified && <Unverified />}</p>}
              <ul className="services">
                {services.map((sv) => (
                  <li key={sv.title}>
                    <IntentLink intent={sv.intent} className="service">
                      <span className="service-title">{sv.title}</span>
                      <span className="service-blurb">{sv.blurb}</span>
                      <span className="service-go" aria-hidden="true">Request →</span>
                    </IntentLink>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className={servicesFact ? "band band-tint" : "band"}>
          <div className="wrap">
            <h2>{copy.stepsTitle}</h2>
            <ol className="how">
              {copy.steps.map((s, i) => (
                <li key={s.title}>
                  <span className="how-n" aria-hidden="true">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {guideFact && (
          <section className="band">
            <div className="wrap narrow">
              <h2>{copy.repairOrReplace.title}{guideFact.unverified && <Unverified />}</h2>
              <p className="lede">{copy.repairOrReplace.lede}</p>
              <RepairOrReplace
                repair={copy.repairOrReplace.repair}
                replace={copy.repairOrReplace.replace}
                serviceLabel={copy.cta.service}
                estimateLabel={copy.cta.estimate}
              />
            </div>
          </section>
        )}

        {(beforeAfterReady || preview) && (
          <section className="band band-dark">
            <div className="wrap">
              <h2>{copy.beforeAfter.title}</h2>
              {beforeAfterReady ? (
                <>
                  <BeforeAfter
                    before={{ src: `/photos/${before.file}`, alt: before.alt }}
                    after={{ src: `/photos/${after.file}`, alt: after.alt }}
                    hint={copy.beforeAfter.hint}
                  />
                  <p className="hint">{copy.beforeAfter.hint}</p>
                </>
              ) : (
                <div className="slot-pair">
                  <PhotoFrame slot={before} usable={false} preview sizes="50vw" />
                  <PhotoFrame slot={after} usable={false} preview sizes="50vw" />
                </div>
              )}
            </div>
          </section>
        )}

        {galleryShown.length > 0 && (
          <section className="band">
            <div className="wrap">
              <h2>{copy.gallery.title}</h2>
            </div>
            <ul className="gallery" tabIndex={0} aria-label="Photos from CDA jobs">
              {galleryShown.map((p) => (
                <li key={p.id}>
                  <PhotoFrame slot={p} usable={usable[p.id]} preview={preview} sizes="(max-width: 700px) 78vw, 360px" />
                  {usable[p.id] && p.caption && <p className="caption">{p.caption}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {reviews.length > 0 && (
          <section className="band">
            <div className="wrap">
              <h2>What customers say</h2>
              <ul className="reviews">
                {reviews.map((r) => (
                  <li key={r.quote}>
                    <blockquote>“{r.quote}”</blockquote>
                    <p>{r.name}{r.town ? `, ${r.town}` : ""} · {r.platform}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="band band-tint">
          <div className="wrap">
            <h2>Where we work</h2>
            {area && <p className="lede">{area.value}</p>}
            <div className="town-groups">
              {townGroups.map((g) => (
                <div key={g.county}>
                  <h3>{g.county}</h3>
                  <ul className="towns">
                    {g.towns.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="note">Not sure you’re in range? Send a request or call, and we’ll tell you straight.</p>
          </div>
        </section>

        <section className="band">
          <div className="wrap narrow">
            <h2>Common questions</h2>
            <div className="faq">
              {faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}{f.unverified && <Unverified />}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="band band-dark closing">
          <div className="wrap narrow">
            <h2>Ready when you are.</h2>
            <div className="hero-cta">
              {phone && (
                <CallLink tel={phone.tel} placement="closing" className="btn btn-call btn-big">
                  <span>{copy.cta.call}</span>
                  <span className="btn-num">{phone.display}</span>
                </CallLink>
              )}
              <IntentLink intent="replacement_estimate" className="btn btn-light btn-big">{copy.cta.estimate}</IntentLink>
              <IntentLink intent="heating_service" className="btn btn-light btn-big">{copy.cta.service}</IntentLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-foot">
        <div className="wrap">
          <p className="foot-name">{brand.wordmark}</p>
          {phone && <p><CallLink tel={phone.tel} placement="footer">{phone.display}</CallLink></p>}
          {website && (
            <p>
              Looking for everything else CDA does?{" "}
              <a href={website.value} rel="noopener">Visit the main website</a>
              {website.unverified && <Unverified />}
            </p>
          )}
          <p className="fine">{copy.privacy}</p>
        </div>
      </footer>

      <StickyBar watch="#hero-cta">
        {phone && (
          <CallLink tel={phone.tel} placement="sticky" className="btn btn-call">{copy.cta.call}</CallLink>
        )}
        <a href="#request" className="btn btn-light">Request service</a>
      </StickyBar>
    </>
  );
}
