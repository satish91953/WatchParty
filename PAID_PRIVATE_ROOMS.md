# Paid Private Rooms with Video+Voice Chat - Implementation Plan

## Business Model Overview

**Free Tier:**
- Public rooms (unlimited)
- Voice chat in all rooms
- Basic features

**Premium Tier (Private Rooms):**
- Password-protected private rooms
- Voice + Video chat
- Enhanced features
- Priority support

---

## 1. Payment System Architecture

### Payment Provider Options

#### **Option A: Stripe (Recommended)**
**Pros:**
- Most popular, well-documented
- Supports subscriptions, one-time payments
- Good developer experience
- Handles taxes, refunds automatically
- Webhook support for payment events

**Cons:**
- 2.9% + $0.30 per transaction
- Requires business verification

**Setup:**
```bash
npm install stripe
```

#### **Option B: PayPal**
**Pros:**
- Widely recognized
- Good for international users
- Lower fees in some regions

**Cons:**
- More complex integration
- Less developer-friendly

#### **Option C: Paddle**
**Pros:**
- Handles taxes globally
- Good for SaaS
- Lower fees than Stripe

**Cons:**
- Less known
- Smaller ecosystem

### Recommended: **Stripe**

---

## 2. Database Schema Changes

### New Models Needed

#### **1. Subscription Model**
```javascript
// server/models/Subscription.js
const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  stripeCustomerId: {
    type: String,
    required: true,
    unique: true
  },
  stripeSubscriptionId: {
    type: String,
    unique: true,
    sparse: true
  },
  plan: {
    type: String,
    enum: ['free', 'premium_monthly', 'premium_yearly'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'trialing'],
    default: 'active'
  },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
```

#### **2. Payment Model**
```javascript
// server/models/Payment.js
const paymentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  stripePaymentIntentId: String,
  amount: Number,
  currency: {
    type: String,
    default: 'usd'
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'refunded']
  },
  plan: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});
```

#### **3. Update Room Model**
```javascript
// Add to existing Room model:
subscriptionRequired: {
  type: Boolean,
  default: false
},
subscriptionOwner: {
  type: String, // userId of subscription owner
  default: null
},
maxParticipants: {
  type: Number,
  default: 10 // Higher for premium
},
videoChatEnabled: {
  type: Boolean,
  default: false // Only for paid private rooms
}
```

#### **4. Update User Model (if exists)**
```javascript
// Add subscription fields:
subscription: {
  plan: {
    type: String,
    enum: ['free', 'premium_monthly', 'premium_yearly'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due'],
    default: 'active'
  },
  stripeCustomerId: String,
  currentPeriodEnd: Date
}
```

---

## 3. Pricing Plans

### Recommended Pricing

#### **Free Plan**
- Public rooms: Unlimited
- Voice chat: ✅
- Video chat: ❌
- Max participants: 10
- Price: $0/month

#### **Premium Monthly**
- Private rooms: Unlimited
- Voice + Video chat: ✅
- Max participants: 20
- Priority support: ✅
- Price: **$9.99/month**

#### **Premium Yearly**
- Same as monthly
- Price: **$99.99/year** (save $20)

### Alternative Pricing Models

1. **Per-Room Pricing**: $2.99 per private room (one-time)
2. **Pay-as-you-go**: $0.50 per hour of video chat
3. **Team Plans**: $29.99/month for up to 10 users

---

## 4. Implementation Steps

### Phase 1: Payment Infrastructure (Week 1-2)

#### **Step 1.1: Install Dependencies**
```bash
cd server
npm install stripe
```

#### **Step 1.2: Create Subscription Model**
- Create `server/models/Subscription.js`
- Create `server/models/Payment.js`
- Update `server/models/Room.js`

#### **Step 1.3: Stripe Setup**
1. Create Stripe account
2. Get API keys (test and live)
3. Set up webhook endpoint
4. Configure products in Stripe Dashboard

