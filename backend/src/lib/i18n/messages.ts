import type { Locale } from '@/lib/i18n/locale';

type EmailVerificationCopy = {
    subject: string;
    title: string;
    preheader: string;
    body: [string, string];
    ctaLabel: string;
    footerNote: string;
};

type EmailPasswordResetCopy = {
    subject: string;
    title: string;
    preheader: string;
    body: [string, string];
    ctaLabel: string;
    footerNote: string;
};

const VERIFICATION: Record<Locale, EmailVerificationCopy> = {
    pt: {
        subject: 'Confirme seu e-mail – Precision IA',
        title: 'Confirme seu e-mail',
        preheader: 'Um clique para ativar sua conta.',
        body: [
            'Obrigado por se cadastrar no Precision IA.',
            'Clique no botão abaixo para confirmar seu e-mail e ativar sua conta.',
        ],
        ctaLabel: 'Confirmar e-mail',
        footerNote: 'Este link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.',
    },
    en: {
        subject: 'Confirm your email – Precision AI',
        title: 'Confirm your email',
        preheader: 'One click to activate your account.',
        body: [
            'Thanks for signing up for Precision AI.',
            'Click the button below to verify your email and activate your account.',
        ],
        ctaLabel: 'Confirm email',
        footerNote: 'This link expires in 24 hours. If you did not create an account, ignore this email.',
    },
    es: {
        subject: 'Confirma tu correo – Precision AI',
        title: 'Confirma tu correo',
        preheader: 'Un clic para activar tu cuenta.',
        body: [
            'Gracias por registrarte en Precision AI.',
            'Haz clic en el botón para verificar tu correo y activar tu cuenta.',
        ],
        ctaLabel: 'Confirmar correo',
        footerNote: 'Este enlace expira en 24 horas. Si no creaste una cuenta, ignora este correo.',
    },
};

const PASSWORD_RESET: Record<Locale, EmailPasswordResetCopy> = {
    pt: {
        subject: 'Redefinir sua senha – Precision IA',
        title: 'Redefinir senha',
        preheader: 'Solicitação de nova senha para sua conta.',
        body: [
            'Você solicitou a redefinição de senha da sua conta.',
            'Clique no botão abaixo para definir uma nova senha. Se não foi você, ignore este e-mail.',
        ],
        ctaLabel: 'Redefinir senha',
        footerNote: 'Este link expira em 1 hora e só pode ser usado uma vez.',
    },
    en: {
        subject: 'Reset your password – Precision AI',
        title: 'Reset password',
        preheader: 'Password reset request for your account.',
        body: [
            'You requested a password reset for your Precision AI account.',
            'Click the button below to set a new password. If this was not you, ignore this email.',
        ],
        ctaLabel: 'Reset password',
        footerNote: 'This link expires in 1 hour and can only be used once.',
    },
    es: {
        subject: 'Restablecer contraseña – Precision AI',
        title: 'Restablecer contraseña',
        preheader: 'Solicitud de nueva contraseña para tu cuenta.',
        body: [
            'Solicitaste restablecer la contraseña de tu cuenta Precision AI.',
            'Haz clic en el botón para definir una nueva contraseña. Si no fuiste tú, ignora este correo.',
        ],
        ctaLabel: 'Restablecer contraseña',
        footerNote: 'Este enlace expira en 1 hora y solo puede usarse una vez.',
    },
};

export function getVerificationEmailCopy(locale: Locale) {
    return VERIFICATION[locale] ?? VERIFICATION.en;
}

export function getPasswordResetEmailCopy(locale: Locale) {
    return PASSWORD_RESET[locale] ?? PASSWORD_RESET.en;
}

type EmailShellCopy = {
    htmlLang: string;
    greeting: string;
    needHelp: string;
    unsubscribe: string;
    privacy: string;
};

const EMAIL_SHELL: Record<Locale, EmailShellCopy> = {
    pt: {
        htmlLang: 'pt-BR',
        greeting: 'Olá',
        needHelp: 'Precisa de ajuda?',
        unsubscribe: 'Descadastrar e-mails',
        privacy: 'Privacidade (LGPD)',
    },
    en: {
        htmlLang: 'en',
        greeting: 'Hello',
        needHelp: 'Need help?',
        unsubscribe: 'Unsubscribe',
        privacy: 'Privacy',
    },
    es: {
        htmlLang: 'es',
        greeting: 'Hola',
        needHelp: '¿Necesitas ayuda?',
        unsubscribe: 'Cancelar suscripción',
        privacy: 'Privacidad',
    },
};

