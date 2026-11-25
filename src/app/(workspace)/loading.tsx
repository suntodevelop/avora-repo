export default function Loading() {
  return (
    <section className="workspace-loading" role="status" aria-live="polite">
      <div className="panel posts-heading-panel loading-banner">
        <span className="loading-line short" />
        <span className="loading-line title" />
        <span className="loading-line" />
      </div>
      <div className="loading-card-grid">
        {[0, 1, 2, 3].map((item) => (
          <div className="panel loading-card" key={item}>
            <span className="loading-line short" />
            <span className="loading-line title" />
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải nội dung trang…</span>
    </section>
  );
}
