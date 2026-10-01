import api from './axios';

export type AsaasCustomer = {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
};

export type CreatePixPaymentInput = {
  eventId: string;
  organizerId: string;
  value: number;
  customer: AsaasCustomer;
  description?: string;
  externalReference?: string;
};

export type CreatePixPaymentResponse = {
  paymentId: string;
  productOrderId?: string;
  pixQrCodeImage: string;
  pixCopiaECola: string;
  expirationDate: string;
  value: number;
  status: string;
};


export type CreditCardHolder = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
};

export type CreditCardData = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

export type CreateCreditCardPaymentInput = {
  eventId: string;
  organizerId: string;
  value: number;
  installmentCount: number;
  customer: AsaasCustomer;
  creditCard: CreditCardData;
  creditCardHolderInfo: CreditCardHolder;
  description?: string;
  externalReference?: string;
};

export type CreateCreditCardPaymentResponse = {
  paymentId: string;
  productOrderId?: string;
  status: string;
  value: number;
  installmentCount: number;
  installmentValue: number;
  authorizationCode?: string;
};

export type CreateProductPixPaymentInput = {
  productId: string;
  value: number;
  customer: AsaasCustomer;
  description?: string;
};

export type CreateProductCreditCardPaymentInput = {
  productId: string;
  value: number;
  installmentCount: number;
  customer: AsaasCustomer;
  creditCard: CreditCardData;
  creditCardHolderInfo: CreditCardHolder;
  description?: string;
};

export type CreateCartPixPaymentInput = {
  productIds: string[];
  value: number;
  customer: AsaasCustomer;
  description?: string;
};

export type CreateCartCreditCardPaymentInput = {
  productIds: string[];
  value: number;
  installmentCount: number;
  customer: AsaasCustomer;
  creditCard: CreditCardData;
  creditCardHolderInfo: CreditCardHolder;
  description?: string;
};

export type CreateRentalPixPaymentInput = {
  rentalOrderId: string;
  value: number;
  customer: AsaasCustomer;
  description?: string;
};

export type CreateRentalCreditCardPaymentInput = {
  rentalOrderId: string;
  value: number;
  installmentCount: number;
  customer: AsaasCustomer;
  creditCard: CreditCardData;
  creditCardHolderInfo: CreditCardHolder;
  description?: string;
};

export const paymentService = {
  createPixPayment: async (input: CreatePixPaymentInput): Promise<CreatePixPaymentResponse> => {
    const { data } = await api.post('/payment/pix', input);
    return data;
  },

  createCreditCardPayment: async (input: CreateCreditCardPaymentInput): Promise<CreateCreditCardPaymentResponse> => {
    const { data } = await api.post('/payment/credit-card', input);
    return data;
  },

  createProductPixPayment: async (input: CreateProductPixPaymentInput): Promise<CreatePixPaymentResponse> => {
    const { data } = await api.post('/payment/product/pix', input);
    return data;
  },

  createProductCreditCardPayment: async (input: CreateProductCreditCardPaymentInput): Promise<CreateCreditCardPaymentResponse> => {
    const { data } = await api.post('/payment/product/credit-card', input);
    return data;
  },

  createCartPixPayment: async (input: CreateCartPixPaymentInput): Promise<CreatePixPaymentResponse> => {
    const { data } = await api.post('/payment/cart/pix', input);
    return data;
  },

  createCartCreditCardPayment: async (input: CreateCartCreditCardPaymentInput): Promise<CreateCreditCardPaymentResponse> => {
    const { data } = await api.post('/payment/cart/credit-card', input);
    return data;
  },

  createRentalPixPayment: async (input: CreateRentalPixPaymentInput): Promise<CreatePixPaymentResponse> => {
    const { data } = await api.post('/payment/rental/pix', input);
    return data;
  },

  createRentalCreditCardPayment: async (input: CreateRentalCreditCardPaymentInput): Promise<CreateCreditCardPaymentResponse> => {
    const { data } = await api.post('/payment/rental/credit-card', input);
    return data;
  },
};