export function getEmailShellCopy(locale: Locale): EmailShellCopy {
    return EMAIL_SHELL[locale] ?? EMAIL_SHELL.en;
}

type OAuthWelcomeEmailCopy = {
    subject: string;
    title: string;
    preheader: string;
    defaultName: string;
    body: (provider: string) => [string, string];
    ctaLabel: string;
};

const OAUTH_WELCOME: Record<Locale, OAuthWelcomeEmailCopy> = {
    pt: {
        subject: 'Bem-vindo ao Precision IA',
        title: 'Bem-vindo ao Precision IA',
        preheader: 'Seu acesso foi concluído com sucesso.',
        defaultName: 'Olá',
        body: (provider) => [
            `Seu acesso com ${provider} foi concluído com sucesso.`,
            'Seu ambiente já está pronto para uso.',
        ],
        ctaLabel: 'Acessar dashboard',
    },
    en: {
        subject: 'Welcome to Precision AI',
        title: 'Welcome to Precision AI',
        preheader: 'Your sign-in was completed successfully.',
        defaultName: 'there',
        body: (provider) => [
            `Your ${provider} sign-in was completed successfully.`,
            'Your workspace is ready to use.',
        ],
        ctaLabel: 'Go to dashboard',
    },
    es: {
        subject: 'Bienvenido a Precision AI',
        title: 'Bienvenido a Precision AI',
        preheader: 'Tu acceso se completó correctamente.',
        defaultName: 'Hola',
        body: (provider) => [
            `Tu acceso con ${provider} se completó correctamente.`,
            'Tu espacio ya está listo para usar.',
        ],
        ctaLabel: 'Ir al dashboard',
    },
};

export function getOAuthWelcomeEmailCopy(locale: Locale): OAuthWelcomeEmailCopy {
    return OAUTH_WELCOME[locale] ?? OAUTH_WELCOME.en;
}

type TeamInviteEmailCopy = {
    subject: (workspaceName: string) => string;
    title: (workspaceName: string) => string;
    preheader: (inviterName: string) => string;
    body: (inviterName: string, workspaceName: string) => [string, string];
    ctaLabel: string;
    footerNote: string;
};

const TEAM_INVITE: Record<Locale, TeamInviteEmailCopy> = {
    pt: {
        subject: (ws) => `Convite para o workspace "${ws}" – Precision IA`,
        title: (ws) => `Você foi convidado para "${ws}"`,
        preheader: (inv) => `${inv} quer colaborar com você no PrecisionAI.`,
        body: (inv, ws) => [
            `<strong>${inv}</strong> convidou você para o workspace <strong>"${ws}"</strong> no PrecisionAI.`,
            'Aceite o convite para acessar os leads, análises e prospecções compartilhadas da equipe.',
        ],
        ctaLabel: 'Aceitar convite',
        footerNote: 'Este convite expira em 7 dias. Se você não esperava este e-mail, pode ignorá-lo.',
    },
    en: {
        subject: (ws) => `Invitation to workspace "${ws}" – Precision AI`,
        title: (ws) => `You've been invited to "${ws}"`,
        preheader: (inv) => `${inv} wants to collaborate with you on Precision AI.`,
        body: (inv, ws) => [
            `<strong>${inv}</strong> invited you to join the <strong>"${ws}"</strong> workspace on Precision AI.`,
            'Accept the invite to access shared leads, analyses, and team prospecting.',
        ],
        ctaLabel: 'Accept invite',
        footerNote: 'This invite expires in 7 days. If you were not expecting this email, you can ignore it.',
    },
    es: {
        subject: (ws) => `Invitación al workspace "${ws}" – Precision AI`,
        title: (ws) => `Fuiste invitado a "${ws}"`,
        preheader: (inv) => `${inv} quiere colaborar contigo en Precision AI.`,
        body: (inv, ws) => [
            `<strong>${inv}</strong> te invitó al workspace <strong>"${ws}"</strong> en Precision AI.`,
            'Acepta la invitación para acceder a leads, análisis y prospección compartidos.',
        ],
        ctaLabel: 'Aceptar invitación',
        footerNote: 'Esta invitación expira en 7 días. Si no esperabas este correo, puedes ignorarlo.',
    },
};

