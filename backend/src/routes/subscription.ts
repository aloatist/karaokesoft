import { Router } from 'express'
import Stripe from 'stripe'
import { authenticate } from '../middleware/authenticate'
import { prisma } from '../server'
import { logger } from '../utils/logger'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
})

// Get subscription plans
router.get('/plans', async (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        features: ['50 searches/day', 'Basic karaoke', 'Mobile remote'],
        limits: { dailyQuota: 50 }
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 500, // $5.00 in cents
        currency: 'usd',
        features: ['500 searches/day', 'No ads', 'Unlimited playlists', 'Email support'],
        limits: { dailyQuota: 500 }
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 1500, // $15.00 in cents
        currency: 'usd',
        features: ['Unlimited searches', 'Dedicated API key', 'Priority support', 'Early access'],
        limits: { dailyQuota: -1 } // unlimited
      }
    ]
  })
})

// Create checkout session
router.post('/checkout', authenticate, async (req, res, next) => {
  try {
    const { planId } = req.body

    const planPrices: Record<string, string> = {
      premium: process.env.STRIPE_PREMIUM_PRICE_ID || '',
      pro: process.env.STRIPE_PRO_PRICE_ID || ''
    }

    const priceId = planPrices[planId]
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
      })
      customerId = customer.id

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId }
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: { userId: user.id, planId }
    })

    res.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    next(error)
  }
})

// Get current subscription
router.get('/current', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        stripeSubscriptionId: true
      }
    })

    if (!user?.stripeSubscriptionId) {
      return res.json({ subscription: null })
    }

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId
    )

    res.json({
      subscription: {
        tier: user.subscriptionTier,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    })
  } catch (error) {
    next(error)
  }
})

// Cancel subscription
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    })

    if (!user?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription' })
    }

    // Cancel at period end
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    })

    await prisma.user.update({
      where: { id: req.userId },
      data: { subscriptionStatus: 'cancelled' }
    })

    logger.info(`Subscription cancelled: ${user.email}`)

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// Resume subscription
router.post('/resume', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    })

    if (!user?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription to resume' })
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false
    })

    await prisma.user.update({
      where: { id: req.userId },
      data: { subscriptionStatus: 'active' }
    })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export { router as subscriptionRouter }