#### **Step 1.4: Payment Routes**
```javascript
// server/routes/payments.js
POST /api/payments/create-checkout-session
POST /api/payments/create-subscription
POST /api/payments/cancel-subscription
GET /api/payments/subscription-status
POST /api/payments/webhook (Stripe webhook)
```

### Phase 2: Access Control (Week 2-3)

#### **Step 2.1: Subscription Middleware**
```javascript
// server/middleware/subscription.js
const checkSubscription = async (req, res, next) => {
  // Check if user has active premium subscription
  // Allow/deny access to private room features
};
```

#### **Step 2.2: Room Creation Logic**
- Check subscription status before creating private room
- Set `videoChatEnabled: true` for premium users
- Set `subscriptionRequired: true` for private rooms

#### **Step 2.3: Join Room Logic**
- Verify subscription for private rooms
- Check if room requires subscription
- Allow/deny access based on subscription

### Phase 3: Video Chat Implementation (Week 3-4)

#### **Step 3.1: Extend WebRTC for Video**
```javascript
// client/src/components/VideoChat.jsx
// Similar to VoiceChat but with video tracks
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
});
```

#### **Step 3.2: Video UI Components**
- Video grid container
- Video toggle button
- Camera switch (front/back)
- Video quality selector
- Picture-in-picture mode

#### **Step 3.3: Server-Side Video Signaling**
- Extend voice chat signaling to include video
- Track video state in Room model
- Emit video events to room participants

### Phase 4: UI/UX (Week 4-5)

#### **Step 4.1: Payment UI**
- Subscription page
- Checkout flow
- Payment success/failure pages
- Subscription management page

#### **Step 4.2: Premium Features UI**
- "Upgrade to Premium" buttons
- Feature comparison table
- Subscription status indicator
- Billing history

#### **Step 4.3: Video Chat UI**
- Video grid layout
- Video controls
- Settings panel

---

## 5. Code Structure

### Server Structure
```
server/
├── models/
│   ├── Subscription.js (new)
│   ├── Payment.js (new)
│   └── Room.js (updated)
├── routes/
│   └── payments.js (new)
├── middleware/
│   └── subscription.js (new)
├── services/
│   └── stripe.js (new)
└── server.js (updated)
```

### Client Structure
```
client/src/
├── components/
│   ├── VideoChat.jsx (new)
│   ├── Subscription.jsx (new)
│   ├── PaymentCheckout.jsx (new)
│   └── PremiumFeatures.jsx (new)
├── contexts/
│   └── SubscriptionContext.js (new)
└── App.js (updated)
```

---

## 6. API Endpoints

### Payment Endpoints

```javascript
// Create checkout session
POST /api/payments/create-checkout-session
Body: { plan: 'premium_monthly' | 'premium_yearly' }
Response: { sessionId: 'cs_...', url: 'https://checkout.stripe.com/...' }

// Get subscription status
GET /api/payments/subscription-status
Response: { 
  plan: 'premium_monthly',
  status: 'active',
  currentPeriodEnd: '2024-12-31'
}

// Cancel subscription
POST /api/payments/cancel-subscription
Response: { success: true, cancelAtPeriodEnd: true }

// Webhook (Stripe)
POST /api/payments/webhook
Body: Stripe webhook event
```

### Room Endpoints (Updated)

```javascript
// Create private room (check subscription)
POST /api/rooms/create
Body: { 
  name: 'My Room',
  isPrivate: true,
  password: '...',
  videoChatEnabled: true // Only if premium
}
Response: { roomId: '...', requiresSubscription: true }

// Join private room (check subscription)
POST /api/rooms/join
Body: { roomId: '...', password: '...' }
Response: { success: true, videoChatEnabled: true }
```

---

## 7. Security Considerations

### Payment Security
- ✅ Never store credit card details
- ✅ Use Stripe's secure checkout
- ✅ Verify webhook signatures
- ✅ Use HTTPS only
- ✅ Validate subscription on server-side

### Access Control
- ✅ Check subscription status on server
- ✅ Don't trust client-side checks
- ✅ Verify subscription before enabling video
- ✅ Rate limit payment endpoints

