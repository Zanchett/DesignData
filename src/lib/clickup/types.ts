export interface ClickUpTeam {
  id: string;
  name: string;
  members: ClickUpMember[];
}

export interface ClickUpMember {
  user: {
    id: number;
    username: string;
    email: string;
    color: string | null;
    profilePicture: string | null;
    role: number;
  };
}

export interface ClickUpSpace {
  id: string;
  name: string;
  statuses: ClickUpStatus[];
}

export interface ClickUpStatus {
  status: string;
  type: string;
  color: string;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  hidden: boolean;
  space: { id: string };
  task_count: string;
  lists: ClickUpList[];
}

export interface ClickUpList {
  id: string;
  name: string;
  folder: { id: string };
  task_count: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  description: string | null;
  status: {
    status: string;
    type: string;
    color: string;
  };
  date_created: string;
  date_updated: string;
  date_closed: string | null;
  date_done: string | null;
  due_date: string | null;
  start_date: string | null;
  time_estimate: number | null;
  time_spent: number | null;
  priority: {
    id: string;
    priority: string;
    color: string;
  } | null;
  assignees: {
    id: number;
    username: string;
    email: string;
    color: string | null;
    profilePicture: string | null;
  }[];
  tags: { name: string; tag_fg: string; tag_bg: string }[];
  list: { id: string };
  folder: { id: string };
  space: { id: string };
  parent: string | null;
  custom_fields?: ClickUpCustomField[];
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value: unknown;
  type_config?: {
    options?: { id: string; name: string; orderindex: number; color: string }[];
  };
}

export interface ClickUpTimeEntry {
  id: string;
  task: { id: string; name: string } | null;
  user: {
    id: number;
    username: string;
    email: string;
  };
  start: string;
  end: string;
  duration: string;
  description: string | null;
  tags: { name: string }[];
  billable: boolean;
  task_location?: {
    list_id: string;
    folder_id: string;
    space_id: string;
  };
}

export interface ClickUpTasksResponse {
  tasks: ClickUpTask[];
  last_page: boolean;
}

export interface ClickUpTimeEntriesResponse {
  data: ClickUpTimeEntry[];
}
