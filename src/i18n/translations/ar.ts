import type { TranslationShape } from '../types.ts';
import { en } from './en.ts';

export const ar = {
  development: {
    placeholder: 'صفحة تطويرية مؤقتة.',
    notice: 'هذه الصفحة التطويرية ليست الموقع النهائي.',
    languageLink: 'عرض الصفحة التطويرية باللغة الإنجليزية',
  },
  notFound: {
    title: 'الصفحة غير موجودة',
    description: 'تعذر العثور على الصفحة المطلوبة.',
    homeLink: 'العودة إلى الصفحة التطويرية الرئيسية',
  },
  translation: {
    unavailable: 'الترجمة غير متاحة',
    reviewNotice: 'صياغة واجهة مقترحة؛ تتطلب مراجعة المالك قبل النشر على الموقع.',
    greeting: 'مرحباً، {name}.',
  },
  vocabulary: {
    property: 'عقار',
    area: 'المنطقة',
    price: 'السعر',
    bedrooms: 'غرف النوم',
    bathrooms: 'الحمامات',
    size: 'مساحة العقار',
    propertyCount: {
      plural: {
        zero: '{count} عقار',
        one: '{count} عقار',
        two: '{count} عقاران',
        few: '{count} عقارات',
        many: '{count} عقاراً',
        other: '{count} عقار',
      },
    },
  },
} satisfies TranslationShape<typeof en>;
