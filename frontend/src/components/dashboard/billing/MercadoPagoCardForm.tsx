import { useMemo } from 'react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

let sdkInitialized = false;

function ensureSdk(): boolean {
    const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || import.meta.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) return false;
    if (!sdkInitialized) {
        initMercadoPago(publicKey, { locale: 'pt-BR' });
        sdkInitialized = true;
    }
    return true;
}

interface MercadoPagoCardFormProps {
    amount: number;
    payerEmail: string;
    /** Called with the card token; the backend creates the recurring subscription with it. */
    onToken: (token: string) => void;
}

/** Mercado Pago Card Payment Brick: tokenizes the credit card in the browser (card data never reaches our API). */
export default function MercadoPagoCardForm({ amount, payerEmail, onToken }: MercadoPagoCardFormProps) {
    const ready = useMemo(() => ensureSdk(), []);

    if (!ready) {
        return <p className="text-sm text-red-600">Pagamento com cartão indisponível no momento. Use PIX ou fale com o suporte.</p>;
    }

    return (
        <CardPayment
            initialization={{ amount, payer: { email: payerEmail } }}
            customization={{
                paymentMethods: { maxInstallments: 1, types: { excluded: ['debit_card', 'prepaid_card'] } },
                visual: { hidePaymentButton: false },
            }}
            onSubmit={async (formData) => {
                onToken(formData.token);
            }}
        />
    );
}
