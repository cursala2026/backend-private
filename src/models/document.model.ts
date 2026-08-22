export interface DocumentItem {
  id: string;
  title: string;
  url: string;
  allowedRoles: string[]; // ['ADMIN', 'PROFESOR', 'ALUMNO']
  createdAt?: string;
}