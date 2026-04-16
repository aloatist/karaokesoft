import { Router } from 'express'
import Stripe from 'stripe'
import { prisma } from '../server'
import { logger } from '../utils/logger'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
})

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

// Stripe webhook handler
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature']

  if (!sig || !endpointSecret) {
    return res.status(400).send('Webhook secret not configured')
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error(`Webhook error: ${error}`)
    return res.status(400).send(`Webhook Error: ${error}`)
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      
      if (session.mode === 'subscription') {
        const userId = session.metadata?.userId
        const planId = session.metadata?.planId
        
        if (userId && planId) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )

          // Update user
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionTier: planId,
              subscriptionStatus: 'active',
              stripeSubscriptionId: subscription.id,
              subscriptionExpiresAt: new Date(subscription.current_period_end * 1000)
            }
          })

          // Update API key quota
          const quotaMap: Record<string, number> = {
            premium: 500,
            pro: 10000
          }

          await prisma.apiKey.update({
            where: { userId },
            data: {
              tier: planId,
              dailyQuota: quotaMap[planId] || 50
            }
          })

          // Log payment
          await prisma.payment.create({
            data: {
              userId,
              amount: (session.amount_total || 0) / 100,
              currency: session.currency || 'usd',
              status: 'completed',
              provider: 'stripe',
              providerPaymentId: session.payment_intent as string,
              subscriptionTier: planId,
              isRecurring: true
            }
          })

          logger.info(`Subscription created: ${userId} -> ${planId}`)
        }
      }
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        )

        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id }
        })

        if (user) {
          // Update subscription end date
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionExpiresAt: new Date(subscription.current_period_end * 1000)
            }
          })

          logger.info(`Subscription renewed: ${user.email}`)
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id }
      })

      if (user) {
        // Downgrade to free
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionTier: 'free',
            subscriptionStatus: 'cancelled',
            subscriptionExpiresAt: null
          }
        })

        // Reset API key quota
        await prisma.apiKey.update({
          where: { userId: user.id },
          data: {
            tier: 'free',
            dailyQuota: 50
          }
        })

        logger.info(`Subscription ended: ${user.email}`)
      }
      break
    }

    default:
      logger.info(`Unhandled webhook event: ${event.type}`)
  }

  res.json({ received: true })
})

export { router as webhookRouter }
