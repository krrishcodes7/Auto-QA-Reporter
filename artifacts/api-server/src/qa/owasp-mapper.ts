import type { Severity } from './types.js';

export interface OwaspMapping {
  owaspCategory: string;
  severity: Severity;
  fixSuggestion: string;
}

const MAPPINGS: Array<{
  test: (issueType: string, description: string) => boolean;
  result: OwaspMapping;
}> = [
  {
    test: (t) => t.includes('SQL Injection') || t.includes('SQL injection'),
    result: {
      owaspCategory: 'A03:2021 - Injection',
      severity: 'Critical',
      fixSuggestion:
        'Use parameterized queries or prepared statements for all database calls. Never concatenate user input into SQL strings. Example (Node.js + pg): db.query("SELECT * FROM users WHERE id = $1", [userId]). Add a WAF as an additional defense layer.',
    },
  },
  {
    test: (t) => t.includes('XSS') || t.includes('Cross-Site Scripting'),
    result: {
      owaspCategory: 'A03:2021 - Injection',
      severity: 'Critical',
      fixSuggestion:
        'Escape all user-supplied content before rendering it as HTML. Use textContent instead of innerHTML. Apply a strict Content-Security-Policy header. Use DOMPurify for any HTML you must render dynamically. Example CSP: Content-Security-Policy: default-src self; script-src self',
    },
  },
  {
    test: (t) => t.includes('Weak Password'),
    result: {
      owaspCategory: 'A07:2021 - Identification and Authentication Failures',
      severity: 'High',
      fixSuggestion:
        'Enforce a minimum password length of 12+ characters using the minlength HTML attribute and server-side validation. Add a password-strength meter. Reject passwords found in breach lists using the Have I Been Pwned API. Example: <input type="password" minlength="12" required>',
    },
  },
  {
    test: (t) => t.includes('Missing Validation') || t.includes('No Required Fields'),
    result: {
      owaspCategory: 'A04:2021 - Insecure Design',
      severity: 'Medium',
      fixSuggestion:
        'Add the required attribute to mandatory form inputs and implement server-side validation. Show clear inline error messages. Example: <input type="email" required aria-describedby="email-error">. Never rely solely on client-side validation.',
    },
  },
  {
    test: (t) => t.includes('Weak Email'),
    result: {
      owaspCategory: 'A04:2021 - Insecure Design',
      severity: 'Medium',
      fixSuggestion:
        'Use <input type="email"> for built-in browser validation and complement with server-side regex validation. Send a verification email to confirm address ownership. Server-side regex: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/',
    },
  },
  {
    test: (t) => t.includes('Missing Alt'),
    result: {
      owaspCategory: 'A11:2021 - Insufficient Accessibility',
      severity: 'Medium',
      fixSuggestion:
        'Add a descriptive alt attribute to every meaningful image. Use alt="" for purely decorative images. Example: <img src="chart.png" alt="Bar chart showing Q1 revenue growth of 23%">. Avoid generic text like "image" or "photo".',
    },
  },
  {
    test: (t) => t.includes('Missing Form Label') || t.includes('Missing Label'),
    result: {
      owaspCategory: 'A11:2021 - Insufficient Accessibility',
      severity: 'Medium',
      fixSuggestion:
        'Associate a <label> element with every form input via the for attribute matching the input id. Example: <label for="email">Email address</label><input id="email" type="email">. For icon-only fields, use aria-label="Field purpose" on the input.',
    },
  },
  {
    test: (t) => t.includes('Empty Button'),
    result: {
      owaspCategory: 'A11:2021 - Insufficient Accessibility',
      severity: 'High',
      fixSuggestion:
        'Add meaningful text inside the button or an aria-label attribute. For icon-only buttons: <button aria-label="Close dialog"><svg ...></svg></button>. Alternatively add a visually-hidden span: <span class="sr-only">Close dialog</span>.',
    },
  },
  {
    test: (t) => t.includes('Empty Link'),
    result: {
      owaspCategory: 'A11:2021 - Insufficient Accessibility',
      severity: 'Medium',
      fixSuggestion:
        'Add descriptive anchor text or an aria-label describing the link destination. Example: <a href="/reports" aria-label="View Q1 reports">Reports</a>. Avoid generic text like "click here" — be specific about where the link goes.',
    },
  },
  {
    test: (t) => t.includes('Heading Hierarchy'),
    result: {
      owaspCategory: 'A11:2021 - Insufficient Accessibility',
      severity: 'Low',
      fixSuggestion:
        'Ensure heading levels are sequential (H1 > H2 > H3) without skipping levels. If you need a visually smaller heading, use CSS to style it rather than jumping levels. Example: instead of H1 > H3, use H1 > H2 and apply font-size via CSS.',
    },
  },
  {
    test: (t) => t.includes('Viewport Overflow'),
    result: {
      owaspCategory: 'A11:2021 - Insufficient Accessibility',
      severity: 'Medium',
      fixSuggestion:
        'Identify the overflowing element using browser DevTools. Add max-width: 100% to images and media. Use overflow-x: hidden on the body as a last resort. Check for fixed-width containers and replace with max-width + width: 100%.',
    },
  },
  {
    test: (t) => t.includes('Overlapping'),
    result: {
      owaspCategory: 'A11:2021 - Insufficient Accessibility',
      severity: 'High',
      fixSuggestion:
        'Inspect the overlapping elements in DevTools and fix their position, z-index, or margin values. Ensure all interactive elements have a minimum touch target size of 44x44 CSS pixels (WCAG 2.5.5). Remove negative margins causing overlaps.',
    },
  },
  {
    test: (t) => t.includes('Missing Meta Description'),
    result: {
      owaspCategory: 'General - SEO / Content Quality',
      severity: 'Low',
      fixSuggestion:
        'Add a unique meta description to every page inside <head>. Keep it 150-160 characters and include relevant keywords. Example: <meta name="description" content="Short, compelling description of this page.">',
    },
  },
  {
    test: (t) => t.includes('Missing Page Title'),
    result: {
      owaspCategory: 'General - SEO / Content Quality',
      severity: 'Medium',
      fixSuggestion:
        'Add a descriptive <title> tag inside <head> on every page. Keep it under 60 characters. Example: <title>Dashboard - My App</title>. Each page should have a unique, meaningful title reflecting its content.',
    },
  },
  {
    test: (t) => t.includes('Broken Link') || t.includes('404') || t.includes('500'),
    result: {
      owaspCategory: 'A05:2021 - Security Misconfiguration',
      severity: 'High',
      fixSuggestion:
        'Fix or remove the broken link. If the destination page was moved, use a 301 redirect to the new URL. Implement a custom 404 page with navigation to help users recover. Set up automated link checking in your CI/CD pipeline.',
    },
  },
  {
    test: (t) => t.includes('Empty Form'),
    result: {
      owaspCategory: 'A04:2021 - Insecure Design',
      severity: 'Low',
      fixSuggestion:
        'Add the appropriate input fields to the form, or remove the <form> element if it is no longer needed. Verify the page renders correctly in all target browsers and that all required form elements are present in the HTML.',
    },
  },
];

const FALLBACK: OwaspMapping = {
  owaspCategory: 'General - Quality Issue',
  severity: 'Low',
  fixSuggestion:
    'Review the flagged element against your coding standards and accessibility guidelines. Consult the WCAG 2.1 checklist and the OWASP Top 10 for applicable remediation steps.',
};

export function mapOwasp(issueType: string, description: string = ''): OwaspMapping {
  const combined = issueType + ' ' + description;
  for (const mapping of MAPPINGS) {
    if (mapping.test(issueType, combined)) {
      return mapping.result;
    }
  }
  return FALLBACK;
}
