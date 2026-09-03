import type { LegalContent } from './types';

/**
 * Legal content in English (professional). Same structure and factual map
 * as the Spanish version. Legal identity uses literal placeholders:
 * [RAZÓN SOCIAL], [NIT], [DIRECCIÓN], [CORREO DE CONTACTO], [CIUDAD/PAÍS].
 */
export const legalEn: LegalContent = {
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    updatedAt: '2026-09-03',
    intro:
      'Your privacy is a priority at TwinCap. This Privacy Policy explains what personal data we process, how we use it, how we protect it, and what rights you have over it. By using TwinCap you accept this policy.',
    sections: [
      {
        heading: '1. Data controller',
        paragraphs: [
          'The entity responsible for processing your personal data is [RAZÓN SOCIAL], with tax ID (NIT) [NIT] and registered office at [DIRECCIÓN], [CIUDAD/PAÍS] (hereinafter "TwinCap" or "we").',
          'For any inquiry or to exercise your rights, you can contact us at [CORREO DE CONTACTO].',
        ],
      },
      {
        heading: '2. Personal data we process',
        paragraphs: [
          'We collect and process only the data necessary to provide the service:',
        ],
        list: [
          'Your account data: your email address (unique and normalized), a hash of your password (we never store your password in plain text), your name (optional), your language preference (Spanish or English), your email verification status, and your account creation and update dates.',
          'Data about your clients or third parties: when you use the Clients module, you manually record the name (required) and, optionally, the phone, email, and a note for each client or third party.',
          'IP address: on a temporary basis, we use it only as an internal key to prevent abuse and fraud (rate limiting). It is not persisted in your profile or permanently associated with your account.',
        ],
      },
      {
        heading: '3. How we use your data',
        paragraphs: ['We use your personal data for the following purposes:'],
        list: [
          'Provide and operate the service: create your account, authenticate you, store and display your finances, and let you manage your accounts, movements, categories, credits, sales, clients, and catalog.',
          'Security and fraud prevention: authenticate sessions, limit requests, and protect your account from unauthorized access.',
          'Transactional communications: send you essential emails, such as email verification and password reset.',
          'Preferences: remember your language and visual theme to improve your experience.',
        ],
      },
      {
        heading: '4. Legal basis for processing',
        paragraphs: [
          'We process your personal data based on: the performance of the service contract you enter into when creating your account; your consent, where applicable; and our legitimate interests in security, fraud prevention, and the proper operation of the service.',
        ],
      },
      {
        heading: '5. Sharing with third parties (processors)',
        paragraphs: [
          'We do not sell or rent your personal data. We only share data with providers that act as processors to operate the service:',
        ],
        list: [
          'MongoDB Atlas: our main database provider, where all service information is stored. It acts as a processor.',
          'Resend: transactional email provider (email verification and password reset). It only receives the recipient email address; the one-time token link travels in the message URL. It acts as a processor.',
          'Google Fonts CDN: the typography (Geist, Geist Mono, and Sora) is loaded from Google CDN; the application does not send personal data to that service.',
        ],
      },
      {
        heading: '6. Data retention',
        paragraphs: [
          'We keep your personal data while your account is active and for as long as necessary to fulfill the purposes described, resolve disputes, and comply with legal obligations. The IP address used for rate limiting is kept only temporarily with automatic deletion.',
        ],
      },
      {
        heading: '7. Information security',
        paragraphs: ['We implement technical and organizational measures to protect your data, including:'],
        list: [
          'Storing your password only as a hash (bcrypt); never in plain text and never exposed in system responses.',
          'Sessions protected with encrypted tokens (A256GCM-encrypted JWT) and cookies marked httpOnly and sameSite, with the secure attribute in production.',
          'Data isolation: each account can only access its own information.',
          'Encryption in transit through secure connections (HTTPS).',
        ],
      },
      {
        heading: '8. Data subject rights',
        paragraphs: [
          'You have the right to know, update, and rectify your personal data; to request proof of the authorization granted; to revoke your authorization and request the deletion of data that is no longer necessary; and to file complaints with the competent authority where applicable.',
          'You can currently view, update, and rectify part of your data from your profile in the application. To request deletion or rectification of data you cannot change yourself, or to request additional information, write to us at [CORREO DE CONTACTO]. Self-service functionality to delete your account and export your data will be enabled soon.',
        ],
      },
      {
        heading: '9. Links to third-party sites',
        paragraphs: [
          'TwinCap may contain links to third-party websites. We are not responsible for the privacy practices of those sites and recommend you review their policies before providing them your data.',
        ],
      },
      {
        heading: '10. Changes to this policy',
        paragraphs: [
          'We may update this Privacy Policy when necessary. When there are changes, we will update the effective date at the top of this document and notify you through available channels. We recommend you review it periodically.',
        ],
      },
      {
        heading: '11. Contact',
        paragraphs: [
          'If you have questions about this Privacy Policy or about the processing of your personal data, contact us at [CORREO DE CONTACTO] or at [DIRECCIÓN], [CIUDAD/PAÍS].',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms and Conditions',
    updatedAt: '2026-09-03',
    intro:
      'These Terms and Conditions govern the use of TwinCap, a service for managing personal and small business finances. By creating an account and using the service, you accept these terms.',
    sections: [
      {
        heading: '1. Acceptance of the terms',
        paragraphs: [
          'By accessing or using TwinCap, you agree to comply with these Terms and Conditions and any complementary policies, such as the Privacy Policy, the Cookie Policy, and the Personal Data Processing Policy. If you do not agree, you must not use the service.',
        ],
      },
      {
        heading: '2. Service description',
        paragraphs: [
          'TwinCap is a financial recording and control tool that lets you manage your personal and business finances. The service includes, among other features:',
        ],
        list: [
          'Account management in different currencies (COP, USD, MXN, and EUR).',
          'Recording of income and expense movements and their categorization.',
          'Transfers between your own accounts.',
          'Credits received and credits granted, with payment and installment tracking.',
          'Sales (including point-of-sale POS) and accounts payable.',
          'Client management and a catalog of items.',
        ],
      },
      {
        heading: '3. Registration and account',
        paragraphs: [
          'To use the service you must create an account by providing a valid email address and a secure password.',
        ],
        list: [
          'You are responsible for keeping your password confidential and for the activities that occur on your account.',
          'You must provide accurate data and keep it up to date.',
          'You can verify your email address and reset your password using the links we send you.',
          'You may not use the service for unlawful purposes or in a way that harms third parties or the service itself.',
        ],
      },
      {
        heading: '4. Acceptable use',
        paragraphs: ['You agree to use TwinCap only for its intended purposes. The following are prohibited, among other behaviors:'],
        list: [
          'Attempting to access other users\' accounts or data.',
          'Entering false information or data about third parties without their consent.',
          'Attempting to compromise the security of the service, its databases, or its systems.',
          'Using the service for unlawful, fraudulent activities or for activities that infringe the rights of third parties.',
          'Reproducing, distributing, or commercially exploiting the service without authorization.',
        ],
      },
      {
        heading: '5. Third-party data you record',
        paragraphs: [
          'You may record information about your own clients or third parties in the service (for example, in the Clients module). By doing so, you are the data controller of that data with respect to its owners.',
        ],
        list: [
          'You must have the consent of the owners or another legal basis to record and process their data.',
          'You must inform them, in accordance with applicable law, about the processing carried out by the controller described in these terms.',
          'TwinCap acts as a processor of that data, solely to provide the service you request.',
        ],
      },
      {
        heading: '6. Intellectual property',
        paragraphs: [
          'The service, its design, logos, texts, graphics, and other TwinCap elements are owned by [RAZÓN SOCIAL] or its licensors and are protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable license to use the service for your personal or business use, in accordance with these terms. You retain ownership of the information you enter into the service.',
        ],
      },
      {
        heading: '7. Limitation of liability',
        paragraphs: [
          'TwinCap is a tool for recording and controlling your financial information. It does not constitute financial, accounting, tax, or legal professional advice, and it does not replace qualified professionals.',
          'Financial, accounting, or any other decisions you make based on the recorded information are your sole responsibility. To the extent permitted by law, [RAZÓN SOCIAL] shall not be liable for direct, indirect, incidental, or consequential damages arising from the use or inability to use the service.',
        ],
      },
      {
        heading: '8. Suspension and termination',
        paragraphs: [
          'We may suspend or cancel your access to the service if you breach these terms, if there is a risk to the security or proper functioning of the service, or if required by law. You may also stop using the service at any time. The exercise of your rights over your data is described in the Privacy Policy and the Personal Data Processing Policy.',
        ],
      },
      {
        heading: '9. Modifications',
        paragraphs: [
          'We may modify these Terms and Conditions at any time. Changes will take effect when published on this page and will be notified through available channels. Continued use of the service after a change implies acceptance.',
        ],
      },
      {
        heading: '10. Governing law',
        paragraphs: [
          'These terms are governed by the laws of the Republic of Colombia, in [CIUDAD/PAÍS]. In the event of a dispute, the parties will seek to resolve it directly and, failing that, will submit to the competent courts of [CIUDAD/PAÍS].',
        ],
      },
      {
        heading: '11. Contact',
        paragraphs: [
          'For questions about these Terms and Conditions, contact us at [CORREO DE CONTACTO]. The controller is [RAZÓN SOCIAL], with tax ID (NIT) [NIT] and registered office at [DIRECCIÓN], [CIUDAD/PAÍS].',
        ],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    updatedAt: '2026-09-03',
    intro:
      'This Cookie Policy explains what cookies and local storage technologies TwinCap uses, what they are for, and how you can manage them.',
    sections: [
      {
        heading: '1. What are cookies?',
        paragraphs: [
          'Cookies are small text files that a website stores on your device to remember information about your visit. TwinCap uses a minimal number of first-party cookies to operate the service and improve your experience.',
        ],
      },
      {
        heading: '2. First-party cookies we use',
        paragraphs: [
          'TwinCap uses only two first-party cookies. We do not use advertising, marketing, or third-party cookies.',
        ],
        table: {
          caption: 'Cookies used by TwinCap',
          headers: ['Cookie', 'Purpose', 'Necessary', 'Characteristics'],
          rows: [
            [
              'gm_session',
              'Keep you signed in (authenticated identity).',
              'Yes, strictly necessary',
              'Encrypted (A256GCM JWT), httpOnly, sameSite lax, path /, secure in production. Expires after 30 days.',
            ],
            [
              'NEXT_LOCALE',
              'Remember your language preference (Spanish or English).',
              'No (improves experience)',
              'Only stored if you choose a language; you can delete it.',
            ],
          ],
        },
      },
      {
        heading: '3. No third-party, marketing, or analytics cookies',
        paragraphs: [
          'TwinCap does not install third-party, marketing, or analytics cookies. We do not track your activity on other websites. The only exception is that typography is loaded from the Google Fonts CDN, without the application sending personal data to that service.',
        ],
      },
      {
        heading: '4. Local storage and other technologies',
        paragraphs: [
          'In addition to cookies, TwinCap uses your browser\'s local storage to save your visual theme preference (key "twincap-theme", with values light, dark, or system). This data is stored only on your device. The application Service Worker (PWA) caches only unauthenticated static assets (such as the manifest and icons) and never stores personal or financial data.',
        ],
      },
      {
        heading: '5. How to manage cookies',
        paragraphs: [
          'You can control and delete cookies from your browser settings. You can block or delete them, but note that the session cookie (gm_session) is strictly necessary: without it you will not be able to sign in or use the service.',
          'You can also delete the theme data stored in your browser; the service will return to your default theme (according to your system preference).',
        ],
      },
      {
        heading: '6. Validity and changes',
        paragraphs: [
          'This Cookie Policy was last updated on the date indicated at the top of this document. We may update it when necessary; changes will be published on this page.',
        ],
      },
    ],
  },
  dataPolicy: {
    slug: 'data-policy',
    title: 'Personal Data Processing Policy',
    updatedAt: '2026-09-03',
    intro:
      'In accordance with Law 1581 of 2012 and its implementing regulations of the Republic of Colombia, this Personal Data Processing Policy informs data subjects about the processing that [RAZÓN SOCIAL] carries out on their personal data.',
    sections: [
      {
        heading: '1. Data controller',
        paragraphs: [
          'The data controller of personal data is [RAZÓN SOCIAL], with tax ID (NIT) [NIT], principal place of business at [DIRECCIÓN], [CIUDAD/PAÍS]. For any matter related to personal data processing, you can contact us at [CORREO DE CONTACTO].',
        ],
      },
      {
        heading: '2. Purposes of processing',
        paragraphs: ['Your personal data may be processed for the following purposes:'],
        list: [
          'Creating, administering, and authenticating your account in the service.',
          'Providing and operating the financial management service, including recording, querying, and controlling your information.',
          'Sending transactional communications (email verification, password reset).',
          'Preventing fraud and abuse, and protecting information security.',
          'Complying with legal obligations and responding to data subject requests.',
        ],
      },
      {
        heading: '3. Personal data processed',
        paragraphs: [
          'We process only the data necessary for the purposes described: your email address, your password hash, your name (optional), your language preference, your email verification status, your account creation and update dates, and the data about your clients or third parties that you record in the service (name, phone, email, and note). We also process your IP address on a temporary basis to prevent abuse.',
        ],
      },
      {
        heading: '4. Data subject rights',
        paragraphs: [
          'In accordance with Law 1581 of 2012, as the data subject you have the right to:',
        ],
        list: [
          'Know, update, and rectify your personal data with the controller.',
          'Request proof of the authorization granted for processing.',
          'Be informed, upon request, about how your data has been used.',
          'File complaints with the Superintendency of Industry and Commerce (SIC) for violations of Law 1581 of 2012.',
          'Revoke your authorization and request the deletion of your data when there is no legal duty to keep it.',
          'Access your personal data subject to processing free of charge.',
        ],
      },
      {
        heading: '5. How to exercise your rights',
        paragraphs: [
          'You may exercise your rights at any time, free of charge, by contacting the controller at [CORREO DE CONTACTO]. We will assist you within the terms provided by law. Self-service functionality to delete your account and query your data will be enabled soon.',
        ],
      },
      {
        heading: '6. Service channels',
        paragraphs: ['To exercise your rights and for inquiries, you may use the following channels:'],
        list: [
          'Email: [CORREO DE CONTACTO].',
          'Physical address: [DIRECCIÓN], [CIUDAD/PAÍS].',
        ],
      },
      {
        heading: '7. Data retention',
        paragraphs: [
          'We keep your personal data for as long as necessary to fulfill the purposes of processing, comply with legal obligations, and exercise or defend rights. Once no longer necessary, it will be deleted or anonymized, in accordance with the law.',
        ],
      },
      {
        heading: '8. Transfer to processors',
        paragraphs: ['We may share your personal data with processors that assist us in operating the service, in particular:'],
        list: [
          'MongoDB Atlas: storage of the service database.',
          'Resend: sending transactional emails (email verification and password reset), which receives only the recipient email address.',
        ],
      },
      {
        heading: '9. Third-party data you record',
        paragraphs: [
          'When you record data about your own clients or third parties in the service, you act as the data controller of that data with respect to its owners. TwinCap acts as a processor, solely to provide you with the service. You must have the consent of the owners or another legal basis to record and process their data, and inform them in accordance with applicable law.',
        ],
      },
      {
        heading: '10. Minors',
        paragraphs: [
          'The service is not directed at minors. We do not knowingly process personal data of minors without the consent of their legal representatives, where required by law.',
        ],
      },
      {
        heading: '11. Validity and privacy notice',
        paragraphs: [
          'This policy is in effect from the date of entry into force and may be updated by the controller. Changes will be communicated through available channels and published on this page. By creating an account and using the service, you confirm that you have read and accepted this policy.',
        ],
      },
      {
        heading: '12. Modifications and contact',
        paragraphs: [
          'To update, rectify, or request information about this Personal Data Processing Policy, contact us at [CORREO DE CONTACTO] or at [DIRECCIÓN], [CIUDAD/PAÍS].',
        ],
      },
    ],
  },
};
