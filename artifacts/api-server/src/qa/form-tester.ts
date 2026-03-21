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
              textInputSelectors: textInputs.map((inp) =>
                inp.id ? `#${inp.id}` : inp.name ? `[name="${inp.name}"]` : null
              ).filter(Boolean),
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
              description: 'Form has no input fields',
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
                  description: 'Form with required fields does not show validation messages on empty submission',
                  severity: 'Medium',
                });
              }
            }
          } catch {
            // skip
          } finally {
            await emptyPage.close();
          }

          // Test 2: Check for required field marking
          if (!form.hasRequiredFields && form.inputCount > 1) {
            issues.push({
              page: url,
              formSelector,
              issueType: 'No Required Fields Marked',
              description: `Form with ${form.inputCount} fields has no required field validation`,
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
                    description: `Text input accepts raw SQL injection string "${SQL_INJECTION_STRINGS[0]}" without sanitization`,
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
                    description: `Text input accepts XSS script string without sanitization`,
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
                await emailInput.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })));
                await emailPage.waitForTimeout(300);
                const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
                if (!isInvalid) {
                  issues.push({
                    page: url,
                    formSelector,
                    issueType: 'Weak Email Validation',
                    description: 'Email field accepts invalid email format "notanemail" without client-side validation error',
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
                    description: 'Password field has no minimum length requirement (accepts weak passwords like "123")',
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
