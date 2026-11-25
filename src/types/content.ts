import type { Language } from '../i18n/config.ts';
import type { PublicationVersion } from '../i18n/publication.ts';

export type PropertyAvailability = 'available' | 'reserved' | 'sold' | 'rented' | 'unavailable';
export type PropertyTransaction = 'sale' | 'rent';

export interface LocalizedPropertyContent {
  title: string;
  description: string;
  areaName: string;
  propertyType: string;
  seoTitle?: string;
  seoDescription?: string;
  humanReviewedRevisionId?: string;
}

export interface PropertyImage {
  src: string;
  alt: Partial<Record<Language, string>>;
  width: number;
  height: number;
  isCover: boolean;
}

export interface PropertyRecord {
  id: string;
  immutableReference: string;
  slug: string;
  transaction: PropertyTransaction;
  availability: PropertyAvailability;
  priceBhd?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSquareMeters?: number;
  locationName: string;
  content: Partial<Record<Language, LocalizedPropertyContent>>;
  images: readonly PropertyImage[];
  publication: Partial<Record<Language, PublicationVersion>>;
}

export interface LocalizedAreaContent {
  name: string;
  introduction?: string;
  highlights?: readonly string[];
  humanReviewedRevisionId?: string;
}

export interface AreaRecord {
  id: string;
  slug: string;
  content: Partial<Record<Language, LocalizedAreaContent>>;
}

export interface LocalizedProjectContent {
  name: string;
  introduction: string;
  location: string;
  status?: string;
  humanReviewedRevisionId?: string;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  content: Partial<Record<Language, LocalizedProjectContent>>;
  images: readonly PropertyImage[];
}

export interface LocalizedArticleContent {
  title: string;
  summary: string;
  body: string;
  seoTitle?: string;
  seoDescription?: string;
  categoryName?: string;
  sections?: readonly {
    id: string;
    heading: string;
    body: string;
  }[];
  humanReviewedRevisionId?: string;
}

export interface ArticleRecord {
  id: string;
  slug: string;
  authorName: string;
  publishedAt?: string;
  updatedAt?: string;
  content: Partial<Record<Language, LocalizedArticleContent>>;
  publication: Partial<Record<Language, PublicationVersion>>;
}

export interface LocalizedFaqContent {
  question: string;
  answer: string;
  categoryName?: string;
  humanReviewedRevisionId?: string;
}

export interface FaqRecord {
  id: string;
  publishedAt?: string;
  content: Partial<Record<Language, LocalizedFaqContent>>;
  publication: Partial<Record<Language, PublicationVersion>>;
}

export interface EnquiryFormData {
  name: string;
  email: string;
  telephone: string;
  message: string;
  propertyReference?: string;
  language: Language;
  consent: boolean;
}

export interface PropertyRepository {
  search(filters: Readonly<Record<string, string | number>>): Promise<readonly PropertyRecord[]>;
  getById(immutableReference: string): Promise<PropertyRecord | null>;
}

export interface EditorialRepository {
  listArticles(language: Language): Promise<readonly ArticleRecord[]>;
  listFaqs(language: Language): Promise<readonly FaqRecord[]>;
}
