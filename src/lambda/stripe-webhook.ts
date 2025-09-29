import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import Stripe from 'stripe';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

    if (!signature) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'Missing Stripe signature' })
      };
    }

    const rawBody = event.body;
    if (!rawBody) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    // Construct the event
    const stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    // Handle the event
    await handleWebhookEvent(stripeEvent);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ received: true })
    };

  } catch (error: any) {
    console.error('Webhook processing failed:', error);

    return {
      statusCode: 400,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        error: error.message || 'Webhook processing failed'
      })
    };
  }
};

async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  console.log(`Processing webhook event: ${event.type}`);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_succeeded':
      await handlePaymentSuccess(event.data.object as Stripe.Invoice);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailure(event.data.object as Stripe.Invoice);
      break;
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  try {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    // Determine subscription tier based on the price
    let subscriptionTier = 'free';
    if (subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id;
      // Check if it's a premium plan
      if (priceId.includes('premium')) {
        subscriptionTier = 'premium';
      }
    }

    // Update user subscription in database
    await dynamoClient.send(new UpdateItemCommand({
      TableName: process.env.USERS_TABLE!,
      Key: { user_id: { S: userId } },
      UpdateExpression: 'SET subscription_tier = :tier, subscription_id = :subId, subscription_expires_at = :expires, updated_at = :updated',
      ExpressionAttributeValues: {
        ':tier': { S: subscriptionTier },
        ':subId': { S: subscription.id },
        ':expires': { S: new Date(subscription.current_period_end * 1000).toISOString() },
        ':updated': { S: new Date().toISOString() }
      }
    }));

    console.log(`Updated subscription for user ${userId}: ${subscriptionTier}`);
  } catch (error) {
    console.error('Failed to handle subscription change:', error);
  }
}

async function handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
  try {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    // Downgrade user to free tier
    await dynamoClient.send(new UpdateItemCommand({
      TableName: process.env.USERS_TABLE!,
      Key: { user_id: { S: userId } },
      UpdateExpression: 'SET subscription_tier = :tier, updated_at = :updated',
      ExpressionAttributeValues: {
        ':tier': { S: 'free' },
        ':updated': { S: new Date().toISOString() }
      }
    }));

    console.log(`Cancelled subscription for user ${userId}`);
  } catch (error) {
    console.error('Failed to handle subscription cancellation:', error);
  }
}

async function handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
  try {
    console.log(`Payment succeeded for invoice ${invoice.id}`);
    // Could send confirmation emails, update billing history, etc.
  } catch (error) {
    console.error('Failed to handle payment success:', error);
  }
}

async function handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
  try {
    console.log(`Payment failed for invoice ${invoice.id}`);
    // Could send payment failure notifications, suspend access, etc.
  } catch (error) {
    console.error('Failed to handle payment failure:', error);
  }
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };
}