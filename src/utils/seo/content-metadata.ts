export interface ContentMetadataInput {
  title: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export function contentMetadata(input: ContentMetadataInput) {
  const normalize = (value: string | null | undefined) => value?.trim().replace(/\s+/g, ' ') ?? '';
  const limit = (value: string, maximum: number) => Array.from(value).slice(0, maximum).join('');
  const title = limit(normalize(input.seoTitle) || normalize(input.title), 200);
  const description = limit(normalize(input.seoDescription) || normalize(input.description), 500);
  return { title, description };
}
