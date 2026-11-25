import Link from "next/link";

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${compact ? "brand-compact" : ""}`}
      aria-label="AVORA MEDIA · Trang chủ"
    >
      <span className="brand-logo">
        <img
          src="/brand/avora-logo-transparent.svg?v=1"
          alt="Logo AVORA MEDIA"
          width={234}
          height={198}
        />
      </span>
    </Link>
  );
}
