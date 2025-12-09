export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  pageCount: number;
  requiredPhotos: number;
}

export interface Magazine {
  id: string;
  title: string;
  templateId: string;
  templateName: string;
  thumbnailUrl: string;
  status: 'draft' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  photos: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: Date;
}