export function getTeamInviteEmailCopy(locale: Locale): TeamInviteEmailCopy {
    return TEAM_INVITE[locale] ?? TEAM_INVITE.en;
}

type TeamInviteAccountCreatedCopy = {
    subject: (workspaceName: string) => string;
    title: (workspaceName: string) => string;
    preheader: string;
    body: (inviterName: string, workspaceName: string) => [string, string];
    ctaLabel: string;
    footerNote: string;
};

const TEAM_INVITE_ACCOUNT: Record<Locale, TeamInviteAccountCreatedCopy> = {
    pt: {
        subject: (ws) => `Defina sua senha – ${ws} – Precision IA`,
        title: (ws) => `Sua conta foi criada em "${ws}"`,
        preheader: 'Defina sua senha para começar a usar o PrecisionAI.',
        body: (inv, ws) => [
            `<strong>${inv}</strong> criou uma conta para você no workspace <strong>"${ws}"</strong>.`,
            'Clique no botão abaixo para definir sua senha e acessar o dashboard. Após isso, você já pode explorar leads e análises com IA.',
        ],
        ctaLabel: 'Definir minha senha',
        footerNote: 'Este link expira em 7 dias. Se não definir a senha, peça um novo envio ao administrador.',
    },
    en: {
        subject: (ws) => `Set your password – ${ws} – Precision AI`,
        title: (ws) => `Your account was created in "${ws}"`,
        preheader: 'Set your password to start using Precision AI.',
        body: (inv, ws) => [
            `<strong>${inv}</strong> created an account for you in the <strong>"${ws}"</strong> workspace.`,
            'Click the button below to set your password and access the dashboard. Then you can explore leads and AI analyses.',
        ],
        ctaLabel: 'Set my password',
        footerNote: 'This link expires in 7 days. If you do not set a password, ask an administrator to resend it.',
    },
    es: {
        subject: (ws) => `Define tu contraseña – ${ws} – Precision AI`,
        title: (ws) => `Tu cuenta fue creada en "${ws}"`,
        preheader: 'Define tu contraseña para empezar a usar Precision AI.',
        body: (inv, ws) => [
            `<strong>${inv}</strong> creó una cuenta para ti en el workspace <strong>"${ws}"</strong>.`,
            'Haz clic en el botón para definir tu contraseña y acceder al dashboard. Luego podrás explorar leads y análisis con IA.',
        ],
        ctaLabel: 'Definir mi contraseña',
        footerNote: 'Este enlace expira en 7 días. Si no defines la contraseña, pide al administrador que lo reenvíe.',
    },
};

export function getTeamInviteAccountCreatedCopy(locale: Locale): TeamInviteAccountCreatedCopy {
    return TEAM_INVITE_ACCOUNT[locale] ?? TEAM_INVITE_ACCOUNT.en;
}

type AnalysisReadyNotificationCopy = {
    title: string;
    message: string;
    emailSubject: string;
    ctaLabel: string;
};

const ANALYSIS_READY: Record<Locale, AnalysisReadyNotificationCopy> = {
    pt: {
        title: 'Sua análise está pronta',
        message: 'A análise do lead foi concluída. Clique para ver.',
        emailSubject: 'Sua análise está pronta',
        ctaLabel: 'Ver mais',
    },
    en: {
        title: 'Your analysis is ready',
        message: 'Lead analysis is complete. Click to view.',
        emailSubject: 'Your analysis is ready',
        ctaLabel: 'View details',
    },
    es: {
        title: 'Tu análisis está listo',
        message: 'El análisis del lead se completó. Haz clic para ver.',
        emailSubject: 'Tu análisis está listo',
        ctaLabel: 'Ver más',
    },
};

