import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(cors());

// Raw payload parsing is required strictly for Stripe Webhook Signature Check
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { userId, spaceId, date, startTime, endTime, guestCount, foodPreorder } = paymentIntent.metadata;
    const parsedFood = JSON.parse(foodPreorder || "[]");

    await prisma.reservation.create({
      data: {
        userId,
        spaceId,
        date: new Date(date),
        startTime,
        endTime,
        guestCount: parseInt(guestCount),
        preorderItems: {
          create: parsedFood.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity
          }))
        }
      }
    });
  }

  res.json({ received: true });
});

// Standard JSON Parser for normal endpoints
app.use(express.json());

app.get('/api/spaces/availability', async (req, res) => {
  const { date, startTime, endTime } = req.query;
  if (!date || !startTime || !endTime) {
    return res.status(400).json({ error: "Missing parameters." });
  }

  try {
    const overlapping = await prisma.reservation.findMany({
      where: {
        date: new Date(date),
        status: 'confirmed',
        OR: [
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          { startTime: { gte: startTime }, endTime: { lte: endTime } }
        ]
      },
      select: { spaceId: true }
    });

    const bookedSpaceIds = overlapping.map(r => r.spaceId);
    const availableSpaces = await prisma.space.findMany({
      where: { id: { notIn: bookedSpaceIds } }
    });

    res.json(availableSpaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/menu', async (req, res) => {
  try {
    const menu = await prisma.menuItem.findMany();
    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations/payment-intent', async (req, res) => {
  const { amount, reservationDetails } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      metadata: {
        userId: reservationDetails.userId,
        spaceId: reservationDetails.spaceId,
        date: reservationDetails.date,
        startTime: reservationDetails.startTime,
        endTime: reservationDetails.endTime,
        guestCount: String(reservationDetails.guestCount),
        foodPreorder: JSON.stringify(reservationDetails.foodPreorder)
      },
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend Active on Port ${PORT}`));