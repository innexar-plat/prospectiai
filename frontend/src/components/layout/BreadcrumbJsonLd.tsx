import { getAppOrigin } from '@/lib/site-url';

export interface BreadcrumbItem {
  name: string;
  path: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export default function BreadcrumbJsonLd({ items }: Props) {
  const origin = getAppOrigin();
  const itemListElement = items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: `${origin}${item.path}`,
  }));

  const json = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
