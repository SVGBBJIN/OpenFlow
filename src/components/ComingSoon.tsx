export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-2 text-xl font-semibold">{title}</h1>
      <p className="text-muted">Not built yet. This ships in Phase {phase} of the roadmap; nothing on this screen is functional.</p>
    </div>
  );
}
