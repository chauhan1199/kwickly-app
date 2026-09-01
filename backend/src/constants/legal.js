/**
 * Kwickly Official Legal Policies and FAQ Templates
 * Comprehensive, role-tailored legal terms, privacy guidelines, and FAQs
 * reflecting Kwickly's hyperlocal services, shop marketplace, 0% MDR direct UPI,
 * dual-OTP security, worker subscription model, and wallet settlement architecture.
 */

const DEFAULT_TERMS_OF_SERVICE = `Welcome to Kwickly. By downloading, accessing, browsing, or using the Kwickly mobile application, website, or associated services (collectively, the "Platform" or "Services"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not access or use the Platform.

1. PLATFORM OVERVIEW & CONTRACTUAL RELATIONSHIP
Kwickly Technologies Private Limited ("Kwickly", "we", "us", or "our") operates an on-demand hyperlocal technology aggregator. The Platform connects:
a) End-user consumers ("Customers") seeking on-demand home and commercial services or retail products;
b) Independent verified service professionals ("Workers" or "Service Partners"); and
c) Local retail merchants and storefronts ("Shops" or "Merchant Partners").

Kwickly provides software matching, digital communication, route optimization, quote bidding, and payment settlement facilitation. Kwickly is not an employer, contractor, or retail seller of services or goods provided by independent Partners.

2. USER ACCOUNTS, ELIGIBILITY & KYC VERIFICATION
• Eligibility: You must be at least 18 years of age and legally competent to enter into binding contracts under Indian law.
• Authentication: Account access is authenticated via mobile number and secure One-Time Password (OTP) or MPIN. You are solely responsible for maintaining the confidentiality of your credentials.
• Partner Verification (KYC): All Service Partners and Merchants must undergo mandatory Know-Your-Customer (KYC) verification, including submission of government identification (Aadhaar, PAN, Driving License) and business documentation before receiving job dispatches or listing inventory.

3. ON-DEMAND SERVICE BOOKINGS & DUAL-OTP SECURITY
• Job Posting & Quotes: Customers submit service requests detailing task specifications and location. Nearby verified Workers submit competitive quotes. Acceptance of a quote constitutes a direct agreement between Customer and Worker.
• Arrival OTP: Upon reaching the customer location, the Worker must request and verify the 4-digit Arrival OTP to confirm on-site presence.
• Completion OTP: The customer must inspect the completed work and share the 4-digit Completion OTP ONLY when fully satisfied. Entering the Completion OTP confirms satisfactory delivery and triggers payment release.
• Materials & Additional Work: Any additional hardware, spare parts, or out-of-scope labor agreed upon on-site must be documented and settled through the Platform.

4. HYPERLOCAL SHOPPING & DELIVERY
• Product Listings: Merchants are solely responsible for accurate pricing, descriptions, freshness, and inventory availability.
• 30-Minute Acceptance SLA: If a merchant does not accept an incoming order within 30 minutes, the order is automatically cancelled with a 100% instant refund to the customer's Kwickly Wallet.
• Delivery OTP: For deliveries, the customer must inspect packaged goods and provide the Delivery OTP to the delivery personnel upon handoff.

5. PAYMENTS, 0% MDR DIRECT UPI & WALLET SYSTEM
• Payment Options: Customers may pay via Kwickly In-App Wallet, Direct NPCI UPI Intent (Google Pay, PhonePe, Paytm, BHIM, CRED), or Cash on Delivery where permitted.
• 0% MDR Direct UPI: Kwickly facilitates direct peer-to-platform UPI payments with zero payment gateway processing surcharges.
• Real-Time Webhook Reconciliation: Online transactions are verified via cryptographically signed webhook notifications (HMAC SHA-256) for instant, fraud-proof ledger settlements.
• Wallet Credits & Withdrawals: Partner earnings are credited to their in-app wallet immediately upon valid Completion/Delivery OTP entry. Verified Partners may withdraw wallet balances to their verified Bank Accounts or UPI IDs subject to standard banking settlement cycles.

6. CANCELLATIONS & REFUND POLICY
• Customer Cancellations: Customers may cancel a service booking or shop order free of charge prior to worker arrival or merchant order dispatch.
• Instant Wallet Refunds: Cancelled prepaid orders, overpayments, or failed transaction amounts are refunded immediately (100% without deductions) to the customer's Kwickly Wallet.
• Partner Cancellations: Excessive cancellations or no-shows by Partners after accepting a job will impact partner rating, lead priority, and may result in account penalties or temporary suspension.

7. SUBSCRIPTIONS & FREE TRIALS FOR PARTNERS
• Free Trial: New verified Service Partners receive an introductory 14-day Free Trial with full platform lead access.
• Subscription Tiers: Following the trial, Partners may choose Monthly or Annual subscription tiers for benefits such as unlimited quote bidding, priority broadcast radius, verified badge, and reduced commission rates.
• Subscription fees are non-refundable once activated.

8. CODE OF CONDUCT & PROHIBITED PRACTICES
Users and Partners agree not to:
a) Solicit or conduct off-platform payments to evade platform fees or bypass safety OTP mechanisms;
b) Engage in abusive, harassing, discriminatory, or unlawful behavior;
c) Post fraudulent quotes, fake reviews, or misrepresent identity or credentials;
d) List illegal, hazardous, counterfeit, or prohibited products.
Violations will result in immediate permanent termination and potential legal reporting.

9. DISCLAIMERS & LIMITATION OF LIABILITY
Services and goods are provided by independent third-party Partners. While Kwickly conducts KYC verification, Kwickly disclaims liability for indirect, incidental, or consequential damages resulting from Partner workmanship or merchant goods beyond the total platform fee charged for the specific transaction.

10. GOVERNING LAW & JURISDICTION
These Terms are governed by and construed in accordance with the laws of the Republic of India. Any disputes arising hereunder shall be subject to the exclusive jurisdiction of the competent courts in India.

11. GRIEVANCE REDRESSAL & CONTACT
For questions, support, or complaints, reach us via in-app 24/7 Support Chat or contact:
Grievance Officer: support@kwickly.com | Kwickly Technologies Private Limited.`;

