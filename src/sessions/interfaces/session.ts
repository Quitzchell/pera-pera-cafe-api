export interface Session {
  title: string;
  source_language: string;
  target_language: string;
  join_code: string;
  status: string;
  ended_at: Date | null;
}
