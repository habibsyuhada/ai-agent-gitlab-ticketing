export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url?: string;
  public_email?: string;
}

export interface GitLabEvent {
  id: number;
  project_id: number;
  action_name: string;
  target_id: number | null;
  target_iid: number | null;
  target_type: string | null;
  author_id: number;
  target_title: string | null;
  created_at: string;
  author: {
    id: number;
    username: string;
    name: string;
    state: string;
    avatar_url: string;
    web_url: string;
  };
  push_data: {
    commit_count: number;
    action: string;
    ref_type: string;
    commit_from: string;
    commit_to: string;
    ref: string;
    commit_title: string;
    ref_count: number | null;
  };
  author_username: string;
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  created_at: string;
  parent_ids: string[];
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  trailers: Record<string, string>;
  extended_trailers: Record<string, string>;
  web_url: string;
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  status: string | null;
  project_id: number;
  last_pipeline: any;
}

export interface GitLabParseRequest {
  fromDate: string;
  toDate: string;
  userIds: number[];
}
