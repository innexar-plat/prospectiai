'use client';
import React, { useEffect, useState } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

type PaymentOnSubmit = React.ComponentProps<typeof Payment>['onSubmit'];

// Use a global flag to ensure init only happens once across re-renders
let sdkInitialized = false;

interface MPBrickProps {
    planId: string;
    interval: 'monthly' | 'annual';
    price: number;
    userEmail: string;
    onSuccess: () => void;
    onError: (err: unknown) => void;
}

export default function MercadoPagoBrick({ planId, interval, price, userEmail, onSuccess, onError }: MPBrickProps) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || import.meta.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
        if (publicKey && !sdkInitialized) {
            initMercadoPago(publicKey, { locale: 'pt-BR' });
            sdkInitialized = true;
            console.log('MP SDK Configured Global');
        }
        queueMicrotask(() => setIsReady(true));
    }, []);

    const initialization = {
        amount: price,
        payer: {
            email: userEmail,
            // SDK types are incomplete; these fields are required by the API (see Mercado Pago Brick docs).
            entity_type: 'individual' as const,
            entityType: 'individual' as const,
        },
    };

    // SDK expects specific literal types; cast to satisfy Payment component customization prop.
    const customization = {
        paymentMethods: {
            ticket: 'all' as const,
            bankTransfer: 'all' as const,
            creditCard: 'all' as const,
            debitCard: 'all' as const,
            mercadoPago: 'all' as const,
        },
        visual: {
            style: {
                theme: 'dark' as const,
            }
        },
    } as React.ComponentProps<typeof Payment>['customization'];

    const onSubmit: PaymentOnSubmit = async (param) => {
        const selectedPaymentMethod = param.selectedPaymentMethod;
        const formData = (param.formData ?? {}) as unknown as Record<string, unknown>;
        try {
            console.log('Payment form submitted', selectedPaymentMethod);
            const response = await fetch("/api/billing/process-payment", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData,
                    planId,
                    interval,
                }),
            });

            const data = await response.json();
            console.log('Payment API Complete Result:', data);

            if (data.status === 'approved' || data.status === 'pending' || data.status === 'in_process') {
                if (data.status === 'approved') {
                    onSuccess();
                }
                // Returning the JSON response. 
                // In v2 of the Brick, this is what triggers the success/pending screen.
                return data;
            } else {
                const errorMessage = data.status
                    ? `Pagamento ${data.status}: ${data.status_detail || 'Erro'}`
                    : (data.error || 'Erro no processamento');

                onError(new Error(errorMessage));
                return { error: errorMessage }; // Return error to the brick to show internal error
            }
        } catch (error: unknown) {
            console.error('Payment Submission Exception:', error);
            onError(error);
            throw error;
        }
    };

    if (!isReady) return <div className="text-gray-400">Iniciando Checkout...</div>;

    return (
        <div
            id="mercado-pago-brick-container"
            style={{
                minHeight: '700px',
                width: '100%',
                position: 'relative'
            }}
        >
            <Payment
                initialization={initialization}
                customization={customization}
                onSubmit={onSubmit}
                onReady={() => console.log('MP Brick UI Ready')}
                onError={(err: unknown) => {
                    console.error('MP Brick Component Error:', err);
                    // Do not call parent onError here if it's just a validation warning
                }}
            />
        </div>
    );
}
