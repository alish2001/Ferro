const surfaces = [
  {
    name: "Web app",
    path: "apps/web",
    blurb: "Next.js shell for uploads, job orchestration, and the first Ferro operator flow.",
  },
  {
    name: "Render core",
    path: "packages/render-core",
    blurb: "Remotion package that owns compositions, Studio, and the reusable render entrypoint.",
  },
];

const commands = [
  "bun install",
  "bun run dev:web",
  "bun run dev:render",
  "bun run lint",
  "bun run typecheck",
];

const milestones = [
  "Bun workspace root manages apps and packages from one install.",
  "The former kitchen app now lives in render-core without breaking the CLI skill symlinks.",
  "FER-6 can build the single-page upload flow on top of this shell next.",
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(135deg,rgba(166,59,34,0.12),rgba(247,241,231,0.9)_38%,rgba(26,87,74,0.12))] p-8 shadow-[0_30px_80px_rgba(41,30,25,0.08)] sm:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-[var(--tone-muted)]">
              Ferro foundation
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-[var(--ink)] sm:text-6xl">
              Web shell outside. Render core inside. One repo that can grow cleanly.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--tone-muted)] sm:text-lg">
              FER-5 establishes the product boundary: a Next.js surface for the
              operator flow and a dedicated Remotion package for compositions
              and rendering.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {surfaces.map((surface) => (
                <article
                  key={surface.name}
                  className="rounded-[1.5rem] border border-black/10 bg-white/75 p-5 backdrop-blur"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tone-soft)]">
                    {surface.path}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                    {surface.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--tone-muted)]">
                    {surface.blurb}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-black/10 bg-[rgba(36,32,29,0.96)] p-8 text-[var(--paper)] shadow-[0_24px_60px_rgba(20,16,13,0.26)]">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-white/55">
              Canonical commands
            </p>
            <div className="mt-6 space-y-3">
              {commands.map((command) => (
                <div
                  key={command}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white/90"
                >
                  {command}
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-black/10 bg-white/75 p-8 shadow-[0_20px_50px_rgba(41,30,25,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-[var(--tone-soft)]">
              Ready now
            </p>
            <div className="mt-5 space-y-4">
              {milestones.map((milestone) => (
                <div
                  key={milestone}
                  className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--paper)] px-4 py-4 text-sm leading-6 text-[var(--tone-muted)]"
                >
                  {milestone}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-black/10 bg-[rgba(255,250,245,0.84)] p-8 shadow-[0_20px_50px_rgba(41,30,25,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-[var(--tone-soft)]">
              Next milestone
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
              FER-6 lands on this shell next.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--tone-muted)]">
              The next pass can focus on the single-page upload flow: source
              video, transcript input, optional instructions, taste prompt, and
              the first generation job state.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
