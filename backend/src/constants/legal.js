/**
 * Kwickly Official Legal Policies and FAQ Templates
 */

const DEFAULT_TERMS_OF_SERVICE = `Welcome to Kwickly. By downloading, accessing, or using the Kwickly platform ("App", "Website", or "Services"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use the Platform.

1. PLATFORM OVERVIEW
Kwickly is a technology aggregator platform that connects customers with independent service professionals ("Workers") and local retail merchants ("Shops"). Kwickly provides the software platform, search & matching algorithms, and automated payment/settlement tools.

2. USER ACCOUNTS & VERIFICATION
• Users must provide accurate mobile numbers and verify via One-Time Password (OTP).
• Workers and Shops must complete mandatory Know-Your-Customer (KYC) verification with government ID proof before offering services or goods on the platform.
• You are responsible for maintaining the security of your account and MPIN.

3. SERVICE BOOKINGS & PRICING
• Quotes: Workers submit quotes based on customer job descriptions. Accepting a quote forms a direct service contract between the Customer and the Worker.
• Security OTPs: Service jobs utilize an Arrival OTP and a Completion OTP to guarantee work completion before payments are released.
• Platform Fees: Kwickly charges a transparent platform convenience fee and applicable taxes (GST) on completed jobs as configured by the platform.

4. SHOP ORDERS & FAST DELIVERY
• Customers can browse local stores, add items to cart, select delivery slots, and place orders.
• Delivery OTP: Customers must verify the Delivery OTP with the delivery personnel upon receiving their order.
• Stock & Cancellations: Unconfirmed orders are automatically cancelled after 30 minutes with 100% immediate wallet refund.

5. PAYMENTS, DIRECT UPI & WALLET
• Payments can be made via Kwickly Wallet, Direct NPCI UPI Intent (Google Pay, PhonePe, Paytm, BHIM), or Cash on Delivery where permitted.
• 0% MDR Direct UPI: UPI payments transfer directly to platform accounts with zero gateway processing markups.
• Automated Webhook Reconciliation: Online payments are verified in real-time via cryptographically signed webhooks.

6. CANCELLATION & REFUND POLICY
• Customer Cancellations: You may cancel a booking or order before dispatch or worker arrival without penalty.
• Automatic Refunds: Cancelled prepaid orders and failed transactions are refunded instantly to your Kwickly Wallet balance.
• Wallet Withdrawals: Workers and Shops can request payouts of their available earnings to their verified Bank/UPI accounts.

7. PROHIBITED CONDUCT
Users shall not engage in fraudulent quotes, off-platform payment evasion, abusive communication, or illegal commerce. Violations result in permanent suspension and forfeiture of trial privileges.

8. CONTACT & GRIEVANCE
For queries, disputes, or legal notices, contact Kwickly Support at support@kwickly.com or through the in-app 24/7 Support Chat.`;

const DEFAULT_PRIVACY_POLICY = `Kwickly ("we", "our", or "us") values your trust and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our mobile applications and services.

1. INFORMATION WE COLLECT
• Account Data: Name, mobile phone number, profile image, and email address.
• Location Data: We collect precise background and foreground location data to enable nearby worker discovery, live delivery tracking, and accurate service radius matching.
• KYC & Professional Documents: For Workers and Shops, we securely collect government identity cards (Aadhaar, PAN, Driving License) solely for background verification and platform safety.
• Transaction Information: Transaction IDs, order history, and wallet credit/debit records. We do NOT store sensitive bank passwords or UPI PINs.

2. HOW WE USE YOUR INFORMATION
• To connect customers with the nearest eligible service workers and local shops.
• To calculate accurate ETAs, service distances, and delivery routes.
• To process automated UPI and wallet payments with cryptographically signed verification.
• To prevent fraud, double-billing, and unauthorized account access.
• To send essential push notifications regarding job status, order updates, and OTPs.

3. DATA SHARING & DISCLOSURE
• With Counterparts: We share necessary contact info (customer name, pickup/delivery address, phone number) with the assigned worker or shop solely to fulfill the requested service.
• With Payment Providers: Minimal reference metadata is transmitted to secure banking and UPI gateways for transaction verification.
• Legal Compliance: We may disclose information if mandated by Indian law enforcement or court order.

4. DATA SECURITY & RETENTION
All data in transit is protected using industry-standard TLS encryption. Passwords and MPINs are hashed using bcrypt. We retain your profile data as long as your account remains active.

5. YOUR RIGHTS & CHOICES
• You can review, update, or edit your profile and addresses at any time in the App Settings.
• You can toggle location permissions in your device settings.
• You may request account deactivation by contacting support@kwickly.com.

6. GRIEVANCE OFFICER
In accordance with Information Technology Rules, contact our Grievance Officer at grievance@kwickly.com.`;

const DEFAULT_FAQS = [
    // Customer FAQs
    {
        question: 'How do I book a service worker?',
        answer: 'Tap "Book" on the home screen, select your service category (e.g. Electrician, Plumber), describe your requirements, and post the job. Nearby verified workers will submit quotes within minutes for you to compare and accept.',
        targetRole: 'CUSTOMER',
        order: 1
    },
    {
        question: 'How do I pay for my shop order or service?',
        answer: 'You can pay instantly using your Kwickly Wallet, 1-Click Direct UPI (Google Pay, PhonePe, Paytm, BHIM), or Cash upon service completion. All online payments are securely verified in real-time.',
        targetRole: 'CUSTOMER',
        order: 2
    },
    {
        question: 'How do refunds work for cancelled orders?',
        answer: 'If you or the store cancels a prepaid order, the entire amount is instantly refunded to your Kwickly Wallet balance with zero deduction.',
        targetRole: 'CUSTOMER',
        order: 3
    },
    {
        question: 'What is the Security / Completion OTP?',
        answer: 'When a worker arrives and completes your job, they will request the 4-digit OTP shown on your booking screen. This ensures work is inspected and approved before the job is marked complete.',
        targetRole: 'CUSTOMER',
        order: 4
    },
    // Worker FAQs
    {
        question: 'How do I receive customer job alerts?',
        answer: 'Ensure your KYC is approved, your subscription/free trial is active, your GPS location is enabled, and your toggle is set to "Online". You will receive instant notifications whenever a customer posts a job in your area.',
        targetRole: 'WORKER',
        order: 5
    },
    {
        question: 'How do I withdraw my earnings to my bank account?',
        answer: 'Navigate to the Earnings screen, tap "Withdraw", enter the amount, and choose your saved Bank Account or UPI ID. Payouts are processed by the admin team to your bank.',
        targetRole: 'WORKER',
        order: 6
    },
    {
        question: 'How does the subscription plan work?',
        answer: 'New workers receive a free trial period. After the trial, you can choose a monthly or annual priority subscription plan to continue bidding on unlimited jobs with lowest platform fees.',
        targetRole: 'WORKER',
        order: 7
    },
    // Shop FAQs
    {
        question: 'How do shop orders and settlements work?',
        answer: 'When customers place orders from your store, you receive a real-time order alert. Once packed and delivered, the net product sales amount is credited to your Shop Wallet and settled per the payout schedule.',
        targetRole: 'SHOP',
        order: 8
    },
    {
        question: 'How do I add or update products in my shop?',
        answer: 'Go to your Shop Dashboard -> Products tab. You can add new products with images, set pricing, adjust stock, or toggle availability if an item is temporarily sold out.',
        targetRole: 'SHOP',
        order: 9
    }
];

module.exports = {
    DEFAULT_TERMS_OF_SERVICE,
    DEFAULT_PRIVACY_POLICY,
    DEFAULT_FAQS
};
