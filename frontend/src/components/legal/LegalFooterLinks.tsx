import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

type LegalFooterLinksProps = {
  linkClassName?: string;
};

export default function LegalFooterLinks({ linkClassName = 'hover:text-foreground transition-colors' }: LegalFooterLinksProps) {
  const { t } = useI18n();

  return (
    <>
      <Link to="/privacy" className={linkClassName}>{t('footer.privacy')}</Link>
      <Link to="/terms" className={linkClassName}>{t('footer.terms')}</Link>
    </>
  );
}
