export interface DrillDownBreakdownItem {
  name: string;
  count: number;
}

export interface DrillDownQuote {
  text: string;
  subreddit: string;
  score: number;
}

export interface DrillDownPost {
  postId: string;
  title: string;
  subreddit: string;
  permalink: string;
  score: number;
  numComments: number;
  createdUtc: string;
  notableQuote: string | null;
  tags: string[];
}

export interface DrillDownResponse {
  total: number;
  tabTotal: number;
  percent: number;
  sentimentPercent?: number;
  quote: DrillDownQuote | null;
  breakdowns: Record<string, DrillDownBreakdownItem[]>;
  posts: DrillDownPost[];
  postsTotalCount: number;
}

export interface DrillDownConfig {
  type: "fraud" | "idv";
  dimension: string;
  value: string;
  title: string;
  secondaryDimension?: string;
  secondaryValue?: string;
}
