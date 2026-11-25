import type { ReactNode } from "react";
export type BannerTheme = "default" | "spring" | "summer" | "autumn" | "winter";
type Props = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  theme?: BannerTheme;
};
/** Shared page banner. Seasonal themes are opt-in and independent of content/actions. */
export default function PageHeading({
  title,
  description,
  eyebrow = "AVORA MEDIA · CONTENT TRACKING",
  actions,
  theme = "default",
}: Props) {
  return (
    <section
      className="page-heading panel posts-heading-panel page-banner"
      data-banner-theme={theme}
    >
      <div className="page-banner-content">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </section>
  );
}
