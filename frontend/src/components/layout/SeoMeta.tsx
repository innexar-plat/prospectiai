import { useEffect } from 'react';
import { getAppOrigin } from '@/lib/site-url';

interface Props {
  title: string;
  description: string;
  path?: string;
}

function setMeta(attr: string, value: string, isProperty = false) {
  const a = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${a}="${attr}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(a, attr);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export default function SeoMeta({ title, description, path }: Props) {
  useEffect(() => {
    const baseUrl = getAppOrigin();
    const url = path ? `${baseUrl}${path}` : baseUrl;

    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:url', url, true);
    setLink('canonical', url);
  }, [title, description, path]);

  return null;
}
