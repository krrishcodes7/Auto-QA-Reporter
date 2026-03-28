export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScanStep {
  name: string;
  status: StepStatus;
  label: string;
}

export interface BrokenLink {
  sourcePage: string;
  linkUrl: string;
  statusCode: number;
  statusType: string;
  error?: string;
  impact?: string;
  recommendation?: string;
  owaspCategory?: string;
  fixSuggestion?: string;
  aiCategory?: string;
  aiConfidence?: number;
}

export interface UIIssue {
  id?: string;
  page: string;
  severity: Severity;
  issueType: string;
  description: string;
  impact?: string;
  recommendation?: string;
  selector?: string;
  screenshotFile?: string;
  boundingBox?: BoundingBox;
  owaspCategory?: string;
  fixSuggestion?: string;
  aiCategory?: string;
  aiConfidence?: number;
}

export interface FormIssue {
  id?: string;
  page: string;
  formSelector: string;
  issueType: string;
  description: string;
  impact?: string;
  recommendation?: string;
  severity: Severity;
  screenshotFile?: string;
  boundingBox?: BoundingBox;
  owaspCategory?: string;
  fixSuggestion?: string;
  aiCategory?: string;
  aiConfidence?: number;
}

export interface PageScanned {
  url: string;
  title?: string;
  statusCode: number;
  screenshotFile?: string;
  loadTimeMs?: number;
  linksFound?: number;
  formsFound?: number;
}

export interface ScanSummary {
  totalBugs: number;
  brokenLinks: number;
  uiIssues: number;
  formIssues: number;
  healthScore: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ScanReport {
  jobId: string;
  targetUrl: string;
  scannedAt: string;
  totalPages: number;
  scanDurationMs: number;
  summary: ScanSummary;
  brokenLinks: BrokenLink[];
  uiIssues: UIIssue[];
  formIssues: FormIssue[];
  pagesScanned: PageScanned[];
}

export interface ScanJob {
  jobId: string;
  url: string;
  maxPages: number;
  enableAI: boolean;
  status: ScanStatus;
  progress: number;
  currentStep: string;
  currentUrl?: string;
  steps: ScanStep[];
  error?: string;
  startedAt: string;
  completedAt?: string;
  report?: ScanReport;
  screenshotsDir?: string;
  cancelled?: boolean;
}
