import { mapOwasp } from './owasp-mapper.js';

type BugCategory =
  | 'UX Bug'
  | 'Functional Bug'
  | 'Security Risk'
  | 'Accessibility Issue'
  | 'Performance Issue'
  | 'Minor Styling';

export interface ClassificationResult {
  category: BugCategory;
  confidence: number;
  fixSuggestion?: string;
}

function heuristicClassify(description: string, issueType: string): ClassificationResult {
  const text = `${issueType} ${description}`.toLowerCase();
  const owaspData = mapOwasp(issueType, description);

  let category: BugCategory;
  if (text.includes('sql') || text.includes('xss') || text.includes('injection') || text.includes('password') || text.includes('security')) {
    category = 'Security Risk';
  } else if (text.includes('alt text') || text.includes('aria') || text.includes('label') || text.includes('heading') || text.includes('screen reader') || text.includes('accessibility')) {
    category = 'Accessibility Issue';
  } else if (text.includes('404') || text.includes('not found') || text.includes('broken') || text.includes('validation') || text.includes('submit')) {
    category = 'Functional Bug';
  } else if (text.includes('overflow') || text.includes('overlap') || text.includes('viewport')) {
    category = 'UX Bug';
  } else if (text.includes('load') || text.includes('timeout') || text.includes('slow')) {
    category = 'Performance Issue';
  } else if (text.includes('meta') || text.includes('title') || text.includes('seo') || text.includes('styling')) {
    category = 'Minor Styling';
  } else {
    category = 'UX Bug';
  }

  return {
    category,
    confidence: 0.75,
    fixSuggestion: owaspData.fixSuggestion,
  };
}

async function classifyWithOpenAI(
  apiKey: string,
  model: string,
  description: string,
  issueType: string
): Promise<ClassificationResult> {
  const owaspData = mapOwasp(issueType, description);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a QA expert and security engineer. Given a web issue, respond with JSON only:
{
  "category": one of ["UX Bug","Functional Bug","Security Risk","Accessibility Issue","Performance Issue","Minor Styling"],
  "confidence": 0.0-1.0,
  "fix": "A clear, actionable fix with a code example if applicable (2-4 sentences max)"
}`,
          },
          {
            role: 'user',
            content: `Issue Type: ${issueType}\nDescription: ${description}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return heuristicClassify(description, issueType);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(content) as { category?: string; confidence?: number; fix?: string };

    return {
      category: (parsed.category as BugCategory) || 'UX Bug',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      fixSuggestion: parsed.fix || owaspData.fixSuggestion,
    };
  } catch {
    return heuristicClassify(description, issueType);
  }
}

export async function classifyBug(
  description: string,
  issueType: string,
  enableAI: boolean,
  openaiApiKey?: string,
  model = 'gpt-4o'
): Promise<ClassificationResult> {
  if (enableAI && openaiApiKey && openaiApiKey !== 'your_openai_key_here') {
    return classifyWithOpenAI(openaiApiKey, model, description, issueType);
  }
  return heuristicClassify(description, issueType);
}
