import { PaymentStatus } from '@prisma/client';

export interface InitiatePaymentRequest {
    amount: number;
    currency: string;
    customer_phone: string;
    customer_email?: string;
    reference_id: string;
}

export interface InitiatePaymentResponse {
    success: boolean;
    provider_transaction_id: string;
    status: PaymentStatus;
    message?: string;
}

export interface CheckPaymentStatusRequest {
    provider_transaction_id: string;
    reference_id?: string;
}

export interface CheckPaymentStatusResponse {
    status: PaymentStatus;
    provider_transaction_id: string;
    amount?: number;
    message?: string;
}

export interface PaymentProvider {

    initiatePayment(
        request: InitiatePaymentRequest,
    ): Promise<InitiatePaymentResponse>;


    checkPaymentStatus(
        request: CheckPaymentStatusRequest,
    ): Promise<CheckPaymentStatusResponse>;


    getProviderName(): string;
}

