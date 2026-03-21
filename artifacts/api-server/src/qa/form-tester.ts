import { chromium } from 'playwright';
import type { FormIssue } from './types.js';

const SQL_INJECTION_STRINGS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "1; SELECT * FROM users",
];

const XSS_STRINGS = [
  '<script>alert("xss")</script>',
  '"><script>alert(1)</script>',
];

export async function testForms(pages: Array<{ url: string }>): Promise<FormIssue[]> {
  const issues: FormIssue[] = [];

  const extraLibPath = '/nix/store/24w3s75aa2lrvvxsybficn8y3zxd27kp-mesa-libgbm-25.1.0/lib';
  const ldPath = process.env['LD_LIBRARY_PATH']
    ? `${extraLibPath}:${process.env['LD_LIBRARY_PATH']}`
    : extraLibPath;

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      env: { ...process.env, LD_LIBRARY_PATH: ldPath } as Record<string, string>,
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    for (const { url } of pages) {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const formData = await page.evaluate(() => {
          const forms = document.querySelectorAll('form');
          return Array.from(forms).map((form, i) => {
            const inputs = Array.from(form.querySelectorAll('input, textarea, select')).map((el) => ({
              type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
              name: (el as HTMLInputElement).name || '',
              required: (el as HTMLInputElement).required || false,
              id: el.id || '',
            }));
            const hasRequiredFields = inputs.some((inp) => inp.required);
            const hasEmailField = inputs.some((inp) => inp.type === 'email');
            const hasPasswordField = inputs.some((inp) => inp.type === 'password');
            const textInputs = inputs.filter((inp) =>
              ['text', 'textarea', 'search', 'url'].includes(inp.type)
            );
            return {
              index: i,
              selector: form.id ? `#${form.id}` : `form:nth-of-type(${i + 1})`,
              inputCount: inputs.length,
              hasRequiredFields,
              hasEmailField,
              hasPasswordField,
              textInputSelectors: textInputs
                .map((inp) =>
                  inp.id ? `#${inp.id}` : inp.name ? `[name="${inp.name}"]` : null
                )
                .filter(Boolean),
              action: form.action || '',
              method: form.method || 'get',
            };
          });
        });

        for (const form of formData) {
          const formSelector = form.selector;

          if (form.inputCount === 0) {
            issues.push({
              page: url,
              formSelector,
              issueType: 'Empty Form',
              description: `Form "${formSelector}" contains no input elements at all.`,
              impact:
                'A form with no inputs serves no purpose and may indicate a rendering error or missing markup. Users who interact with it will be confused or unable to complete the intended action.',
              recommendation:
                'Add the appropriate input fields, or remove the <form> element if it is no longer needed. Verify the page renders correctly in all target browsers.',
              severity: 'Low',
            });
            continue;
          }

          // Test 1: Empty form submission
          const emptyPage = await context.newPage();
          try {
            await emptyPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            const formEl = await emptyPage.$(formSelector);
            if (formEl) {
              await formEl.evaluate((f: HTMLFormElement) => {
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                f.dispatchEvent(submitEvent);
              });
              await emptyPage.waitForTimeout(500);

              const hasValidationMessage = await emptyPage.evaluate((sel) => {
                const form = document.querySelector(sel);
                if (!form) return false;
                const inputs = form.querySelectorAll('input:required, textarea:required');
                let hasMsg = false;
                inputs.forEach((input) => {
                  if ((input as HTMLInputElement).validationMessage) hasMsg = true;
                });
                return hasMsg;
              }, formSelector);

              if (form.hasRequiredFields && !hasValidationMessage) {
                issues.push({
                  page: url,
                  formSelector,
                  issueType: 'Missing Validation on Empty Submit',
                  description: `Form "${formSelector}" has required fields but does not display browser-native or custom validation messages when submitted empty.`,
                  impact:
                    'Users who submit the form without filling required fields receive no feedback. This leads to silent failures, frustrating UX, and potential data integrity issues on the server if server-side validation is also absent.',
                  recommendation:
                    'Add the required attribute to mandatory inputs so browsers show built-in validation messages, or implement a custom validation handler in JavaScript that prevents submission and shows clear, inline error messages next to each empty required field.',
                  severity: 'Medium',
                });
              }
            }
          } catch {
            // skip
          } finally {
            await emptyPage.close();
          }

          // Test 2: No required fields marked
          if (!form.hasRequiredFields && form.inputCount > 1) {
            issues.push({
              page: url,
              formSelector,
              issueType: 'No Required Fields Marked',
              description: `Form "${formSelector}" has ${form.inputCount} input fields but none are marked as required.`,
              impact:
                'Without required-field marking, users have no visual indication of which fields must be filled. This increases form abandonment and the likelihood of incomplete submissions reaching the server.',
              recommendation:
                'Add the required attribute to all mandatory inputs. Additionally, visually indicate required fields with an asterisk (*) and a legend explaining the symbol (e.g., "* Required field").',
              severity: 'Low',
            });
          }

          // Test 3: SQL injection in text inputs
          if (form.textInputSelectors.length > 0) {
            const sqlPage = await context.newPage();
            try {
              await sqlPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
              const testSelector = form.textInputSelectors[0] as string;
              const input = await sqlPage.$(testSelector);
              if (input) {
                await input.fill(SQL_INJECTION_STRINGS[0]);
                const value = await input.inputValue();
                if (value === SQL_INJECTION_STRINGS[0]) {
                  issues.push({
                    page: url,
                    formSelector,
                    issueType: 'No Input Sanitization (SQL Injection)',
                    description: `Text input "${testSelector}" in form "${formSelector}" accepted the SQL injection string "${SQL_INJECTION_STRINGS[0]}" without any client-side sanitization or rejection.`,
                    impact:
                      'If this input is passed unsanitised to a database query, an attacker can manipulate the query to read, modify, or delete arbitrary data — including user credentials and private records. SQL injection is consistently ranked #1 in the OWASP Top 10 web vulnerabilities.',
                    recommendation:
                      'Never construct SQL queries by concatenating user input. Use parameterised queries or prepared statements in all server-side database calls. On the client side, validate and reject obviously malicious patterns. Consider a Web Application Firewall (WAF) as an additional layer.',
                    severity: 'High',
                  });
                }

                await input.fill(XSS_STRINGS[0]);
                const xssValue = await input.inputValue();
                if (xssValue === XSS_STRINGS[0]) {
                  issues.push({
                    page: url,
                    formSelector,
                    issueType: 'No Input Sanitization (XSS)',
                    description: `Text input "${testSelector}" in form "${formSelector}" accepted a cross-site scripting (XSS) payload ("${XSS_STRINGS[0].substring(0, 40)}…") without sanitization.`,
                    impact:
                      'If this input is reflected back in the page HTML without escaping, an attacker can inject scripts that steal session cookies, redirect users to malicious sites, or perform actions on behalf of the victim. Stored XSS can affect every subsequent visitor who views the content.',
                    recommendation:
                      'Escape all user-supplied content before rendering it as HTML (use textContent instead of innerHTML, or a templating library that auto-escapes). Apply a strict Content-Security-Policy (CSP) header. Consider a sanitisation library like DOMPurify for any HTML you must render dynamically.',
                    severity: 'High',
                  });
                }
              }
            } catch {
              // skip
            } finally {
              await sqlPage.close();
            }
          }

          // Test 4: Email validation
          if (form.hasEmailField) {
            const emailPage = await context.newPage();
            try {
              await emailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
              const emailInput = await emailPage.$(`${formSelector} input[type="email"]`);
              if (emailInput) {
                await emailInput.fill('notanemail');
                await emailInput.evaluate((el: HTMLInputElement) =>
                  el.dispatchEvent(new Event('change', { bubbles: true }))
                );
                await emailPage.waitForTimeout(300);
                const isInvalid = await emailInput.evaluate(
                  (el: HTMLInputElement) => !el.validity.valid
                );
                if (!isInvalid) {
                  issues.push({
                    page: url,
                    formSelector,
                    issueType: 'Weak Email Validation',
                    description: `The email input in form "${formSelector}" accepted "notanemail" (a string with no @ or domain) without showing a validation error.`,
                    impact:
                      'Accepting invalid email addresses results in undeliverable confirmation or password-reset emails, degraded data quality, and frustrated users who may not realise they mistyped their address.',
                    recommendation:
                      'Use <input type="email"> (which enables built-in browser validation) and supplement it with server-side email format validation using a proper regex or library. Consider sending a verification email to confirm ownership.',
                    severity: 'Medium',
                  });
                }
              }
            } catch {
              // skip
            } finally {
              await emailPage.close();
            }
          }

          // Test 5: Password field security
          if (form.hasPasswordField) {
            const pwPage = await context.newPage();
            try {
              await pwPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
              const pwInput = await pwPage.$(`${formSelector} input[type="password"]`);
              if (pwInput) {
                await pwInput.fill('123');
                const minLength = await pwInput.evaluate((el: HTMLInputElement) => el.minLength);
                if (minLength <= 0) {
                  issues.push({
                    page: url,
                    formSelector,
                    issueType: 'Weak Password Policy',
                    description: `The password field in form "${formSelector}" has no minlength attribute and accepted the trivially weak password "123".`,
                    impact:
                      'Allowing short or simple passwords makes accounts trivially susceptible to brute-force and credential-stuffing attacks. A compromised account can lead to data breaches, financial loss, and loss of user trust.',
                    recommendation:
                      'Enforce a minimum password length of at least 8 characters (12+ recommended) using the minlength attribute on the input and server-side validation. Consider integrating a password-strength meter and rejecting passwords that appear in common breach lists (Have I Been Pwned API).',
                    severity: 'High',
                  });
                }
              }
            } catch {
              // skip
            } finally {
              await pwPage.close();
            }
          }
        }
      } catch {
        // Skip failed pages
      } finally {
        await page.close();
      }
    }

    await context.close();
  } finally {
    if (browser) await browser.close();
  }

  return issues;
}
