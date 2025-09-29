import Stripe from 'stripe';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in cents
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
}

interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

interface SubscriptionData {
  subscriptionId: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export class PaymentService {
  private stripe: Stripe;
  private plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'month',
      features: [
        'Access to 5 public prompts',
        'Basic slash commands',
        'Community support'
      ],
      stripePriceId: ''
    },
    {
      id: 'premium_monthly',
      name: 'Premium Monthly',
      price: 999, // $9.99
      interval: 'month',
      features: [
        'Unlimited prompt access',
        'Upload custom prompts',
        'Advanced slash commands',
        'Priority support',
        'Premium templates'
      ],
      stripePriceId: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || ''
    },
    {
      id: 'premium_yearly',
      name: 'Premium Yearly',
      price: 9999, // $99.99
      interval: 'year',
      features: [
        'All Premium Monthly features',
        '2 months free',
        'Early access to new features'
      ],
      stripePriceId: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID || ''
    }
  ];

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16'
    });
  }

  async createPaymentIntent(amount: number, currency: string = 'usd', metadata?: Record<string, string>): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata: metadata || {}
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount,
        currency
      };
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  async createSubscription(userId: string, email: string, planId: string, paymentMethodId?: string): Promise<SubscriptionData> {
    try {
      const plan = this.plans.find(p => p.id === planId);
      if (!plan || plan.id === 'free') {
        throw new Error('Invalid subscription plan');
      }

      // Create or retrieve customer
      let customer;
      try {
        customer = await this.stripe.customers.create({
          email,
          metadata: {
            userId
          }
        });
      } catch (error) {
        // Customer might already exist
        const customers = await this.stripe.customers.list({ email });
        customer = customers.data[0];
        if (!customer) throw error;
      }

      // Create subscription
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [{
          price: plan.stripePriceId
        }],
        metadata: {
          userId,
          planId
        },
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      };

      if (paymentMethodId) {
        subscriptionParams.default_payment_method = paymentMethodId;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      return {
        subscriptionId: subscription.id,
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false
      };
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    try {
      if (cancelAtPeriodEnd) {
        await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      } else {
        await this.stripe.subscriptions.cancel(subscriptionId);
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.Invoice);
          break;
      }
    } catch (error) {
      console.error('Webhook processing failed:', error);
      throw error;
    }
  }

  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    // Update user subscription status in database
    // This would be implemented to update the users table
    console.log('Subscription changed:', subscription.id, subscription.status);
  }

  private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    // Update user subscription to free tier
    console.log('Subscription cancelled:', subscription.id);
  }

  private async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    // Handle successful payment
    console.log('Payment succeeded:', invoice.id);
  }

  private async handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
    // Handle failed payment
    console.log('Payment failed:', invoice.id);
  }

  getPlans(): SubscriptionPlan[] {
    return this.plans;
  }

  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.plans.find(p => p.id === planId);
  }

  validatePlan(planId: string): boolean {
    return this.plans.some(p => p.id === planId);
  }
}