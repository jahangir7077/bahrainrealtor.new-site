export const en = {
  development: {
    placeholder: 'Development placeholder.',
    notice: 'This development page is not the finished website.',
    languageLink: 'View the Arabic development placeholder',
  },
  notFound: {
    title: 'Page not found',
    description: 'The requested page could not be found.',
    homeLink: 'Return to the development homepage',
  },
  translation: {
    unavailable: 'Translation unavailable',
    reviewNotice: 'Proposed interface wording; owner review required before production publication.',
    greeting: 'Hello, {name}.',
  },
  vocabulary: {
    property: 'Property',
    area: 'Area',
    price: 'Price',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    size: 'Property size',
    propertyCount: {
      plural: {
        zero: '{count} properties',
        one: '{count} property',
        two: '{count} properties',
        few: '{count} properties',
        many: '{count} properties',
        other: '{count} properties',
      },
    },
  },
} as const;