export function getAnalysisReadyNotificationCopy(locale: Locale): AnalysisReadyNotificationCopy {
    return ANALYSIS_READY[locale] ?? ANALYSIS_READY.en;
}

const NOTIFICATION_EMAIL: Record<Locale, { ctaLabel: string }> = {
    pt: { ctaLabel: 'Ver mais' },
    en: { ctaLabel: 'View details' },
    es: { ctaLabel: 'Ver más' },
};

export function getNotificationEmailCopy(locale: Locale): { ctaLabel: string } {
    return NOTIFICATION_EMAIL[locale] ?? NOTIFICATION_EMAIL.en;
}


type AffiliateApprovedEmailCopy = {
    subject: string;
    title: string;
    preheader: (code: string) => string;
    body: [string, string];
    codeLabel: string;
    ctaLabel: string;
};

type AffiliateConversionEmailCopy = {
    subject: string;
    title: string;
    preheader: (amount: string) => string;
    bodyTail: string;
    ctaLabel: string;
    firstPaymentSummary: string;
    recurringSummary: string;
};

type AffiliateCommissionPaidEmailCopy = {
    subject: string;
    title: string;
    preheader: (amount: string) => string;
    bodyTail: string;
};

type AffiliateCommissionAvailableEmailCopy = {
    subject: string;
    title: string;
    preheader: (amount: string) => string;
    body: string;
    ctaLabel: string;
};

const AFFILIATE_APPROVED: Record<Locale, AffiliateApprovedEmailCopy> = {
    pt: {
        subject: 'Sua conta de afiliado foi aprovada – Precision IA',
        title: 'Sua conta de afiliado foi aprovada!',
        preheader: (code) => `Seu código de afiliado: ${code}. Comece a indicar agora.`,
        body: [
            'Você está no programa de afiliados PrecisionAI. Compartilhe seu link e ganhe comissão recorrente por cada assinante ativo.',
            'Quando alguém se cadastrar pelo seu link e assinar um plano pago, você receberá comissão conforme a política do programa.',
        ],
        codeLabel: 'Seu código exclusivo',
        ctaLabel: 'Acessar painel do afiliado',
    },
    en: {
        subject: 'Your affiliate account was approved – Precision AI',
        title: 'Your affiliate account was approved!',
        preheader: (code) => `Your affiliate code: ${code}. Start referring now.`,
        body: [
            'You are in the PrecisionAI affiliate program. Share your link and earn recurring commission for every active subscriber.',
            'When someone signs up through your link and subscribes to a paid plan, you earn commission per the program policy.',
        ],
        codeLabel: 'Your exclusive code',
        ctaLabel: 'Open affiliate dashboard',
    },
    es: {
        subject: 'Tu cuenta de afiliado fue aprobada – Precision AI',
        title: '¡Tu cuenta de afiliado fue aprobada!',
        preheader: (code) => `Tu código de afiliado: ${code}. Empieza a referir ahora.`,
        body: [
            'Estás en el programa de afiliados PrecisionAI. Comparte tu enlace y gana comisión recurrente por cada suscriptor activo.',
            'Cuando alguien se registre con tu enlace y contrate un plan de pago, recibirás comisión según la política del programa.',
        ],
        codeLabel: 'Tu código exclusivo',
        ctaLabel: 'Abrir panel de afiliado',
    },
};

const AFFILIATE_CONVERSION: Record<Locale, AffiliateConversionEmailCopy> = {
    pt: {
        subject: 'Nova conversão no programa de afiliados – Precision IA',
        title: 'Nova conversão — comissão gerada!',
        preheader: (amount) => `Você ganhou ${amount} em comissão.`,
        bodyTail: 'Acesse o painel para ver detalhes e acompanhar o saldo total.',
        ctaLabel: 'Ver painel de afiliado',
        firstPaymentSummary: 'Um indicado seu realizou a primeira assinatura paga. A comissão foi registrada e estará disponível após o período de segurança.',
        recurringSummary: 'Um indicado seu renovou a assinatura. Nova comissão recorrente foi registrada.',
    },
    en: {
        subject: 'New affiliate conversion – Precision AI',
        title: 'New conversion — commission earned!',
        preheader: (amount) => `You earned ${amount} in commission.`,
        bodyTail: 'Open your dashboard to see details and track your balance.',
        ctaLabel: 'View affiliate dashboard',
        firstPaymentSummary: 'A referral completed their first paid subscription. Commission was recorded and will be available after the hold period.',
        recurringSummary: 'A referral renewed their subscription. A new recurring commission was recorded.',
    },
    es: {
        subject: 'Nueva conversión de afiliado – Precision AI',
        title: '¡Nueva conversión — comisión generada!',
        preheader: (amount) => `Ganaste ${amount} en comisión.`,
        bodyTail: 'Abre el panel para ver detalles y seguir tu saldo.',
        ctaLabel: 'Ver panel de afiliado',
        firstPaymentSummary: 'Un referido completó su primera suscripción de pago. La comisión se registró y estará disponible tras el período de retención.',
        recurringSummary: 'Un referido renovó su suscripción. Se registró una nueva comisión recurrente.',
    },
};

