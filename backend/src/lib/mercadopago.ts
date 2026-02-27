import { MercadoPagoConfig, Preference } from 'mercadopago';

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    // We don't throw here to allow the app to boot even without MP configured,
    // but the checkout will fail gracefully if token is missing.
    import('@/lib/logger').then(({ logger }) => logger.warn('MERCADOPAGO_ACCESS_TOKEN is not defined'));
}

export const mpConfig = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    options: { timeout: 5000 }
});

export const preference = new Preference(mpConfig);
