declare module '@paypal/payouts-sdk' {
  namespace core {
    class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    class PayPalHttpClient {
      constructor(environment: SandboxEnvironment | LiveEnvironment);
      execute<T>(request: any): Promise<{ result: T; statusCode: number }>;
    }
  }
  namespace payouts {
    class PayoutsPostRequest {
      constructor();
      requestBody(body: PayoutsPostRequestBody): void;
    }
    interface PayoutsPostRequestBody {
      sender_batch_header: {
        sender_batch_id: string;
        email_subject?: string;
        email_message?: string;
      };
      items: PayoutItem[];
    }
    interface PayoutItem {
      recipient_type: 'EMAIL' | 'PHONE' | 'PAYPAL_ID';
      amount: {
        value: string;
        currency: string;
      };
      receiver: string;
      note?: string;
      sender_item_id?: string;
    }
    interface PayoutsPostResponse {
      batch_header: {
        payout_batch_id: string;
        batch_status: string;
        sender_batch_header: {
          sender_batch_id: string;
        };
      };
    }
    class PayoutsGetRequest {
      constructor(payoutBatchId: string);
    }
    interface PayoutsGetResponse {
      batch_header: {
        payout_batch_id: string;
        batch_status: string;
      };
      items: PayoutItemResponse[];
    }
    interface PayoutItemResponse {
      payout_item_id: string;
      transaction_status: string;
      payout_item: {
        sender_item_id: string;
        receiver: string;
        amount: {
          value: string;
          currency: string;
        };
      };
      errors?: {
        name: string;
        message: string;
      };
    }
  }
  export = { core, payouts };
}
