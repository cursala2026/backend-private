export interface ApiError {
  key: string;
  message: string;
}

export interface PaginationInfo {
  count?: number;
  page: number;
  page_size: number;
}

export interface ApiResponse<T> {
  status: number;
  message: string | null;
  data?: T | null;
  errors?: ApiError[];
  pagination?: PaginationInfo;
}
