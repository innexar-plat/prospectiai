import { useI18n } from '@/lib/i18n';

export function AppLoadingFallback() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-2xl text-muted">{t('common.app.loading')}</div>
    </div>
  );
}