const AFFILIATE_COMMISSION_PAID: Record<Locale, AffiliateCommissionPaidEmailCopy> = {
    pt: {
        subject: 'Comissão paga – Precision IA',
        title: 'Pagamento de comissão enviado',
        preheader: (amount) => `${amount} foi transferido para você.`,
        bodyTail: 'O prazo de compensação pode variar conforme o método de pagamento escolhido.',
    },
    en: {
        subject: 'Commission paid – Precision AI',
        title: 'Commission payout sent',
        preheader: (amount) => `${amount} was sent to you.`,
        bodyTail: 'Settlement time may vary depending on your payout method.',
    },
    es: {
        subject: 'Comisión pagada – Precision AI',
        title: 'Pago de comisión enviado',
        preheader: (amount) => `${amount} fue transferido a ti.`,
        bodyTail: 'El plazo de compensación puede variar según el método de pago.',
    },
};

const AFFILIATE_COMMISSION_AVAILABLE: Record<Locale, AffiliateCommissionAvailableEmailCopy> = {
    pt: {
        subject: 'Comissão disponível para saque – Precision IA',
        title: 'Comissão disponível para saque',
        preheader: (amount) => `${amount} disponível para saque no painel de afiliados.`,
        body: 'O valor passou do período de carência e está liberado. Acesse o painel para solicitar o pagamento.',
        ctaLabel: 'Sacar comissão',
    },
    en: {
        subject: 'Commission available for payout – Precision AI',
        title: 'Commission available for payout',
        preheader: (amount) => `${amount} available for payout in the affiliate dashboard.`,
        body: 'The hold period has ended and funds are available. Open your dashboard to request payout.',
        ctaLabel: 'Request payout',
    },
    es: {
        subject: 'Comisión disponible para retiro – Precision AI',
        title: 'Comisión disponible para retiro',
        preheader: (amount) => `${amount} disponible para retiro en el panel de afiliados.`,
        body: 'El período de retención terminó y el monto está liberado. Abre el panel para solicitar el pago.',
        ctaLabel: 'Solicitar retiro',
    },
};

export function getAffiliateApprovedEmailCopy(locale: Locale): AffiliateApprovedEmailCopy {
    return AFFILIATE_APPROVED[locale] ?? AFFILIATE_APPROVED.en;
}

export function getAffiliateConversionEmailCopy(locale: Locale): AffiliateConversionEmailCopy {
    return AFFILIATE_CONVERSION[locale] ?? AFFILIATE_CONVERSION.en;
}

export function getAffiliateCommissionPaidEmailCopy(locale: Locale): AffiliateCommissionPaidEmailCopy {
    return AFFILIATE_COMMISSION_PAID[locale] ?? AFFILIATE_COMMISSION_PAID.en;
}

export function getAffiliateCommissionAvailableEmailCopy(locale: Locale): AffiliateCommissionAvailableEmailCopy {
    return AFFILIATE_COMMISSION_AVAILABLE[locale] ?? AFFILIATE_COMMISSION_AVAILABLE.en;
}

export function localeForAffiliateCurrency(currency: string): Locale {
    return currency.toUpperCase() === 'USD' ? 'en' : 'pt';
}