const DEFAULT_PRIVACY_POLICY = `Kwickly Technologies Private Limited ("Kwickly", "we", "us", or "our") is dedicated to safeguarding your personal privacy and protecting the confidentiality of your data. This Privacy Policy describes our practices regarding the collection, use, processing, and disclosure of your personal data when you use our mobile applications, websites, and services.

1. INFORMATION WE COLLECT
a) Personal Identification Data: Name, mobile telephone number, email address, profile photo, and delivery addresses.
b) Location Information: We collect precise foreground and background location data from your mobile device when enabled. This is essential for:
   • Discovering nearby verified service workers and local retail shops;
   • Providing real-time map tracking and accurate arrival ETAs;
   • Geofencing arrival and completion zones for safety verification.
c) Partner KYC & Documentation: For Workers and Merchants, we collect government IDs (Aadhaar, PAN, Driving License, Trade License) strictly for identity verification, regulatory compliance, and platform safety.
d) Financial & Transactional Data: Transaction history, wallet balance, order invoices, and payout details. We do NOT store sensitive bank account passwords, debit/credit card CVVs, or UPI PINs.
e) Device & Technical Information: Device model, operating system version, unique device identifiers, IP address, and application crash reports.

2. HOW WE USE YOUR INFORMATION
• To facilitate matching, bidding, and dispatching of local services and delivery orders;
• To compute travel distances, ETAs, delivery fees, and dynamic search radiuses;
• To process payments, verify cryptographic webhook signatures, and manage wallet ledgers;
• To send critical transactional notifications, OTPs, job alerts, and order status updates;
• To prevent fraud, detect duplicate accounts, and enforce platform security policies;
• To improve application performance, usability, and customer support.

3. DATA SHARING & DISCLOSURES
• Counterpart Sharing: We share necessary details (e.g. customer name, service address, phone number) with the assigned Worker or Merchant strictly to enable service execution.
• Service Providers & Infrastructure: We partner with secure cloud hosting providers, mapping APIs, SMS gateways, and NPCI-compliant payment settlement rails.
• Legal Obligations: We may disclose information if required to comply with applicable Indian laws, law enforcement inquiries, or legal proceedings.
• We do NOT sell, rent, or trade your personal information to third-party advertisers.

4. DATA SECURITY & RETENTION
• All communications and data transmissions are protected using industry-standard TLS 1.3 encryption.
• Passwords and authentication tokens are secured with robust cryptographic hashing.
• We retain your account data as long as your account remains active or as needed to comply with statutory accounting and legal obligations.

5. YOUR PRIVACY RIGHTS & CHOICES
• Profile Updates: You may view and edit your profile information, addresses, and saved preferences at any time in the App Settings.
• Location Permissions: You can modify or revoke location tracking permissions through your device settings at any time (note that disabling location will restrict real-time booking and dispatch capabilities).
• Account Deletion: You can request account deletion or data erasure by submitting a request to support@kwickly.com.

6. GRIEVANCE REDRESSAL OFFICER
In accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act:
Grievance Officer: legal@kwickly.com / support@kwickly.com
Kwickly Technologies Private Limited`;