### Data Privacy
- ✅ Encrypt sensitive payment data
- ✅ Comply with GDPR/CCPA
- ✅ Store minimal payment info
- ✅ Allow subscription cancellation

---

## 8. Testing Strategy

### Payment Testing
1. **Stripe Test Mode**
   - Use test cards
   - Test successful payments
   - Test failed payments
   - Test subscription cancellation

2. **Webhook Testing**
   - Use Stripe CLI for local testing
   - Test all webhook events
   - Verify subscription updates

### Feature Testing
1. **Subscription Flow**
   - Create subscription
   - Access private room
   - Video chat works
   - Subscription expires
   - Access denied after expiration

2. **Video Chat Testing**
   - Multiple participants
   - Video quality
   - Bandwidth handling
   - Mobile devices

---

## 9. Environment Variables

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_YEARLY=price_...
```

---

## 10. UI/UX Flow

### Subscription Flow

1. **User clicks "Create Private Room"**
   - If not subscribed → Show upgrade modal
   - If subscribed → Show create room form

2. **Upgrade Modal**
   - Feature comparison
   - Pricing options
   - "Upgrade Now" button

3. **Checkout**
   - Redirect to Stripe Checkout
   - User enters payment info
   - Stripe processes payment

4. **Success**
   - Redirect back to app
   - Show success message
   - Enable private room creation

5. **Private Room**
   - Create room with video enabled
   - Users can join with password
   - Video chat available

---

## 11. Pricing Strategy Recommendations

### Initial Launch Pricing
- **Free**: Public rooms, voice chat
- **Premium**: $9.99/month or $99.99/year
  - Private rooms
  - Video + Voice chat
  - Up to 20 participants

### Future Pricing Tiers (Optional)
- **Pro**: $19.99/month
  - Up to 50 participants
  - Screen sharing
  - Recording
- **Enterprise**: Custom pricing
  - Unlimited participants
  - Custom branding
  - Priority support

---

## 12. Implementation Checklist

### Backend
- [ ] Install Stripe SDK
- [ ] Create Subscription model
- [ ] Create Payment model
- [ ] Update Room model
- [ ] Create payment routes
- [ ] Create subscription middleware
- [ ] Set up Stripe webhook
- [ ] Add subscription checks to room creation
- [ ] Add subscription checks to room joining

### Frontend
- [ ] Create Subscription component
- [ ] Create PaymentCheckout component
- [ ] Create VideoChat component
- [ ] Add subscription context
- [ ] Update RoomControls for premium
- [ ] Add upgrade prompts
- [ ] Add subscription status display

### Video Chat
- [ ] Extend WebRTC for video
- [ ] Create video UI components
- [ ] Add video controls
- [ ] Implement video grid
- [ ] Add quality settings
- [ ] Test with multiple users

### Testing
- [ ] Test payment flow
- [ ] Test subscription activation
- [ ] Test video chat
- [ ] Test access control
- [ ] Test subscription expiration

---

## 13. Revenue Projections

### Conservative Estimates
- 100 premium users × $9.99 = $999/month
- 50 yearly users × $99.99 = $4,999.50/year = $416/month
- **Total: ~$1,400/month**

### Growth Estimates (6 months)
- 500 premium users = $4,995/month
- 200 yearly users = $1,666/month
- **Total: ~$6,600/month**

---

## 14. Next Steps

1. **Decide on pricing** ($9.99/month recommended)
2. **Set up Stripe account**
3. **Create database models**
4. **Implement payment routes**
5. **Add subscription checks**
6. **Implement video chat**
7. **Build payment UI**
8. **Test end-to-end**
9. **Launch beta**
10. **Monitor and iterate**

---

## 15. Quick Start Implementation

Would you like me to start implementing:
1. ✅ Database models (Subscription, Payment)
2. ✅ Stripe integration
3. ✅ Subscription middleware
4. ✅ Payment routes
5. ✅ Video chat component

Let me know which part you'd like to start with!

