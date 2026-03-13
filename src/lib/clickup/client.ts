import { RateLimiter } from "./rate-limiter";
import type {
  ClickUpTeam,
  ClickUpSpace,
  ClickUpFolder,
  ClickUpList,
  ClickUpTask,
  ClickUpTasksResponse,
  ClickUpTimeEntry,
  ClickUpTimeEntriesResponse,
} from "./types";

const BASE_URL = "https://api.clickup.com/api/v2";

export class ClickUpClient {
  private token: string;
  private rateLimiter: RateLimiter;

  constructor(token: string) {
    this.token = token;
    this.rateLimiter = new RateLimiter(90, 60000);
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    await this.rateLimiter.acquire();
    const url = new URL(`${BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: this.token },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("retry-after") || "60", 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.request<T>(endpoint, params);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ClickUp API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async getTeams(): Promise<ClickUpTeam[]> {
    const data = await this.request<{ teams: ClickUpTeam[] }>("/team");
    return data.teams;
  }

  async getSpaces(teamId: string): Promise<ClickUpSpace[]> {
    const data = await this.request<{ spaces: ClickUpSpace[] }>(
      `/team/${teamId}/space`
    );
    return data.spaces;
  }

  async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
    const data = await this.request<{ folders: ClickUpFolder[] }>(
      `/space/${spaceId}/folder`
    );
    return data.folders;
  }

  async getLists(folderId: string): Promise<ClickUpList[]> {
    const data = await this.request<{ lists: ClickUpList[] }>(
      `/folder/${folderId}/list`
    );
    return data.lists;
  }

  async getTasks(
    listId: string,
    options?: {
      includesClosed?: boolean;
      dateUpdatedGt?: number;
      page?: number;
    }
  ): Promise<ClickUpTasksResponse> {
    const params: Record<string, string> = {
      page: String(options?.page ?? 0),
      limit: "100",
      include_closed: String(options?.includesClosed ?? true),
      subtasks: "true",
    };
    if (options?.dateUpdatedGt) {
      params.date_updated_gt = String(options.dateUpdatedGt);
    }
    return this.request<ClickUpTasksResponse>(
      `/list/${listId}/task`,
      params
    );
  }

  async getAllTasks(
    listId: string,
    options?: { includesClosed?: boolean; dateUpdatedGt?: number }
  ): Promise<ClickUpTask[]> {
    const allTasks: ClickUpTask[] = [];
    let page = 0;
    let lastPage = false;
    while (!lastPage) {
      const response = await this.getTasks(listId, { ...options, page });
      allTasks.push(...response.tasks);
      lastPage = response.last_page;
      page++;
    }
    return allTasks;
  }

  async getTimeEntries(
    teamId: string,
    options?: {
      startDate?: number;
      endDate?: number;
      assignee?: string;
      spaceId?: string;
      folderId?: string;
      listId?: string;
    }
  ): Promise<ClickUpTimeEntry[]> {
    const params: Record<string, string> = {};
    if (options?.startDate) params.start_date = String(options.startDate);
    if (options?.endDate) params.end_date = String(options.endDate);
    if (options?.assignee) params.assignee = options.assignee;
    if (options?.spaceId) params.space_id = options.spaceId;
    if (options?.folderId) params.folder_id = options.folderId;
    if (options?.listId) params.list_id = options.listId;

    const data = await this.request<ClickUpTimeEntriesResponse>(
      `/team/${teamId}/time_entries`,
      params
    );
    return data.data;
  }

  async testConnection(): Promise<{ ok: boolean; teamName?: string; error?: string }> {
    try {
      const teams = await this.getTeams();
      if (teams.length > 0) {
        return { ok: true, teamName: teams[0].name };
      }
      return { ok: false, error: "No teams found" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  }
}