const DEFAULT_FAQS = [
    // ── CUSTOMER FAQS ──
    {
        question: 'How do I book a local service worker (e.g., Electrician, Plumber, Cleaner)?',
        answer: 'Tap "Book" or select a category on the home screen, specify your task details, preferred time, and location, and post your request. Nearby verified professionals will send you quotes with their rates and ratings. You can compare quotes and accept the best worker in one tap.',
        targetRole: 'CUSTOMER',
        order: 1
    },
    {
        question: 'What are the Arrival OTP and Completion OTP?',
        answer: 'For your security, Kwickly uses dual OTP verification: 1) The Arrival OTP is shared with the worker when they arrive at your location to confirm arrival. 2) The Completion OTP should ONLY be shared after the worker finishes the task and you have inspected and approved the work.',
        targetRole: 'CUSTOMER',
        order: 2
    },
    {
        question: 'How do I order groceries or products from nearby shops?',
        answer: 'Browse local stores in your area, add items to your cart, choose your delivery slot or instant delivery, and proceed to checkout. You will be able to track your order preparation and live delivery on the interactive map.',
        targetRole: 'CUSTOMER',
        order: 3
    },
    {
        question: 'What payment methods are supported on Kwickly?',
        answer: 'You can pay using your Kwickly In-App Wallet, 1-Click Direct UPI Intent (Google Pay, PhonePe, Paytm, BHIM, CRED), or Cash on Delivery / Pay after Service. All online UPI payments are 0% MDR surcharge-free and verified in real-time.',
        targetRole: 'CUSTOMER',
        order: 4
    },
    {
        question: 'How do I add money to my Kwickly Wallet and what are the benefits?',
        answer: 'Go to "My Wallet" from your profile or side drawer, select or enter the top-up amount, and pay seamlessly via UPI. Wallet payments offer instant 1-tap checkout, zero transaction failures, and immediate automatic refunds for any cancelled orders.',
        targetRole: 'CUSTOMER',
        order: 5
    },
    {
        question: 'What is the cancellation and refund policy?',
        answer: 'You can cancel any service booking or shop order before the worker arrives or before the store dispatches your items without any cancellation fee. If you paid online or via wallet, 100% of the amount is immediately credited back to your Kwickly Wallet.',
        targetRole: 'CUSTOMER',
        order: 6
    },
    {
        question: 'Are Kwickly service professionals verified and safe?',
        answer: 'Yes. Every service partner on Kwickly must complete mandatory Know-Your-Customer (KYC) verification with government ID proof (Aadhaar/PAN/Driving License) and trade validation before they can receive job broadcasts.',
        targetRole: 'CUSTOMER',
        order: 7
    },
    {
        question: 'Can I track my service worker or delivery partner in real-time?',
        answer: 'Yes! Once a worker accepts your booking or an order is dispatched, you can view their real-time GPS location and estimated time of arrival (ETA) live on the map in your booking details screen.',
        targetRole: 'CUSTOMER',
        order: 8
    },

    // ── WORKER / SERVICE PARTNER FAQS ──
    {
        question: 'How do I register as a Service Partner and start receiving jobs?',
        answer: 'Download the Kwickly app, register with your mobile number, select "Worker/Service Partner", choose your service skills, and upload your government ID proof for KYC. Once approved (usually within 24 hours), turn your toggle "Online" to receive nearby job alerts.',
        targetRole: 'WORKER',
        order: 9
    },
    {
        question: 'How do I get notified of customer jobs and submit quotes?',
        answer: 'Ensure your app is Online and location permissions are set to "Always" or "While Using App". When a customer posts a job in your service radius, you will receive an instant audio/push alert. Review the task details and submit your competitive price quote.',
        targetRole: 'WORKER',
        order: 10
    },
    {
        question: 'When and how do I receive payment for completed jobs?',
        answer: 'Upon finishing the work, ask the customer for their 4-digit Completion OTP and enter it in your app. The earnings (minus any platform convenience fee) are instantly credited to your Kwickly Worker Wallet balance.',
        targetRole: 'WORKER',
        order: 11
    },
    {
        question: 'How do I withdraw my earnings to my bank account or UPI?',
        answer: 'Navigate to the "Earnings / Wallet" section in your app, tap "Withdraw", enter the amount, and select your verified Bank Account (via IFSC) or UPI ID. Withdrawal requests are processed quickly into your bank account.',
        targetRole: 'WORKER',
        order: 12
    },
    {
        question: 'How does the Partner Free Trial and Subscription work?',
        answer: 'New service partners receive a complimentary 14-Day Free Trial. After the trial, you can subscribe to affordable Monthly or Annual plans to enjoy unlimited bidding, verified badge, priority job matching, and reduced commission rates.',
        targetRole: 'WORKER',
        order: 13
    },
    {
        question: 'What happens if a customer cancels after I arrive?',
        answer: 'If the customer cancels after you have arrived and entered the Arrival OTP, you may be eligible for a doorstep travel compensation credited directly to your wallet.',
        targetRole: 'WORKER',
        order: 14
    },
    {
        question: 'How do customer ratings affect my earnings?',
        answer: 'Partners with high ratings (4.5 stars and above) receive priority lead dispatches and higher placement on customer quote comparisons, leading to significantly higher monthly earnings.',
        targetRole: 'WORKER',
        order: 15
    },

    // ── SHOP / MERCHANT PARTNER FAQS ──
    {
        question: 'How do I list my store and products on Kwickly?',
        answer: 'Register as a Shop Merchant, complete your store profile (store name, category, opening hours, address), and start adding products with photos, prices, unit weights, and stock levels from the "Product Catalog" tab.',
        targetRole: 'SHOP',
        order: 16
    },
    {
        question: 'How do I process incoming shop orders?',
        answer: 'When a nearby customer places an order, you will receive a loud real-time order notification. Tap to accept the order, pack the requested items, and mark "Ready for Pickup". Provide the package to the delivery partner upon verifying the Delivery OTP.',
        targetRole: 'SHOP',
        order: 17
    },
    {
        question: 'What is the 30-minute auto-cancellation rule for shops?',
        answer: 'To guarantee fast fulfillment for customers, shops have 30 minutes to accept incoming orders. Unaccepted orders are automatically cancelled and refunded to the customer. Keep your store notifications active during business hours.',
        targetRole: 'SHOP',
        order: 18
    },
    {
        question: 'How do merchant settlements and payouts work?',
        answer: 'The net value of completed orders is automatically credited to your Merchant Wallet upon delivery. You can initiate payouts directly to your registered business bank account at any time.',
        targetRole: 'SHOP',
        order: 19
    },
    {
        question: 'Can I manage product inventory, discounts, and out-of-stock items?',
        answer: 'Yes! From your Merchant Dashboard, you can toggle item availability on/off instantly, update prices, add promotional discounts, and edit inventory with zero delay.',
        targetRole: 'SHOP',
        order: 20
    },

    // ── GENERAL / ALL USERS FAQS ──
    {
        question: 'How does the Kwickly Referral Program work?',
        answer: 'Share your unique referral code or link with friends and family from the "Refer & Earn" screen. When they sign up and complete their first verified booking or order, both of you receive bonus wallet cash.',
        targetRole: 'ALL',
        order: 21
    },
    {
        question: 'Is my personal information and payment data safe?',
        answer: 'Absolutely. Kwickly uses bank-grade 256-bit TLS encryption. We adhere strictly to Indian IT laws and the Digital Personal Data Protection Act. We never store your UPI PINs, NetBanking passwords, or card CVVs.',
        targetRole: 'ALL',
        order: 22
    },
    {
        question: 'How do I contact Kwickly Support if I need help with an order or booking?',
        answer: 'You can reach our 24/7 Customer Care team directly through the in-app "Help & Support" chat, by tapping "Need Help" on any active booking screen, or by emailing support@kwickly.com.',
        targetRole: 'ALL',
        order: 23
    },
    {
        question: 'What should I do if I change my mobile phone number?',
        answer: 'You can log into your account using your registered number and update your mobile number under Profile Settings. An OTP verification on both your old and new number will ensure secure migration.',
        targetRole: 'ALL',
        order: 24
    }
];

module.exports = {
    DEFAULT_TERMS_OF_SERVICE,
    DEFAULT_PRIVACY_POLICY,
    DEFAULT_FAQS
};
