export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found-inner">
        <span className="not-found-eyebrow">404</span>
        <h1 className="not-found-title">We can&apos;t find that page.</h1>
        <p className="not-found-copy">
          The page you were looking for has moved, was removed, or never existed. Try heading home
          and starting again.
        </p>
        <a className="not-found-home" href="/">
          Take me home
        </a>
      </div>
    </main>
  );
}
