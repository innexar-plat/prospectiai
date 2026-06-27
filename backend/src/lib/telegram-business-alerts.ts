import { alertInfo, alertSuccess, alertWarning } from '@/lib/telegram-alert';

type AlertMetaValue = string | number | boolean | null | undefined;
type AlertMeta = Record<string, AlertMetaValue>;

type NotifyLevel = 'info' | 'success' | 'warning';

type WorkspaceContext = {
  workspaceId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
};

type PlanContext = WorkspaceContext & {
  fromPlan?: string | null;
  toPlan?: string | null;
  billingCycle?: string | null;
  provider?: string | null;
  amount?: number | null;
  currency?: string | null;
  subscriptionId?: string | null;
  paymentId?: string | null;
  effectiveAt?: string | null;
  status?: string | null;
};

function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const normalizedCurrency = (currency ?? '').toUpperCase();
  if (normalizedCurrency === 'BRL') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }
  if (normalizedCurrency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
  return `${amount} ${normalizedCurrency || ''}`.trim();
}

function withCommonMeta(meta: AlertMeta, ctx: WorkspaceContext): AlertMeta {
  return {
    ...meta,
    userId: ctx.userId ?? undefined,
    email: ctx.userEmail ?? undefined,
    nome: ctx.userName ?? undefined,
    workspaceId: ctx.workspaceId ?? undefined,
  };
}

function notify(level: NotifyLevel, title: string, message: string, meta: AlertMeta): void {
  const sender = level === 'success' ? alertSuccess : level === 'warning' ? alertWarning : alertInfo;
  sender(title, message, meta).catch(() => {});
}

export function notifyNewSignup(ctx: WorkspaceContext & { verificationEmailSent?: boolean | null }): void {
  notify(
    'success',
    'Novo cadastro',
    'Novo usuário criado na PrecisionAI.',
    withCommonMeta(
      {
        emailConfirmacaoEnviado: ctx.verificationEmailSent ?? undefined,
      },
      ctx,
    ),
  );
}

export function notifyCheckoutStarted(ctx: PlanContext): void {
  notify(
    'info',
    'Checkout iniciado',
    'Usuário iniciou um checkout de plano.',
    withCommonMeta(
      {
        dePlano: ctx.fromPlan ?? undefined,
        paraPlano: ctx.toPlan ?? undefined,
        ciclo: ctx.billingCycle ?? undefined,
        provedor: ctx.provider ?? undefined,
        valor: formatAmount(ctx.amount, ctx.currency),
      },
      ctx,
    ),
  );
}

export function notifyPlanUpgrade(ctx: PlanContext): void {
  notify(
    'success',
    'Upgrade de plano',
    'Upgrade de plano concluído.',
    withCommonMeta(
      {
        dePlano: ctx.fromPlan ?? undefined,
        paraPlano: ctx.toPlan ?? undefined,
        ciclo: ctx.billingCycle ?? undefined,
        provedor: ctx.provider ?? undefined,
        subscriptionId: ctx.subscriptionId ?? undefined,
      },
      ctx,
    ),
  );
}

export function notifyPlanDowngradeScheduled(ctx: PlanContext): void {
  notify(
    'info',
    'Downgrade agendado',
    'Alteração para plano inferior agendada.',
    withCommonMeta(
      {
        dePlano: ctx.fromPlan ?? undefined,
        paraPlano: ctx.toPlan ?? undefined,
        ciclo: ctx.billingCycle ?? undefined,
        provedor: ctx.provider ?? undefined,
        efetivoEm: ctx.effectiveAt ?? undefined,
      },
      ctx,
    ),
  );
}

export function notifyPlanDowngradeCancelled(ctx: PlanContext): void {
  notify(
    'info',
    'Downgrade cancelado',
    'O agendamento de downgrade foi cancelado.',
    withCommonMeta(
      {
        planoMantido: ctx.fromPlan ?? undefined,
        downgradeCancelado: ctx.toPlan ?? undefined,
        provedor: ctx.provider ?? undefined,
      },
      ctx,
    ),
  );
}

export function notifyPaymentCreated(ctx: PlanContext): void {
  notify(
    'info',
    'Pagamento iniciado',
    'Nova tentativa de pagamento/criação de checkout.',
    withCommonMeta(
      {
        paraPlano: ctx.toPlan ?? undefined,
        ciclo: ctx.billingCycle ?? undefined,
        provedor: ctx.provider ?? undefined,
        valor: formatAmount(ctx.amount, ctx.currency),
        paymentId: ctx.paymentId ?? undefined,
      },
      ctx,
    ),
  );
}

export function notifyPaymentApproved(ctx: PlanContext): void {
  notify(
    'success',
    'Pagamento aprovado',
    'Pagamento aprovado e plano aplicado.',
    withCommonMeta(
      {
        dePlano: ctx.fromPlan ?? undefined,
        paraPlano: ctx.toPlan ?? undefined,
        ciclo: ctx.billingCycle ?? undefined,
        provedor: ctx.provider ?? undefined,
        valor: formatAmount(ctx.amount, ctx.currency),
        paymentId: ctx.paymentId ?? undefined,
        subscriptionId: ctx.subscriptionId ?? undefined,
        status: ctx.status ?? undefined,
      },
      ctx,
    ),
  );
}

export function notifyPaymentRenewed(ctx: PlanContext): void {
  notify(
    'success',
    'Renovação paga',
    'Renovação de assinatura recebida.',
    withCommonMeta(
      {
        plano: ctx.toPlan ?? undefined,
        ciclo: ctx.billingCycle ?? undefined,
        provedor: ctx.provider ?? undefined,
        valor: formatAmount(ctx.amount, ctx.currency),
        paymentId: ctx.paymentId ?? undefined,
        subscriptionId: ctx.subscriptionId ?? undefined,
      },
      ctx,
    ),
  );
}

export function notifyPaymentFailed(ctx: PlanContext): void {
  notify(
    'warning',
    'Pagamento falhou',
    'Pagamento rejeitado, pendente ou cancelado.',
    withCommonMeta(
      {
        paraPlano: ctx.toPlan ?? undefined,
        ciclo: ctx.billingCycle ?? undefined,
        provedor: ctx.provider ?? undefined,
        paymentId: ctx.paymentId ?? undefined,
        subscriptionId: ctx.subscriptionId ?? undefined,
        status: ctx.status ?? undefined,
      },
      ctx,
    ),
  );
}

export function notifyPaymentRefunded(ctx: PlanContext): void {
  notify(
    'warning',
    'Pagamento estornado',
    'Pagamento foi cancelado ou estornado.',
    withCommonMeta(
      {
        plano: ctx.toPlan ?? ctx.fromPlan ?? undefined,
        provedor: ctx.provider ?? undefined,
        paymentId: ctx.paymentId ?? undefined,
        subscriptionId: ctx.subscriptionId ?? undefined,
        status: ctx.status ?? undefined,
      },
      ctx,
    ),
  );
}