import { Phone, MapPin, MessageCircle, ExternalLink, Mail } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { buildMapsUrl, buildWhatsAppNumber, getPrimaryPhone, getPrimaryEmail, buildMailtoUrl } from '@/lib/lead-contact-utils';
import type { Place } from '@/lib/api';

interface ResultCardQuickActionsProps {
  place: Place;
  onViewDetails: () => void;
  onActionClick?: (action: string) => void;
  className?: string;
}

const iconBtnClass = cn(
  'inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border',
  'bg-surface/80 text-muted hover:text-foreground hover:bg-violet-500/10 hover:border-violet-500/30',
  'transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30',
);

export function ResultCardQuickActions({
  place,
  onViewDetails,
  onActionClick,
  className,
}: ResultCardQuickActionsProps) {
  const { t } = useI18n();
  const phone = getPrimaryPhone(place);
  const whatsappNumber = buildWhatsAppNumber(place);
  const mapsUrl = buildMapsUrl(place.formattedAddress);
  const primaryEmail = getPrimaryEmail(place);
  const mailtoUrl = primaryEmail ? buildMailtoUrl({ to: primaryEmail }) : null;

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={(e) => {
            e.stopPropagation();
            onActionClick?.('CALL_CLICK');
          }}
          className={iconBtnClass}
          title={t('page.resultados.actionCall')}
          aria-label={t('page.resultados.actionCall')}
        >
          <Phone size={14} aria-hidden />
        </a>
      )}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            onActionClick?.('MAPS_CLICK');
          }}
          className={iconBtnClass}
          title={t('page.resultados.actionMaps')}
          aria-label={t('page.resultados.actionMaps')}
        >
          <MapPin size={14} aria-hidden />
        </a>
      )}
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            onActionClick?.('WHATSAPP_CLICK');
          }}
          className={cn(iconBtnClass, 'hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10')}
          title={t('page.resultados.actionWhatsApp')}
          aria-label={t('page.resultados.actionWhatsApp')}
        >
          <MessageCircle size={14} aria-hidden />
        </a>
      )}
      {mailtoUrl && (
        <a
          href={mailtoUrl}
          onClick={(e) => {
            e.stopPropagation();
            onActionClick?.('EMAIL_CLICK');
          }}
          className={cn(iconBtnClass, 'hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10')}
          title={t('page.resultados.actionEmail')}
          aria-label={t('page.resultados.actionEmail')}
        >
          <Mail size={14} aria-hidden />
        </a>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onViewDetails();
        }}
        className={cn(iconBtnClass, 'hover:text-violet-600 dark:hover:text-violet-400')}
        title={t('page.resultados.actionViewDetails')}
        aria-label={t('page.resultados.actionViewDetails')}
      >
        <ExternalLink size={14} aria-hidden />
      </button>
    </div>
  );
}