/** API / validation error messages */
const API_ERRORS: Record<Locale, Record<string, string>> = {
    pt: {
        tooManyRequests: 'Muitas tentativas. Tente novamente mais tarde.',
        emailInUse: 'E-mail já cadastrado.',
        internalError: 'Erro interno do servidor.',
        unauthorized: 'Não autorizado.',
        trialExpired: 'Seu período de teste encerrou. Escolha um plano para continuar.',
        subscriptionRequired: 'Assine um plano para começar a prospectar.',
    },
    en: {
        tooManyRequests: 'Too many requests. Try again later.',
        emailInUse: 'Email already in use.',
        internalError: 'Internal server error.',
        unauthorized: 'Unauthorized.',
        trialExpired: 'Your trial has ended. Choose a plan to continue.',
        subscriptionRequired: 'Subscribe to a plan to start prospecting.',
    },
    es: {
        tooManyRequests: 'Demasiados intentos. Inténtalo más tarde.',
        emailInUse: 'El correo ya está registrado.',
        internalError: 'Error interno del servidor.',
        unauthorized: 'No autorizado.',
        trialExpired: 'Tu período de prueba terminó. Elige un plan para continuar.',
        subscriptionRequired: 'Suscríbete a un plan para empezar a prospectar.',
    },
};

export function tApiError(locale: Locale, key: keyof (typeof API_ERRORS)['en']): string {
    return API_ERRORS[locale]?.[key] ?? API_ERRORS.en[key];
}

/** BR trial reactivation promo — expired trial users only (pt). */
export type ReactivationPromoEmailCopy = {
    subject: string;
    preheader: string;
    badge: string;
    title: string;
    subtitle: string;
    intro: string;
    dataPreserved: string;
    promoHeadline: string;
    planName: string;
    originalPrice: string;
    promoPrice: string;
    promoDuration: string;
    benefitsTitle: string;
    benefits: string[];
    ctaLabel: string;
    footerNote: string;
    legalNote: string;
};

const REACTIVATION_PROMO_PT: ReactivationPromoEmailCopy = {
    subject: 'Volte ao PrecisionAI — Starter por R$ 59/mês nos primeiros 6 meses',
    preheader: 'Seus leads e análises estão guardados. Oferta exclusiva de reativação por tempo limitado.',
    badge: 'Oferta de reativação',
    title: 'Seu teste encerrou — mas sua prospecção não precisa parar',
    subtitle: 'Condição exclusiva para quem já conhece a plataforma',
    intro: 'Você explorou o PrecisionAI no período de teste e construiu uma base valiosa de leads e análises. Agora é o momento de retomar com tudo — com um desconto especial no plano Starter.',
    dataPreserved: 'Todos os seus leads salvos, buscas e análises de IA continuam guardados. Ao assinar, você recupera o acesso imediatamente.',
    promoHeadline: 'Plano Starter com desconto de reativação',
    planName: 'Starter',
    originalPrice: 'R$ 99',
    promoPrice: 'R$ 59',
    promoDuration: '6 meses',
    benefitsTitle: 'Tudo que você precisa para prospectar com IA',
    benefits: [
        'Busca inteligente de leads com Google Maps e IA',
        'Análise IA por lead: score, abordagem e mensagens prontas',
        'Concorrência, Market Intel e Viabilidade de mercado',
        'Pipeline CRM com integrações HubSpot, RD Station e Agendor',
        'Créditos mensais renováveis e suporte dedicado',
        'Promoção limitada: desconto válido por 6 meses',
    ],
    ctaLabel: 'Assinar Starter com desconto',
    footerNote: 'Oferta exclusiva para contas com trial encerrado no Brasil. Cancele quando quiser.',
    legalNote: 'Preço promocional de R$ 59/mês no plano Starter por 6 meses. Após o período promocional, renovação ao valor de R$ 99/mês. Sujeito à disponibilidade.',
};

export function getReactivationPromoEmailCopy(): ReactivationPromoEmailCopy {
    return REACTIVATION_PROMO_PT;
}

/** Checkout URL for BR reactivation promo. */
export function getReactivationPromoCheckoutUrl(siteUrl?: string): string {
    const base = (siteUrl ?? 'https://precisionia.com.br').replace(/\/$/, '');
    return `${base}/checkout?promo=reactivation`;
}
